import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'balance',
})
export class BalancePipe implements PipeTransform {
  transform(value: number | null) {
    return value !== null
      ? parseFloat(value.toString()) / Math.pow(10, 8) + ' BTC'
      : 'Loading...';
  }
}
