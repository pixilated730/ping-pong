import { Injectable } from '@angular/core';
import { IAllKey } from '../types/IAllKey';

declare var Bitcoin: { ECKey: new (arg0: any) => any },
  Crypto: { util: { hexToBytes: (arg0: string) => any } };

@Injectable({
  providedIn: 'root',
})
export class AllKeyService {
  getData(page: bigint, limitPerPage: number): IAllKey[] {
    const items: IAllKey[] = [];
    const addresses: string[] = [];

    for (let index = 0; index < limitPerPage; index++) {
      let privateKey = (
        (page - 1n) * BigInt(limitPerPage) +
        BigInt(index) +
        1n
      ).toString(16);

      if (privateKey.length % 2 !== 0) {
        privateKey = '0' + privateKey;
      }

      const addressUnCompressed = this.getAddress(privateKey, false);
      const addressCompressed = this.getAddress(privateKey, true);
      const wifPrivateKey = this.getPrivateKey(privateKey);

      addresses.push(addressUnCompressed);
      addresses.push(addressCompressed);

      items.push({
        id: privateKey,
        privateKey: wifPrivateKey,
        addressUnCompressed,
        addressUnCompressedBalance: null,
        addressUnCompressedReceived: null,
        addressCompressed,
        addressCompressedBalance: null,
        addressCompressedReceived: null,
      });
    }
    return items;
  }

  private getAddress(privateKey: string, compressed: boolean) {
    const bytes = Crypto.util.hexToBytes(privateKey);
    const btcKey = new Bitcoin.ECKey(bytes);
    btcKey.compressed = false; // Always use uncompressed format for this era
    return btcKey.getBitcoinAddress().toString();
  }

  private getPrivateKey(privateKey: string) {
    const bytes = Crypto.util.hexToBytes(privateKey);
    const btcKey = new Bitcoin.ECKey(bytes);
    btcKey.compressed = false; // Ensure WIF starts with '5'
    return btcKey.getExportedPrivateKey();
  }
}
