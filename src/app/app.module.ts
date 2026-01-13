// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { LayoutComponent } from './components/layout/layout.component';
import { ChainBadgeComponent } from './components/chain-badge/chain-badge.component';
import { ExplorerComponent } from './pages/explorer/explorer.component';
import { ImportComponent } from './pages/import/import.component';

const routes: Routes = [
  { path: '', redirectTo: '/explorer', pathMatch: 'full' },
  { path: 'explorer', component: ExplorerComponent },
  { path: 'import', component: ImportComponent }
];

@NgModule({
  declarations: [
    AppComponent,
    LayoutComponent,
    ChainBadgeComponent,
    ExplorerComponent,
    ImportComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
