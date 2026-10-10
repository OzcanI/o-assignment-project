import { formatCents } from '../common/money/money.js';
import type { FailureReason, Transaction, TransactionStatus } from './entities/transaction.entity.js';

/** Wire format for GET /api/transactions. */
export interface TransactionPayload {
  id: string;
  batchId: string;
  itemIndex: number;
  personId: string;
  amount: string;
  status: TransactionStatus;
  failureReason: FailureReason | null;
  durationMs: number;
  createdAt: string;
}

export type StoredTransaction = Pick<
  Transaction,
  'id' | 'batchId' | 'itemIndex' | 'personId' | 'amount' | 'status' | 'failureReason' | 'durationMs' | 'createdAt'
>;

/** Maps a raw `RETURNING *` row (snake_case, int8 as string) to the entity shape. */
export function fromRawRow(row: Record<string, unknown>): StoredTransaction {
  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    itemIndex: row.item_index as number,
    personId: row.person_id as string,
    amount: BigInt(row.amount as string),
    status: row.status as TransactionStatus,
    failureReason: (row.failure_reason as FailureReason | null) ?? null,
    durationMs: row.duration_ms as number,
    createdAt: row.created_at as Date,
  };
}

export function toTransactionPayload(tx: StoredTransaction): TransactionPayload {
  return {
    id: tx.id,
    batchId: tx.batchId,
    itemIndex: tx.itemIndex,
    personId: tx.personId,
    amount: formatCents(tx.amount),
    status: tx.status,
    failureReason: tx.failureReason,
    durationMs: tx.durationMs,
    createdAt: tx.createdAt.toISOString(),
  };
}
