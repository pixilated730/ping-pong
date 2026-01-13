// src/app/services/crypto/bitcoin.service.ts
import { Injectable } from '@angular/core';
import { GeneratedAddress } from '../../types/chains';

@Injectable({ providedIn: 'root' })
export class BitcoinService {
  private readonly SECP256K1_P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
  private readonly SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  private readonly SECP256K1_GX = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
  private readonly SECP256K1_GY = BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');

  private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base = ((base % mod) + mod) % mod;
    while (exp > 0n) {
      if (exp % 2n === 1n) result = (result * base) % mod;
      exp = exp / 2n;
      base = (base * base) % mod;
    }
    return result;
  }

  private modInverse(a: bigint, m: bigint): bigint {
    return this.modPow(a, m - 2n, m);
  }

  private pointAdd(p1: [bigint, bigint] | null, p2: [bigint, bigint] | null): [bigint, bigint] | null {
    if (!p1) return p2;
    if (!p2) return p1;
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    if (x1 === x2 && y1 !== y2) return null;
    let slope: bigint;
    if (x1 === x2) {
      slope = (3n * x1 * x1 * this.modInverse(2n * y1, this.SECP256K1_P)) % this.SECP256K1_P;
    } else {
      slope = ((y2 - y1) * this.modInverse(x2 - x1, this.SECP256K1_P)) % this.SECP256K1_P;
    }
    const x3 = ((slope * slope - x1 - x2) % this.SECP256K1_P + this.SECP256K1_P) % this.SECP256K1_P;
    const y3 = ((slope * (x1 - x3) - y1) % this.SECP256K1_P + this.SECP256K1_P) % this.SECP256K1_P;
    return [x3, y3];
  }

  private scalarMult(k: bigint, point: [bigint, bigint]): [bigint, bigint] {
    let result: [bigint, bigint] | null = null;
    let addend: [bigint, bigint] | null = point;
    while (k > 0n) {
      if (k % 2n === 1n) result = this.pointAdd(result, addend);
      addend = this.pointAdd(addend, addend);
      k = k / 2n;
    }
    return result!;
  }

  getPublicKey(privateKeyHex: string): { compressed: string; uncompressed: string } {
    const privKey = BigInt('0x' + privateKeyHex);
    const [x, y] = this.scalarMult(privKey, [this.SECP256K1_GX, this.SECP256K1_GY]);
    const xHex = x.toString(16).padStart(64, '0');
    const yHex = y.toString(16).padStart(64, '0');
    const prefix = y % 2n === 0n ? '02' : '03';
    return {
      compressed: prefix + xHex,
      uncompressed: '04' + xHex + yHex
    };
  }

  getPublicKeyBytes(privateKeyHex: string): Uint8Array {
    const { compressed } = this.getPublicKey(privateKeyHex);
    return this.hexToBytes(compressed);
  }

  private sha256(data: Uint8Array): Promise<Uint8Array> {
    return crypto.subtle.digest('SHA-256', data).then(buf => new Uint8Array(buf));
  }

  private ripemd160(data: Uint8Array): Uint8Array {
    const H = new Uint32Array([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]);
    const KL = [0, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E];
    const KR = [0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0];
    const RL = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
    const RR = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
    const SL = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
    const SR = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
    const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
    const padded = new Uint8Array(((data.length + 9 + 63) & ~63));
    padded.set(data);
    padded[data.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, (data.length * 8) >>> 0, true);
    view.setUint32(padded.length - 4, (data.length * 8 / 0x100000000) >>> 0, true);
    for (let i = 0; i < padded.length; i += 64) {
      const X = new Uint32Array(16);
      for (let j = 0; j < 16; j++) X[j] = view.getUint32(i + j * 4, true);
      let [al, bl, cl, dl, el] = [H[0], H[1], H[2], H[3], H[4]];
      let [ar, br, cr, dr, er] = [H[0], H[1], H[2], H[3], H[4]];
      for (let j = 0; j < 80; j++) {
        const round = Math.floor(j / 16);
        let fl: number, fr: number;
        if (round === 0) { fl = bl ^ cl ^ dl; fr = br ^ cr ^ dr; }
        else if (round === 1) { fl = (bl & cl) | (~bl & dl); fr = (br & dr) | (cr & ~dr); }
        else if (round === 2) { fl = (bl | ~cl) ^ dl; fr = (br | ~cr) ^ dr; }
        else if (round === 3) { fl = (bl & dl) | (cl & ~dl); fr = (br & cr) | (~br & dr); }
        else { fl = bl ^ (cl | ~dl); fr = br ^ (cr | ~dr); }
        let tl = (al + fl + X[RL[j]] + KL[round]) >>> 0;
        tl = (rotl(tl, SL[j]) + el) >>> 0;
        al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = tl;
        let tr = (ar + fr + X[RR[j]] + KR[round]) >>> 0;
        tr = (rotl(tr, SR[j]) + er) >>> 0;
        ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = tr;
      }
      const t = (H[1] + cl + dr) >>> 0;
      H[1] = (H[2] + dl + er) >>> 0;
      H[2] = (H[3] + el + ar) >>> 0;
      H[3] = (H[4] + al + br) >>> 0;
      H[4] = (H[0] + bl + cr) >>> 0;
      H[0] = t;
    }
    const result = new Uint8Array(20);
    const resultView = new DataView(result.buffer);
    for (let i = 0; i < 5; i++) resultView.setUint32(i * 4, H[i], true);
    return result;
  }

  private async hash160(data: Uint8Array): Promise<Uint8Array> {
    const sha = await this.sha256(data);
    return this.ripemd160(sha);
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private base58Encode(data: Uint8Array): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt('0x' + this.bytesToHex(data));
    let result = '';
    while (num > 0n) {
      result = ALPHABET[Number(num % 58n)] + result;
      num = num / 58n;
    }
    for (let i = 0; i < data.length && data[i] === 0; i++) result = '1' + result;
    return result;
  }

  private base58Decode(str: string): Uint8Array {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = 0n;
    for (const char of str) {
      const idx = ALPHABET.indexOf(char);
      if (idx === -1) throw new Error('Invalid base58 character');
      num = num * 58n + BigInt(idx);
    }
    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    const bytes = this.hexToBytes(hex);
    let leadingZeros = 0;
    for (const c of str) { if (c === '1') leadingZeros++; else break; }
    const result = new Uint8Array(leadingZeros + bytes.length);
    result.set(bytes, leadingZeros);
    return result;
  }

  private async base58Check(payload: Uint8Array): Promise<string> {
    const checksum = (await this.sha256(await this.sha256(payload))).slice(0, 4);
    const full = new Uint8Array(payload.length + 4);
    full.set(payload);
    full.set(checksum, payload.length);
    return this.base58Encode(full);
  }

  private bech32Encode(hrp: string, version: number, data: Uint8Array): string {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const convert = (data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] => {
      let acc = 0, bits = 0;
      const ret: number[] = [];
      const maxv = (1 << toBits) - 1;
      for (const v of data) {
        acc = (acc << fromBits) | v;
        bits += fromBits;
        while (bits >= toBits) {
          bits -= toBits;
          ret.push((acc >> bits) & maxv);
        }
      }
      if (pad && bits > 0) ret.push((acc << (toBits - bits)) & maxv);
      return ret;
    };
    const polymod = (values: number[]): number => {
      const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
      let chk = 1;
      for (const v of values) {
        const b = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
      }
      return chk;
    };
    const hrpExpand = (hrp: string): number[] => {
      const ret: number[] = [];
      for (const c of hrp) ret.push(c.charCodeAt(0) >> 5);
      ret.push(0);
      for (const c of hrp) ret.push(c.charCodeAt(0) & 31);
      return ret;
    };
    const enc = version === 1 ? 0x2bc830a3 : 1;
    const words = [version, ...convert(data, 8, 5, true)];
    const chksum = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ enc;
    for (let i = 0; i < 6; i++) words.push((chksum >> (5 * (5 - i))) & 31);
    return hrp + '1' + words.map(w => CHARSET[w]).join('');
  }

  async getWIF(privateKeyHex: string, compressed: boolean = true): Promise<string> {
    const prefix = new Uint8Array([0x80]);
    const key = this.hexToBytes(privateKeyHex);
    const suffix = compressed ? new Uint8Array([0x01]) : new Uint8Array([]);
    const payload = new Uint8Array(prefix.length + key.length + suffix.length);
    payload.set(prefix);
    payload.set(key, prefix.length);
    payload.set(suffix, prefix.length + key.length);
    return this.base58Check(payload);
  }

  parseWIF(wif: string): { privateKeyHex: string; compressed: boolean } | null {
    try {
      const decoded = this.base58Decode(wif);
      if (decoded.length === 38 && decoded[0] === 0x80 && decoded[33] === 0x01) {
        return { privateKeyHex: this.bytesToHex(decoded.slice(1, 33)), compressed: true };
      }
      if (decoded.length === 37 && decoded[0] === 0x80) {
        return { privateKeyHex: this.bytesToHex(decoded.slice(1, 33)), compressed: false };
      }
      return null;
    } catch { return null; }
  }

  async generateAddresses(privateKeyHex: string): Promise<GeneratedAddress[]> {
    const { compressed, uncompressed } = this.getPublicKey(privateKeyHex);
    const compressedBytes = this.hexToBytes(compressed);
    const uncompressedBytes = this.hexToBytes(uncompressed);
    const hash160Compressed = await this.hash160(compressedBytes);
    const hash160Uncompressed = await this.hash160(uncompressedBytes);
    const addresses: GeneratedAddress[] = [];

    const p2pkhPayload = new Uint8Array([0x00, ...hash160Uncompressed]);
    addresses.push({
      chain: 'btc', type: 'p2pkh',
      address: await this.base58Check(p2pkhPayload),
      balance: 0, hasActivity: false, checked: false
    });

    const redeemScript = new Uint8Array([0x00, 0x14, ...hash160Compressed]);
    const redeemHash = await this.hash160(redeemScript);
    const p2shPayload = new Uint8Array([0x05, ...redeemHash]);
    addresses.push({
      chain: 'btc', type: 'p2sh-p2wpkh',
      address: await this.base58Check(p2shPayload),
      balance: 0, hasActivity: false, checked: false
    });

    addresses.push({
      chain: 'btc', type: 'p2wpkh',
      address: this.bech32Encode('bc', 0, hash160Compressed),
      balance: 0, hasActivity: false, checked: false
    });

    const xOnlyPubKey = compressedBytes.slice(1);
    const taprootHash = await this.sha256(new Uint8Array([...new TextEncoder().encode('TapTweak'), ...xOnlyPubKey]));
    const tweakedKey = this.tweakPublicKey(compressed, taprootHash);
    addresses.push({
      chain: 'btc', type: 'p2tr',
      address: this.bech32Encode('bc', 1, this.hexToBytes(tweakedKey)),
      balance: 0, hasActivity: false, checked: false
    });

    return addresses;
  }

  private tweakPublicKey(pubKeyHex: string, tweak: Uint8Array): string {
    const xHex = pubKeyHex.slice(2);
    const x = BigInt('0x' + xHex);
    const tweakInt = BigInt('0x' + this.bytesToHex(tweak)) % this.SECP256K1_N;
    const ySquared = (this.modPow(x, 3n, this.SECP256K1_P) + 7n) % this.SECP256K1_P;
    let y = this.modPow(ySquared, (this.SECP256K1_P + 1n) / 4n, this.SECP256K1_P);
    if (pubKeyHex.startsWith('03')) y = (this.SECP256K1_P - y) % this.SECP256K1_P;
    const tweakPoint = this.scalarMult(tweakInt, [this.SECP256K1_GX, this.SECP256K1_GY]);
    const result = this.pointAdd([x, y], tweakPoint);
    return result![0].toString(16).padStart(64, '0');
  }
}
