import Dexie, { Table } from 'dexie';
import { Transaction } from './types';

export interface LocalTransaction {
  id?: number;
  user_id: string;
  is_synced: 0 | 1; // 0 = pending, 1 = synced
  payload: any;
  created_at: number;
}

export class RegistBarDatabase extends Dexie {
  transactions!: Table<LocalTransaction>;

  constructor() {
    super('RegistBarDB');
    this.version(1).stores({
      transactions: '++id, user_id, is_synced, created_at'
    });
  }
}

export const db = new RegistBarDatabase();
