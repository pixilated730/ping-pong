// src/app/services/core/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ChainId } from '../../types/chains';

export interface AppSettings {
  enabledChains: ChainId[];
  autoCheckBalance: boolean;
  keysPerBatch: number;
  checkDelay: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  enabledChains: ['btc', 'eth', 'sol'],
  autoCheckBalance: true,
  keysPerBatch: 10,
  checkDelay: 500
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'cryptic-hunters-settings';
  private settingsSubject = new BehaviorSubject<AppSettings>(this.loadSettings());
  settings$ = this.settingsSubject.asObservable();

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  }

  get settings(): AppSettings {
    return this.settingsSubject.value;
  }

  updateSettings(partial: Partial<AppSettings>): void {
    const updated = { ...this.settings, ...partial };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this.settingsSubject.next(updated);
  }

  toggleChain(chain: ChainId): void {
    const chains = [...this.settings.enabledChains];
    const idx = chains.indexOf(chain);
    if (idx >= 0) {
      if (chains.length > 1) chains.splice(idx, 1);
    } else {
      chains.push(chain);
    }
    this.updateSettings({ enabledChains: chains });
  }

  isChainEnabled(chain: ChainId): boolean {
    return this.settings.enabledChains.includes(chain);
  }

  resetToDefaults(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.settingsSubject.next(DEFAULT_SETTINGS);
  }
}
