// src/app/services/crypto/key-generator.service.ts
import { Injectable } from '@angular/core';
import { BitcoinService } from './bitcoin.service';
import { EthereumService } from './ethereum.service';
import { SolanaService } from './solana.service';
import { ChainId, GeneratedAddress, KeyResult } from '../../types/chains';

@Injectable({ providedIn: 'root' })
export class KeyGeneratorService {
  constructor(
    private btc: BitcoinService,
    private eth: EthereumService,
    private sol: SolanaService
  ) {}

  generateRandomKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  isValidPrivateKey(hex: string): boolean {
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) return false;
    const n = BigInt('0x' + hex);
    const max = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140');
    return n > 0n && n <= max;
  }

  parseInput(input: string): string | null {
    const trimmed = input.trim();
    if (trimmed.startsWith('5') || trimmed.startsWith('K') || trimmed.startsWith('L')) {
      const result = this.btc.parseWIF(trimmed);
      if (result) return result.privateKeyHex;
    }
    const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
    if (this.isValidPrivateKey(hex)) return hex.toLowerCase();
    return null;
  }

  async generateForChains(privateKeyHex: string, chains: ChainId[]): Promise<GeneratedAddress[]> {
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
    return addresses;
  }

  async importKey(input: string, chains: ChainId[]): Promise<KeyResult | null> {
    const privateKeyHex = this.parseInput(input);
    if (!privateKeyHex) return null;
    const { compressed, uncompressed } = this.btc.getPublicKey(privateKeyHex);
    const addresses = await this.generateForChains(privateKeyHex, chains);
    return {
      privateKeyHex,
      privateKeyWif: await this.btc.getWIF(privateKeyHex),
      publicKeyCompressed: compressed,
      publicKeyUncompressed: uncompressed,
      addresses,
      hasActivity: false
    };
  }
}
