// src/app/services/crypto/ethereum.service.ts
import { Injectable } from '@angular/core';
import { GeneratedAddress } from '../../types/chains';

@Injectable({ providedIn: 'root' })
export class EthereumService {
  private readonly SECP256K1_P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
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

  private keccak256(data: Uint8Array): Uint8Array {
    const RC = [
      0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
      0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
      0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
      0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
      0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
      0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
    ];
    const ROTC = [
      [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
      [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]
    ];
    const rotl64 = (x: bigint, n: number): bigint => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & 0xffffffffffffffffn;
    const state = new Array(25).fill(0n);
    const rate = 136;
    const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
    padded.set(data);
    padded[data.length] = 0x01;
    padded[padded.length - 1] |= 0x80;
    for (let offset = 0; offset < padded.length; offset += rate) {
      for (let i = 0; i < rate / 8; i++) {
        let val = 0n;
        for (let j = 0; j < 8; j++) val |= BigInt(padded[offset + i * 8 + j]) << BigInt(j * 8);
        state[i] ^= val;
      }
      for (let round = 0; round < 24; round++) {
        const C = new Array(5).fill(0n);
        for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        const D = new Array(5).fill(0n);
        for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
        for (let i = 0; i < 25; i++) state[i] ^= D[i % 5];
        const B = new Array(25).fill(0n);
        for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y * 5 + ((2 * x + 3 * y) % 5)] = rotl64(state[x + y * 5], ROTC[y][x]);
        for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x + y * 5] = B[x + y * 5] ^ (~B[((x + 1) % 5) + y * 5] & B[((x + 2) % 5) + y * 5]);
        state[0] ^= RC[round];
      }
    }
    const result = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      const val = state[i];
      for (let j = 0; j < 8; j++) result[i * 8 + j] = Number((val >> BigInt(j * 8)) & 0xffn);
    }
    return result;
  }

  generateAddress(privateKeyHex: string): GeneratedAddress {
    const privKey = BigInt('0x' + privateKeyHex);
    const [x, y] = this.scalarMult(privKey, [this.SECP256K1_GX, this.SECP256K1_GY]);
    const xHex = x.toString(16).padStart(64, '0');
    const yHex = y.toString(16).padStart(64, '0');
    const pubKeyBytes = this.hexToBytes(xHex + yHex);
    const hash = this.keccak256(pubKeyBytes);
    const address = '0x' + this.bytesToHex(hash.slice(12));
    return {
      chain: 'eth',
      type: 'eth',
      address: this.checksumAddress(address),
      balance: 0,
      hasActivity: false,
      checked: false
    };
  }

  private checksumAddress(address: string): string {
    const addr = address.toLowerCase().replace('0x', '');
    const hash = this.bytesToHex(this.keccak256(new TextEncoder().encode(addr)));
    let result = '0x';
    for (let i = 0; i < addr.length; i++) {
      result += parseInt(hash[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
    }
    return result;
  }
}
