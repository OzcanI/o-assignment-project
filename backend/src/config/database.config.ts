import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Bank } from '../bank/bank.entity.js';
import { Person } from '../persons/person.entity.js';
import { TransactionBatch } from '../transactions/entities/transaction-batch.entity.js';
import { Transaction } from '../transactions/entities/transaction.entity.js';
import type { AppConfig } from './configuration.js';

export const ENTITIES = [Bank, Person, TransactionBatch, Transaction];

export function typeOrmOptionsFactory(config: ConfigService<AppConfig, true>): TypeOrmModuleOptions {
  const db = config.get('db', { infer: true });
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    entities: ENTITIES,
    // Assignment requirement. Production would use migrations instead.
    synchronize: true,
    uuidExtension: 'pgcrypto',
    logging: db.logging,
    extra: { max: db.poolSize },
  };
}
