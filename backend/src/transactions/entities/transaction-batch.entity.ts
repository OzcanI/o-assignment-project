import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * One row per idempotency key. Claiming the primary key is what serializes two
 * requests that reuse a key; `requestHash` detects a reused key with a
 * different payload.
 */
@Entity({ name: 'transaction_batches' })
export class TransactionBatch {
  /** The idempotency key. */
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  /** sha256 hex of the canonical item list. */
  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({ name: 'item_count', type: 'integer' })
  itemCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  /** Set once every item of the batch has a persisted final row. */
  @Column({ name: 'completed_at', type: 'timestamptz', precision: 3, nullable: true })
  completedAt: Date | null;
}
