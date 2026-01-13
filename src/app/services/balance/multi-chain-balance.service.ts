// src/app/services/balance/multi-chain-balance.service.ts
import { Injectable } from '@angular/core';
import { GeneratedAddress, ChainId } from '../../types/chains';

interface BatchResult {
  [address: string]: { balance: number; hasActivity: boolean };
}

@Injectable({ providedIn: 'root' })
export class MultiChainBalanceService {
  private readonly BTC_APIS = [
    'https://blockstream.info/api',
    'https://mempool.space/api'
  ];
  private readonly ETH_APIS = [
    'https://cloudflare-eth.com',
    'https://eth.llamarpc.com'
  ];
  private readonly SOL_APIS = [
    'https://api.mainnet-beta.solana.com'
  ];
  
  private btcApiIndex = 0;
  private ethApiIndex = 0;

  async checkBatchBTC(addresses: string[]): Promise<BatchResult> {
    const result: BatchResult = {};
    addresses.forEach(a => result[a] = { balance: 0, hasActivity: false });

    if (addresses.length === 0) return result;

    const api = this.BTC_APIS[this.btcApiIndex];
    
    try {
      const checks = addresses.map(async (addr) => {
        try {
          const response = await fetch(`${api}/address/${addr}`, {
            signal: AbortSignal.timeout(8000)
          });
          if (response.ok) {
            const data = await response.json();
            const balance = ((data.chain_stats?.funded_txo_sum || 0) - (data.chain_stats?.spent_txo_sum || 0)) / 1e8;
            const txCount = (data.chain_stats?.tx_count || 0) + (data.mempool_stats?.tx_count || 0);
            result[addr] = { balance, hasActivity: txCount > 0 || balance > 0 };
          }
        } catch {}
      });
      
      await Promise.all(checks);
    } catch {
      this.btcApiIndex = (this.btcApiIndex + 1) % this.BTC_APIS.length;
    }

    return result;
  }

  async checkBatchETH(addresses: string[]): Promise<BatchResult> {
    const result: BatchResult = {};
    addresses.forEach(a => result[a] = { balance: 0, hasActivity: false });

    if (addresses.length === 0) return result;

    const api = this.ETH_APIS[this.ethApiIndex];

    try {
      const checks = addresses.map(async (addr) => {
        try {
          const response = await fetch(api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [addr, 'latest'],
              id: 1
            }),
            signal: AbortSignal.timeout(8000)
          });
          if (response.ok) {
            const data = await response.json();
            if (data.result) {
              const balance = parseInt(data.result, 16) / 1e18;
              result[addr] = { balance, hasActivity: balance > 0 };
            }
          }
        } catch {}
      });

      await Promise.all(checks);
    } catch {
      this.ethApiIndex = (this.ethApiIndex + 1) % this.ETH_APIS.length;
    }

    return result;
  }

  async checkBatchSOL(addresses: string[]): Promise<BatchResult> {
    const result: BatchResult = {};
    addresses.forEach(a => result[a] = { balance: 0, hasActivity: false });

    if (addresses.length === 0) return result;

    try {
      const checks = addresses.map(async (addr) => {
        try {
          const response = await fetch(this.SOL_APIS[0], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getBalance',
              params: [addr]
            }),
            signal: AbortSignal.timeout(8000)
          });
          if (response.ok) {
            const data = await response.json();
            if (data.result?.value !== undefined) {
              const balance = data.result.value / 1e9;
              result[addr] = { balance, hasActivity: balance > 0 };
            }
          }
        } catch {}
      });

      await Promise.all(checks);
    } catch {}

    return result;
  }

  async checkBalance(address: GeneratedAddress): Promise<GeneratedAddress> {
    let result: BatchResult = {};
    
    if (address.chain === 'btc') {
      result = await this.checkBatchBTC([address.address]);
    } else if (address.chain === 'eth') {
      result = await this.checkBatchETH([address.address]);
    } else if (address.chain === 'sol') {
      result = await this.checkBatchSOL([address.address]);
    }

    const data = result[address.address] || { balance: 0, hasActivity: false };
    
    return {
      ...address,
      balance: data.balance,
      hasActivity: data.hasActivity,
      checked: true
    };
  }

  async checkBatch(chain: ChainId, addresses: string[]): Promise<BatchResult> {
    if (chain === 'btc') return this.checkBatchBTC(addresses);
    if (chain === 'eth') return this.checkBatchETH(addresses);
    if (chain === 'sol') return this.checkBatchSOL(addresses);
    return {};
  }
}
