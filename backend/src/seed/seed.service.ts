import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BANK_ID } from '../bank/bank.entity.js';
import { parseAmountToCents } from '../common/money/money.js';
import { Person } from '../persons/person.entity.js';

/** Arbitrary constant identifying the seed lock in pg_advisory_xact_lock. */
const SEED_LOCK_KEY = 7_420_001;

export const SEED_BANK_NAME = 'A Bank';

export const SEED_PERSONS: ReadonlyArray<{ name: string; balance: string }> = [
  { name: 'Alice Johnson', balance: '1000.00' },
  { name: 'Bob Smith', balance: '2500.00' },
  { name: 'Carol Williams', balance: '500.00' },
  { name: 'David Brown', balance: '750.50' },
  { name: 'Eve Davis', balance: '10000.00' },
  { name: 'Frank Miller', balance: '50.00' },
  { name: 'Grace Wilson', balance: '3200.00' },
  { name: 'Henry Moore', balance: '120.00' },
];

/**
 * Seeds the singleton Bank and the predefined Persons on first start.
 *
 * TypeORM's `synchronize` runs while the DataSource initializes, before
 * `onApplicationBootstrap`, so the tables exist here. The advisory lock
 * serializes concurrently starting instances, and Persons are only inserted by
 * the run that actually created the Bank, so restarts never duplicate data.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const seeded = await this.seed();
    this.logger.log(seeded ? 'Seeded Bank and Persons' : 'Seed data already present, skipping');
  }

  /** Returns true when this call inserted the seed data. */
  async seed(): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_KEY]);

      const inserted: unknown[] = await manager.query(
        `INSERT INTO bank (id, name, balance, version)
         VALUES ($1, $2, 0, 0)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [BANK_ID, SEED_BANK_NAME],
      );
      if (inserted.length === 0) return false;

      await manager.insert(
        Person,
        SEED_PERSONS.map((p) => ({ name: p.name, balance: parseAmountToCents(p.balance) })),
      );
      return true;
    });
  }
}
