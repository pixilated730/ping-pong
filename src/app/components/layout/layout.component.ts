// src/app/components/layout/layout.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-layout',
  template: `
    <div class="min-h-screen bg-slate-50 p-4">
      <ng-content></ng-content>
    </div>
  `
})
export class LayoutComponent {}
