// src/app/services/balance.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, retry, delay } from 'rxjs/operators';
import { IAddressData } from '../types/IAddressData';

@Injectable({
  providedIn: 'root'
})
export class BalanceService {
  private readonly memPoolUrl = 'https://mempool.cakewallet.com/api/address';
  private requestCount = 0;
  private readonly requestLimit = 300000;
  private readonly delayMs = 1;

  constructor(private http: HttpClient) {}

  getAddressInfo(address: string): Observable<IAddressData> {
    this.requestCount++;

    return this.http.get<any>(`${this.memPoolUrl}/${address}`).pipe(
      delay(this.requestCount >= this.requestLimit ? this.delayMs : 0),
      map(response => {
        const chainStats = response.chain_stats || {};
        const mempoolStats = response.mempool_stats || {};

        const balance = (chainStats.funded_txo_sum || 0) - (chainStats.spent_txo_sum || 0);
        const unconfirmed = (mempoolStats.funded_txo_sum || 0) - (mempoolStats.spent_txo_sum || 0);

        if (this.requestCount >= this.requestLimit) {
          this.requestCount = 0;
        }

        return {
          balance: balance / 100000000,
          confirmed: balance / 100000000,
          unconfirmed: unconfirmed / 100000000,
          hasTransactions: (chainStats.tx_count || 0) > 0 ||
                         (mempoolStats.tx_count || 0) > 0 ||
                         (chainStats.funded_txo_count || 0) > 0
        };
      }),
      retry(3),
      catchError((error: HttpErrorResponse) => {
        console.error('An error occurred:', error);
        return throwError(() => error);
      })
    );
  }
}
