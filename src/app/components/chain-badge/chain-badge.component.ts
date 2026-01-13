// src/app/components/chain-badge/chain-badge.component.ts
import { Component, Input } from '@angular/core';
import { ChainId, CHAINS } from '../../types/chains';

@Component({
  selector: 'app-chain-badge',
  template: `
    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium" [style.background-color]="bgColor" [style.color]="textColor">
      <span class="w-1.5 h-1.5 rounded-full" [style.background-color]="dotColor"></span>
      {{ chain?.symbol || chainId.toUpperCase() }}
    </span>
  `
})
export class ChainBadgeComponent {
  @Input() chainId!: ChainId;

  get chain() {
    return CHAINS[this.chainId];
  }

  get bgColor() {
    return this.chain?.color + '20' || '#52525b20';
  }

  get textColor() {
    return this.chain?.color || '#a1a1aa';
  }

  get dotColor() {
    return this.chain?.color || '#71717a';
  }
}
