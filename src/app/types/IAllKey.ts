// src/app/types/IAllKey.ts
export interface IAllKey {
  privateKey: string;
  addressUnCompressed: string;
  addressCompressed: string;
  addressUnCompressedBalance: number;
  addressUnCompressedConfirmed: number;
  addressUnCompressedUnconfirmed: number;
  addressUnCompressedHasTransactions: boolean;
  addressCompressedBalance: number;
  addressCompressedConfirmed: number;
  addressCompressedUnconfirmed: number;
  addressCompressedHasTransactions: boolean;
}
