// src/app/services/crypto/solana.service.ts
import { Injectable } from '@angular/core';
import { GeneratedAddress } from '../../types/chains';

@Injectable({ providedIn: 'root' })
export class SolanaService {
  private readonly ED25519_P = BigInt('57896044618658097711785492504343953926634992332820282019728792003956564819949');
  private readonly ED25519_L = BigInt('7237005577332262213973186563042994240857116359379907606001950938285454250989');
  private readonly ED25519_GX = BigInt('15112221349535807912866137220509078935008241517919253862909908495960045058543');
  private readonly ED25519_GY = BigInt('46316835694926478169428394003475163141307993866256225615783033603165251855960');
  private ED25519_D: bigint;

  constructor() {
    this.ED25519_D = BigInt('-121665') * this.modInverse(BigInt('121666'), this.ED25519_P);
  }

  private modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [1n, 0n];
    while (r !== 0n) {
      const q = old_r / r;
      [old_r, r] = [r, old_r - q * r];
      [old_s, s] = [s, old_s - q * s];
    }
    return ((old_s % m) + m) % m;
  }

  private edAdd(p1: [bigint, bigint, bigint, bigint], p2: [bigint, bigint, bigint, bigint]): [bigint, bigint, bigint, bigint] {
    const [x1, y1, z1, t1] = p1;
    const [x2, y2, z2, t2] = p2;
    const a = ((x1 * x2) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const b = ((y1 * y2) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const c = ((t1 * this.ED25519_D * t2) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const d = ((z1 * z2) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const e = (((x1 + y1) * (x2 + y2) - a - b) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const f = ((d - c) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const g = ((d + c) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    const h = ((b - BigInt(-1) * a) % this.ED25519_P + this.ED25519_P) % this.ED25519_P;
    return [
      (e * f) % this.ED25519_P,
      (g * h) % this.ED25519_P,
      (f * g) % this.ED25519_P,
      (e * h) % this.ED25519_P
    ];
  }

  private scalarMult(k: bigint, point: [bigint, bigint, bigint, bigint]): [bigint, bigint, bigint, bigint] {
    let result: [bigint, bigint, bigint, bigint] = [0n, 1n, 1n, 0n];
    let addend = point;
    while (k > 0n) {
      if (k % 2n === 1n) result = this.edAdd(result, addend);
      addend = this.edAdd(addend, addend);
      k = k / 2n;
    }
    return result;
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

  async generateAddress(privateKeyHex: string): Promise<GeneratedAddress> {
    const privKeyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) privKeyBytes[i] = parseInt(privateKeyHex.substr(i * 2, 2), 16);
    const hashBuffer = await crypto.subtle.digest('SHA-512', privKeyBytes);
    const h = new Uint8Array(hashBuffer);
    h[0] &= 248;
    h[31] &= 127;
    h[31] |= 64;
    let scalar = 0n;
    for (let i = 0; i < 32; i++) scalar += BigInt(h[i]) << BigInt(8 * i);
    const G: [bigint, bigint, bigint, bigint] = [this.ED25519_GX, this.ED25519_GY, 1n, (this.ED25519_GX * this.ED25519_GY) % this.ED25519_P];
    const [x, y, z] = this.scalarMult(scalar, G);
    const zInv = this.modInverse(z, this.ED25519_P);
    const xFinal = (x * zInv) % this.ED25519_P;
    const yFinal = (y * zInv) % this.ED25519_P;
    const pubKey = new Uint8Array(32);
    let yBytes = yFinal;
    for (let i = 0; i < 32; i++) {
      pubKey[i] = Number(yBytes & 0xffn);
      yBytes >>= 8n;
    }
    if (xFinal % 2n === 1n) pubKey[31] |= 0x80;
    return {
      chain: 'sol',
      type: 'sol',
      address: this.base58Encode(pubKey),
      balance: 0,
      hasActivity: false,
      checked: false
    };
  }
}
