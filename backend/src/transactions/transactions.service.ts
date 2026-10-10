import { randomUUID } from 'node:crypto';
import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BANK_ID } from '../bank/bank.entity.js';
import { BankService } from '../bank/bank.service.js';
import { createLimiter, type Limiter } from '../common/concurrency-limiter.js';
import { formatCents, parseAmountToCents } from '../common/money/money.js';
import { isUniqueViolation } from '../common/pg-errors.js';
import { hashBatchRequest } from '../common/request-hash.js';
import type { AppConfig } from '../config/configuration.js';
import type { CreateTransactionsDto } from './dto/create-transactions.dto.js';
import { FailureReason, Transaction, TransactionStatus } from './entities/transaction.entity.js';
import { fromRawRow, type StoredTransaction } from './transaction.mapper.js';

const UNIQUE_ITEM_CONSTRAINT = 'UQ_transactions_batch_item';

interface BatchItem {
  itemIndex: number;
  personId: string;
  amount: bigint;
}

export interface ItemResult {
  itemIndex: number;
  /** null only when the FAILED row could not be persisted (`recorded: false`). */
  transactionId: string | null;
  personId: string;
  amount: string;
  status: TransactionStatus;
  failureReason: FailureReason | null;
  durationMs: number;
  /** The result was already stored by an earlier request with the same Idempotency-Key. */
  duplicate: boolean;
  /** Whether a final row exists in the database for this item. */
  recorded: boolean;
}

/** Whole-batch stats. */
export interface BatchStats {
  batchId: string;
  total: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  durationMs: number;
}

export interface BatchResponse extends BatchStats {
  bankBalance: string;
  bankVersion: string;
  results: ItemResult[];
}

/** Business rejection; thrown inside the DB transaction to roll it back. */
class TransferRejectedError extends Error {
  constructor(readonly reason: FailureReason.INSUFFICIENT_FUNDS | FailureReason.PERSON_NOT_FOUND) {
    super(reason);
  }
}

const elapsedMs = (startedAt: number) => Math.round(performance.now() - startedAt);

function toItemResult(
  tx: StoredTransaction,
  flags: Pick<ItemResult, 'duplicate' | 'recorded'>,
): ItemResult {
  return {
    itemIndex: tx.itemIndex,
    transactionId: tx.id,
    personId: tx.personId,
    amount: formatCents(tx.amount),
    status: tx.status,
    failureReason: tx.failureReason,
    durationMs: tx.durationMs,
    ...flags,
  };
}

