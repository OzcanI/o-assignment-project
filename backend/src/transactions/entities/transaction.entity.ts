import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { bigintTransformer } from '../../common/money/bigint.transformer.js';
import { Person } from '../../persons/person.entity.js';
import { TransactionBatch } from './transaction-batch.entity.js';

export enum TransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum FailureReason {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PERSON_NOT_FOUND = 'PERSON_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * The final, persisted result of one batch item. `UQ_transactions_batch_item`
 * guarantees at most one row per item, whatever its status; that row is the
 * result of record for retries with the same idempotency key.
 */
@Entity({ name: 'transactions' })
@Unique('UQ_transactions_batch_item', ['batchId', 'itemIndex'])
@Index('IDX_transactions_created_at_id', ['createdAt', 'id'])
export class Transaction {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @ManyToOne(() => TransactionBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id' })
  batch?: Relation<TransactionBatch>;

  @Column({ name: 'item_index', type: 'integer' })
  itemIndex: number;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  /** No FK: a FAILED row must be storable for a personId that does not exist. */
  @ManyToOne(() => Person, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'person_id' })
  person?: Relation<Person> | null;

  /** Amount in cents. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
  amount: bigint;

  @Column({ type: 'enum', enum: TransactionStatus, enumName: 'transaction_status' })
  status: TransactionStatus;

  @Column({ name: 'failure_reason', type: 'varchar', length: 32, nullable: true })
  failureReason: FailureReason | null;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  /**
   * Millisecond precision so that server ordering (created_at DESC, id DESC)
   * matches the ISO timestamps the client sorts by.
   */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    precision: 3,
    default: () => 'clock_timestamp()',
  })
  createdAt: Date;
}
