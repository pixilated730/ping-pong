// src/app/services/all-key.service.ts
import { Injectable } from '@angular/core';
import { Observable, forkJoin, from, BehaviorSubject } from 'rxjs';
import { map, concatMap, tap, bufferCount } from 'rxjs/operators';
import { IAllKey } from '../types/IAllKey';
import { BalanceService } from './balance.service';

declare global {
  interface Window {
    Bitcoin: any;
    Crypto: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AllKeyService {
  private readonly BATCH_SIZE = 600;
  private progress$ = new BehaviorSubject<number>(0);
  private batchProgress$ = new BehaviorSubject<number>(0);

  constructor(private balanceService: BalanceService) {}

  getProgress(): Observable<number> {
    return this.progress$.asObservable();
  }

  getBatchProgress(): Observable<number> {
    return this.batchProgress$.asObservable();
  }

  getData(page: bigint, limitPerPage: number): Observable<IAllKey[]> {
    // Reset progress
    this.progress$.next(0);
    this.batchProgress$.next(0);

    const allKeys = this.generateKeys(page, limitPerPage);
    const batches = this.splitIntoBatches(allKeys, this.BATCH_SIZE);
    const totalBatches = batches.length;

    return from(batches).pipe(
      concatMap((batch, index) =>
        this.processBatch(batch).pipe(
          tap(() => {
            const progress = ((index + 1) / totalBatches) * 100;
            this.progress$.next(progress);
          })
        )
      ),
      bufferCount(1),
      map(batchResults => {
        // Now TypeScript knows these properties are definitely numbers/booleans
        return batchResults.flat().filter(item =>
          item.addressCompressedBalance > 0 ||
          item.addressUnCompressedBalance > 0 ||
          item.addressCompressedHasTransactions ||
          item.addressUnCompressedHasTransactions
        );
      })
    );
  }

  private generateKeys(page: bigint, limitPerPage: number): IAllKey[] {
    const items: IAllKey[] = [];

    for (let index = 0; index < limitPerPage; index++) {
      let privateKey = (
        (page - 1n) * BigInt(limitPerPage) +
        BigInt(index) +
        1n
      ).toString(16);

      if (privateKey.length % 2 !== 0) {
        privateKey = '0' + privateKey;
      }

      try {
        const addressUnCompressed = this.getAddress(privateKey, false);
        const addressCompressed = this.getAddress(privateKey, true);
        const wifPrivateKey = this.getPrivateKey(privateKey);

        if (addressUnCompressed && addressCompressed && wifPrivateKey) {
          items.push({
            privateKey: wifPrivateKey,
            addressUnCompressed,
            addressCompressed,
            addressUnCompressedBalance: 0,
            addressUnCompressedConfirmed: 0,
            addressUnCompressedUnconfirmed: 0,
            addressUnCompressedHasTransactions: false,
            addressCompressedBalance: 0,
            addressCompressedConfirmed: 0,
            addressCompressedUnconfirmed: 0,
            addressCompressedHasTransactions: false
          });
        }
      } catch (error) {
        console.error('Error generating key data:', error);
      }
    }

    return items;
  }

  private processBatch(batch: IAllKey[]): Observable<IAllKey[]> {
    let processedCount = 0;
    const totalInBatch = batch.length;

    return forkJoin(
      batch.map(item =>
        forkJoin({
          compressed: this.balanceService.getAddressInfo(item.addressCompressed),
          uncompressed: this.balanceService.getAddressInfo(item.addressUnCompressed)
        }).pipe(
          tap(() => {
            processedCount++;
            const batchProgress = (processedCount / totalInBatch) * 100;
            this.batchProgress$.next(batchProgress);
          }),
          map(({ compressed, uncompressed }) => ({
            ...item,
            addressCompressedBalance: compressed.balance,
            addressCompressedConfirmed: compressed.confirmed,
            addressCompressedUnconfirmed: compressed.unconfirmed,
            addressCompressedHasTransactions: compressed.hasTransactions,
            addressUnCompressedBalance: uncompressed.balance,
            addressUnCompressedConfirmed: uncompressed.confirmed,
            addressUnCompressedUnconfirmed: uncompressed.unconfirmed,
            addressUnCompressedHasTransactions: uncompressed.hasTransactions
          }))
        )
      )
    );
  }

  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private getAddress(privateKey: string, compressed: boolean): string {
    try {
      const bytes = window.Crypto.util.hexToBytes(privateKey);
      const btcKey = new window.Bitcoin.ECKey(bytes);
      btcKey.compressed = compressed;
      return btcKey.getBitcoinAddress().toString();
    } catch (error) {
      console.error('Error generating address:', error);
      return '';
    }
  }

  private getPrivateKey(privateKey: string): string {
    try {
      const bytes = window.Crypto.util.hexToBytes(privateKey);
      const btcKey = new window.Bitcoin.ECKey(bytes);
      btcKey.compressed = false;
      return btcKey.getExportedPrivateKey();
    } catch (error) {
      console.error('Error generating private key:', error);
      return '';
    }
  }
}
