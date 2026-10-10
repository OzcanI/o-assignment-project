import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../common/money/bigint.transformer.js';

@Entity({ name: 'persons' })
@Check('CHK_person_balance_non_negative', '"balance" >= 0')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Balance in cents. */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer })
  balance: bigint;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
