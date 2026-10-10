import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from '../common/money/bigint.transformer.js';

export const BANK_ID = 1;

/**
 * The single Bank. `CHK_bank_singleton` makes a second row impossible at the
 * schema level. `version` starts at 0 and increments exactly once per
 * successful transfer, in the same UPDATE that credits the balance, so clients
 * can discard out-of-order balance events.
 */
@Entity({ name: 'bank' })
@Check('CHK_bank_singleton', `"id" = ${BANK_ID}`)
@Check('CHK_bank_balance_non_negative', '"balance" >= 0')
export class Bank {
  @PrimaryColumn({ type: 'smallint', default: BANK_ID })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Balance in cents. */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance: bigint;

  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  version: bigint;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