/**
 * Processes batches of Person -> Bank transfers.
 *
 * Every item runs in its own DB transaction (debit Person, insert SUCCESS row,
 * credit Bank last) so a failing item never affects the others. The persisted
 * row per (batchId, itemIndex) is the result of record: whichever request loses
 * a uniqueness race returns the stored row instead of applying the transfer
 * again.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  /** Shared across requests so concurrent batches together stay below the pool size. */
  private readonly limit: Limiter;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    private readonly bankService: BankService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.limit = createLimiter(config.get('txConcurrency', { infer: true }));
  }

  async processBatch(dto: CreateTransactionsDto, idempotencyKey?: string): Promise<BatchResponse> {
    const startedAt = performance.now();
    const batchId = idempotencyKey ?? randomUUID();
    const items: BatchItem[] = dto.transactions.map((t, itemIndex) => ({
      itemIndex,
      personId: t.personId.toLowerCase(),
      amount: parseAmountToCents(t.amount),
    }));

    await this.claimBatch(batchId, items);
    const stored = await this.findStoredRows(batchId);

    const results = await Promise.all(
      items.map((item) => {
        const row = stored.get(item.itemIndex);
        return row
          ? toItemResult(row, { duplicate: true, recorded: true })
          : this.limit(() => this.processItem(batchId, item));
      }),
    );

    // The request hash guarantees `items` is the whole batch, so these are whole-batch stats.
    const stats: BatchStats = {
      batchId,
      total: results.length,
      successCount: results.filter((r) => r.status === TransactionStatus.SUCCESS).length,
      failureCount: results.filter((r) => r.status === TransactionStatus.FAILED).length,
      duplicateCount: results.filter((r) => r.duplicate).length,
      durationMs: elapsedMs(startedAt),
    };

    if (results.every((r) => r.recorded)) {
      await this.dataSource.query(
        `UPDATE transaction_batches SET completed_at = clock_timestamp()
         WHERE id = $1 AND completed_at IS NULL`,
        [batchId],
      );
    }

    const bank = await this.bankService.getBank();
    return {
      ...stats,
      bankBalance: formatCents(bank.balance),
      bankVersion: bank.version.toString(),
      results,
    };
  }

  findRecent(limit: number): Promise<Transaction[]> {
    return this.transactions.find({ order: { createdAt: 'DESC', id: 'DESC' }, take: limit });
  }

  /**
   * Claims the idempotency key. The primary key lets exactly one request create
   * the batch; any other request with the same key must carry the same payload.
   */
  private async claimBatch(batchId: string, items: BatchItem[]): Promise<void> {
    const requestHash = hashBatchRequest(
      items.map((i) => ({ personId: i.personId, amountCents: i.amount })),
    );
    const inserted: unknown[] = await this.dataSource.query(
      `INSERT INTO transaction_batches (id, request_hash, item_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [batchId, requestHash, items.length],
    );
    if (inserted.length > 0) return;

    const [existing]: Array<{ request_hash: string }> = await this.dataSource.query(
      'SELECT request_hash FROM transaction_batches WHERE id = $1',
      [batchId],
    );
    if (existing?.request_hash !== requestHash) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used with a different request payload',
      );
    }
  }

  private async findStoredRows(batchId: string): Promise<Map<number, Transaction>> {
    const rows = await this.transactions.find({ where: { batchId } });
    return new Map(rows.map((row) => [row.itemIndex, row]));
  }

  /** Never throws: every outcome, including infrastructure errors, becomes an ItemResult. */
  private async processItem(batchId: string, item: BatchItem): Promise<ItemResult> {
    const startedAt = performance.now();
    const id = randomUUID();

    let createdAt: Date;
    try {
      createdAt = await this.dataSource.transaction((manager) =>
        this.transfer(manager, batchId, id, item, startedAt),
      );
    } catch (err) {
      const durationMs = elapsedMs(startedAt);
      if (isUniqueViolation(err, UNIQUE_ITEM_CONSTRAINT)) {
        return this.resolveFromStoredRow(batchId, item, durationMs);
      }
      if (err instanceof TransferRejectedError) {
        return this.recordFailure(batchId, id, item, err.reason, durationMs);
      }
      this.logger.error(
        `Transfer failed unexpectedly (batch ${batchId}, item ${item.itemIndex})`,
        err instanceof Error ? err.stack : String(err),
      );
      return this.recordFailure(batchId, id, item, FailureReason.INTERNAL_ERROR, durationMs);
    }

    const durationMs = elapsedMs(startedAt);

    // The row was inserted before the Bank credit and commit, so it holds a
    // provisional duration; replace it with the full one (best effort).
    await this.dataSource
      .query('UPDATE transactions SET duration_ms = $1 WHERE id = $2', [durationMs, id])
      .catch((err: unknown) => this.logger.warn(`Could not update duration for ${id}: ${String(err)}`));

    const tx: StoredTransaction = {
      id,
      batchId,
      itemIndex: item.itemIndex,
      personId: item.personId,
      amount: item.amount,
      status: TransactionStatus.SUCCESS,
      failureReason: null,
      durationMs,
      createdAt,
    };
    return toItemResult(tx, { duplicate: false, recorded: true });
  }

  /**
   * One transfer inside one DB transaction. Lock order is always Person row,
   * then the unique index entry, then the Bank row, so no deadlock cycle is
   * possible. The Bank (the single hot row) is touched last to keep its lock
   * held for as short as possible.
   */
  private async transfer(
    manager: EntityManager,
    batchId: string,
    id: string,
    item: BatchItem,
    startedAt: number,
  ): Promise<Date> {
    const amount = item.amount.toString();

    // Atomic conditional debit: no read-modify-write, no lost updates, no overdraft.
    const [debited]: [unknown[], number] = await manager.query(
      `UPDATE persons SET balance = balance - $1
       WHERE id = $2 AND balance >= $1
       RETURNING id`,
      [amount, item.personId],
    );
    if (debited.length === 0) {
      const exists: unknown[] = await manager.query('SELECT 1 FROM persons WHERE id = $1', [
        item.personId,
      ]);
      throw new TransferRejectedError(
        exists.length > 0 ? FailureReason.INSUFFICIENT_FUNDS : FailureReason.PERSON_NOT_FOUND,
      );
    }

    // A duplicate (same batchId + itemIndex) fails here, before the Bank row is locked.
    const [inserted]: Array<{ created_at: Date }> = await manager.query(
      `INSERT INTO transactions (id, batch_id, item_index, person_id, amount, status, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING created_at`,
      [id, batchId, item.itemIndex, item.personId, amount, TransactionStatus.SUCCESS, elapsedMs(startedAt)],
    );

    const [credited]: [unknown[], number] = await manager.query(
      `UPDATE bank SET balance = balance + $1, version = version + 1, updated_at = clock_timestamp()
       WHERE id = $2
       RETURNING id`,
      [amount, BANK_ID],
    );
    if (credited.length === 0) {
      throw new Error('Bank row is missing');
    }

    return inserted.created_at;
  }

  /**
   * Persists a FAILED row outside the rolled-back transaction, so the rollback
   * cannot erase it. If another request already stored this item's final row,
   * that row is returned instead.
   */
  private async recordFailure(
    batchId: string,
    id: string,
    item: BatchItem,
    reason: FailureReason,
    durationMs: number,
  ): Promise<ItemResult> {
    try {
      const rows: Array<Record<string, unknown>> = await this.dataSource.query(
        `INSERT INTO transactions
           (id, batch_id, item_index, person_id, amount, status, failure_reason, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ON CONSTRAINT "${UNIQUE_ITEM_CONSTRAINT}" DO NOTHING
         RETURNING *`,
        [
          id,
          batchId,
          item.itemIndex,
          item.personId,
          item.amount.toString(),
          TransactionStatus.FAILED,
          reason,
          durationMs,
        ],
      );
      if (rows.length === 0) {
        return this.resolveFromStoredRow(batchId, item, durationMs);
      }
      const tx = fromRawRow(rows[0]);
      return toItemResult(tx, { duplicate: false, recorded: true });
    } catch (err) {
      this.logger.error(
        `Could not record FAILED result (batch ${batchId}, item ${item.itemIndex}, reason ${reason})`,
        err instanceof Error ? err.stack : String(err),
      );
      return this.unrecordedFailure(item, reason, durationMs);
    }
  }

  /** Returns the stored row for an item that another request already finalized. */
  private async resolveFromStoredRow(
    batchId: string,
    item: BatchItem,
    durationMs: number,
  ): Promise<ItemResult> {
    try {
      const row = await this.transactions.findOneBy({ batchId, itemIndex: item.itemIndex });
      if (row) return toItemResult(row, { duplicate: true, recorded: true });
      this.logger.error(`Expected a stored row for batch ${batchId}, item ${item.itemIndex}`);
    } catch (err) {
      this.logger.error(
        `Could not load stored row (batch ${batchId}, item ${item.itemIndex})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    return this.unrecordedFailure(item, FailureReason.INTERNAL_ERROR, durationMs);
  }

  private unrecordedFailure(item: BatchItem, reason: FailureReason, durationMs: number): ItemResult {
    return {
      itemIndex: item.itemIndex,
      transactionId: null,
      personId: item.personId,
      amount: formatCents(item.amount),
      status: TransactionStatus.FAILED,
      failureReason: reason,
      durationMs,
      duplicate: false,
      recorded: false,
    };
  }
}
