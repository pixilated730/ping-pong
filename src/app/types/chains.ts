// src/app/types/chains.ts
export type ChainId = 'btc' | 'eth' | 'sol';
export type AddressType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr' | 'eth' | 'sol';

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  color: string;
  explorer: string;
}

export interface GeneratedAddress {
  chain: ChainId;
  type: AddressType;
  address: string;
  balance: number;
  hasActivity: boolean;
  checked: boolean;
}

export interface KeyResult {
  privateKeyHex: string;
  privateKeyWif?: string;
  publicKeyCompressed?: string;
  publicKeyUncompressed?: string;
  addresses: GeneratedAddress[];
  hasActivity: boolean;
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  btc: { id: 'btc', name: 'Bitcoin', symbol: 'BTC', color: '#F7931A', explorer: 'https://blockstream.info/address/' },
  eth: { id: 'eth', name: 'Ethereum', symbol: 'ETH', color: '#627EEA', explorer: 'https://etherscan.io/address/' },
  sol: { id: 'sol', name: 'Solana', symbol: 'SOL', color: '#00FFA3', explorer: 'https://solscan.io/account/' }
};

export const ADDRESS_LABELS: Record<AddressType, string> = {
  'p2pkh': 'Legacy (P2PKH)',
  'p2sh-p2wpkh': 'SegWit (P2SH)',
  'p2wpkh': 'Native SegWit',
  'p2tr': 'Taproot',
  'eth': 'Ethereum',
  'sol': 'Solana'
};
