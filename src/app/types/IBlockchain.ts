
// src/app/types/IBlockchain.ts
export interface IBlockchain {
  final_balance: number;
  confirmed: number;
  unconfirmed: number;
  balance: number;
}

export interface ITransactionResponse {
  _id: string;
  chain: string;
  network: string;
  coinbase: boolean;
  mintIndex: number;
  spentTxid: string;
  mintTxid: string;
  mintHeight: number;
  spentHeight: number;
  address: string;
  script: string;
  value: number;
  confirmations: number;
}
