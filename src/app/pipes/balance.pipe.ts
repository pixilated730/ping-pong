
// src/app/pipes/balance.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'balance'
})
export class BalancePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    const balance = value || 0;
    return balance.toFixed(8);
  }
}

