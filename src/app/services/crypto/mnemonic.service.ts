// src/app/services/crypto/mnemonic.service.ts
import { Injectable } from '@angular/core';
import { BitcoinService } from './bitcoin.service';
import { EthereumService } from './ethereum.service';
import { SolanaService } from './solana.service';
import { ChainId, GeneratedAddress } from '../../types/chains';

interface DerivedKey {
  path: string;
  privateKeyHex: string;
  addresses: GeneratedAddress[];
}

@Injectable({ providedIn: 'root' })
export class MnemonicService {
  private readonly WORDLIST_URL = 'https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt';
  private wordlist: string[] = [];

  constructor(
    private btc: BitcoinService,
    private eth: EthereumService,
    private sol: SolanaService
  ) {
    this.loadWordlist();
  }

  private async loadWordlist(): Promise<void> {
    if (this.wordlist.length > 0) return;
    
    try {
      const res = await fetch(this.WORDLIST_URL);
      if (res.ok) {
        const text = await res.text();
        this.wordlist = text.trim().split('\n');
      }
    } catch {
      this.wordlist = [];
    }
  }

  async validateMnemonic(phrase: string): Promise<boolean> {
    await this.loadWordlist();
    if (this.wordlist.length === 0) return true;
    
    const words = phrase.trim().toLowerCase().split(/\s+/);
    if (![12, 15, 18, 21, 24].includes(words.length)) return false;
    
    return words.every(w => this.wordlist.includes(w));
  }

  async mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const mnemonicNorm = mnemonic.normalize('NFKD');
    const salt = 'mnemonic' + passphrase.normalize('NFKD');
    
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(mnemonicNorm),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: 2048,
        hash: 'SHA-512'
      },
      key,
      512
    );
    
    return new Uint8Array(bits);
  }

  private async hmacSha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(sig);
  }

  private async deriveMasterKey(seed: Uint8Array): Promise<{ privateKey: Uint8Array; chainCode: Uint8Array }> {
    const enc = new TextEncoder();
    const I = await this.hmacSha512(enc.encode('Bitcoin seed'), seed);
    return {
      privateKey: I.slice(0, 32),
      chainCode: I.slice(32, 64)
    };
  }

  private async deriveChild(
    parentKey: Uint8Array,
    parentChainCode: Uint8Array,
    index: number,
    hardened: boolean
  ): Promise<{ privateKey: Uint8Array; chainCode: Uint8Array }> {
    const data = new Uint8Array(37);
    
    if (hardened) {
      data[0] = 0;
      data.set(parentKey, 1);
      const idx = index + 0x80000000;
      data[33] = (idx >>> 24) & 0xff;
      data[34] = (idx >>> 16) & 0xff;
      data[35] = (idx >>> 8) & 0xff;
      data[36] = idx & 0xff;
    } else {
      const pubKey = this.btc.getPublicKeyBytes(this.toHex(parentKey));
      data.set(pubKey, 0);
      data[33] = (index >>> 24) & 0xff;
      data[34] = (index >>> 16) & 0xff;
      data[35] = (index >>> 8) & 0xff;
      data[36] = index & 0xff;
    }

    const I = await this.hmacSha512(parentChainCode, data);
    const IL = I.slice(0, 32);
    const IR = I.slice(32, 64);

    const order = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const parentKeyBigInt = this.toBigInt(parentKey);
    const ILBigInt = this.toBigInt(IL);
    
    let childKey = (parentKeyBigInt + ILBigInt) % order;
    if (childKey === 0n) {
      throw new Error('Invalid child key');
    }

    const childKeyBytes = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
      childKeyBytes[i] = Number(childKey & 0xffn);
      childKey >>= 8n;
    }

    return {
      privateKey: childKeyBytes,
      chainCode: IR
    };
  }

  private parsePath(path: string): { index: number; hardened: boolean }[] {
    const parts = path.split('/');
    if (parts[0] !== 'm') throw new Error('Invalid path');
    
    return parts.slice(1).map(part => {
      const hardened = part.endsWith("'") || part.endsWith('h');
      const index = parseInt(part.replace(/['h]$/, ''), 10);
      return { index, hardened };
    });
  }

  async deriveFromMnemonic(
    mnemonic: string,
    path: string,
    chains: ChainId[],
    passphrase: string = ''
  ): Promise<DerivedKey> {
    const seed = await this.mnemonicToSeed(mnemonic, passphrase);
    let { privateKey, chainCode } = await this.deriveMasterKey(seed);
    
    const segments = this.parsePath(path);
    for (const seg of segments) {
      const result = await this.deriveChild(privateKey, chainCode, seg.index, seg.hardened);
      privateKey = result.privateKey;
      chainCode = result.chainCode;
    }

    const privateKeyHex = this.toHex(privateKey);
    const addresses: GeneratedAddress[] = [];

    for (const chain of chains) {
      switch (chain) {
        case 'btc':
          addresses.push(...await this.btc.generateAddresses(privateKeyHex));
          break;
        case 'eth':
          addresses.push(this.eth.generateAddress(privateKeyHex));
          break;
        case 'sol':
          addresses.push(await this.sol.generateAddress(privateKeyHex));
          break;
      }
    }

    return { path, privateKeyHex, addresses };
  }

  async deriveMultiple(
    mnemonic: string,
    basePath: string,
    count: number,
    chains: ChainId[],
    passphrase: string = ''
  ): Promise<DerivedKey[]> {
    const results: DerivedKey[] = [];
    
    const pathParts = basePath.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const isLastHardened = lastPart.endsWith("'") || lastPart.endsWith('h');
    const baseIndex = parseInt(lastPart.replace(/['h]$/, ''), 10);
    const prefix = pathParts.slice(0, -1).join('/');
    
    for (let i = 0; i < count; i++) {
      const idx = baseIndex + i;
      const path = `${prefix}/${idx}${isLastHardened ? "'" : ''}`;
      const derived = await this.deriveFromMnemonic(mnemonic, path, chains, passphrase);
      results.push(derived);
    }
    
    return results;
  }

  getDefaultPaths(): Record<ChainId, string> {
    return {
      btc: "m/44'/0'/0'/0/0",
      eth: "m/44'/60'/0'/0/0",
      sol: "m/44'/501'/0'/0'"
    };
  }

  private toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private toBigInt(bytes: Uint8Array): bigint {
    return BigInt('0x' + this.toHex(bytes));
  }
}
