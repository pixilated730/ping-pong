// src/app/pages/home/home.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AllKeyService } from '../../services/all-key.service';
import { IAllKey } from '../../types/IAllKey';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  tableHeaderColumns: string[] = [
    'privateKey',
    'address',
    'balance',
    'transactions',
    'compressed',
    'balance',
    'transactions',
  ];

  items: IAllKey[] = [];
  processedItems: IAllKey[] = [];
  maxNumber = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140n;
  page = 1n;
  limitPerPage = 4000;
  maxPage = this.maxNumber / BigInt(this.limitPerPage);
  totalBalance = 0;

  isLoadingResults = true;
  isError = false;

  batchProgress = 0;
  totalProgress = 0;
  foundAddresses = 0;

  private subscriptions: Subscription[] = [];

  get isFirstPage(): boolean {
    return this.page === 1n;
  }

  get isLastPage(): boolean {
    return this.page >= this.maxPage;
  }

  constructor(
    private allKeyService: AllKeyService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Subscribe to progress updates
    this.subscriptions.push(
      this.allKeyService.getProgress().subscribe(progress => {
        this.totalProgress = progress;
      })
    );

    this.subscriptions.push(
      this.allKeyService.getBatchProgress().subscribe(progress => {
        this.batchProgress = progress;
      })
    );
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const pageParam = params.get('page') || '1';
      this.page = BigInt(pageParam);
      this.getData();
    });
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getPageDisplay(): string {
    return `${this.page.toString()} of ${this.maxPage.toString()}`;
  }

  onOlder() {
    this.page = this.page - 1n;
    if (this.page <= 0n) {
      this.page = 1n;
    }
    this.router.navigate(['/home'], { queryParams: { page: this.page.toString() } });
  }

  onNewer() {
    this.page = this.page + 1n;
    if (this.page >= this.maxPage) {
      this.page = this.maxPage;
    }
    this.router.navigate(['/home'], { queryParams: { page: this.page.toString() } });
  }

  async getData() {
    try {
      this.isLoadingResults = true;
      this.isError = false;
      this.processedItems = [];
      this.foundAddresses = 0;
      this.totalBalance = 0;

      this.allKeyService.getData(this.page, this.limitPerPage).subscribe({
        next: (batchItems) => {
          // Add new items to processed items
          this.processedItems = [...this.processedItems, ...batchItems];
          this.foundAddresses = this.processedItems.length;
          this.updateBalances();
          this.sortItems();
        },
        error: (error) => {
          console.error('Error processing batches:', error);
          this.isError = true;
          this.isLoadingResults = false;
        },
        complete: () => {
          this.items = this.processedItems;
          this.isLoadingResults = false;
        }
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      this.isError = true;
      this.isLoadingResults = false;
    }
  }

  private updateBalances() {
    let pageTotal = 0;
    for (const item of this.processedItems) {
      pageTotal += (item.addressCompressedBalance || 0) + (item.addressUnCompressedBalance || 0);
    }
    this.totalBalance = pageTotal;
  }

  private sortItems() {
    this.processedItems.sort((a, b) => {
      const aHasBalance = (a.addressCompressedBalance || 0) + (a.addressUnCompressedBalance || 0) > 0;
      const bHasBalance = (b.addressCompressedBalance || 0) + (b.addressUnCompressedBalance || 0) > 0;

      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;

      // If both have no balance, check for transaction history
      if (!aHasBalance && !bHasBalance) {
        const aHasHistory = a.addressCompressedHasTransactions || a.addressUnCompressedHasTransactions;
        const bHasHistory = b.addressCompressedHasTransactions || b.addressUnCompressedHasTransactions;
        if (aHasHistory && !bHasHistory) return -1;
        if (!aHasHistory && bHasHistory) return 1;
      }

      return 0;
    });
  }

  getBalanceClass(balance: number | null | undefined): string {
    if ((balance || 0) > 0) return 'text-green-600 font-semibold';
    return 'text-slate-400';
  }

  getTransactionClass(hasTransactions: boolean | undefined): string {
    return hasTransactions ? 'text-green-600' : 'text-slate-400';
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  getProgressStatus(): string {
    if (this.foundAddresses === 0) {
      return 'Scanning addresses...';
    }
    return `Found ${this.foundAddresses} addresses with activity`;
  }

  shouldShowBatchProgress(): boolean {
    return this.batchProgress > 0 && this.batchProgress < 100;
  }
}
