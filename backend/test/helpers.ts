import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import { DataSource } from 'typeorm';

/**
 * E2E tests run against a dedicated database that is dropped and recreated
 * empty for every run, so the first app boot exercises synchronize + seed.
 * Defaults match docker-compose (`docker compose up -d postgres`).
 */
export const E2E_DB = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'bank',
  password: process.env.DB_PASSWORD ?? 'bank',
  database: process.env.E2E_DB_NAME ?? 'bank_e2e',
};

export async function recreateDatabase(): Promise<void> {
  const client = new pg.Client({ ...E2E_DB, database: 'postgres' });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${E2E_DB.database}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${E2E_DB.database}"`);
  } finally {
    await client.end();
  }
}

/**
 * Boots the real AppModule with the same pipeline as main.ts. Env is set
 * before AppModule is imported because config is read at import time.
 */
export async function createApp() {
  process.env.DB_HOST = E2E_DB.host;
  process.env.DB_PORT = String(E2E_DB.port);
  process.env.DB_USER = E2E_DB.user;
  process.env.DB_PASSWORD = E2E_DB.password;
  process.env.DB_NAME = E2E_DB.database;
  process.env.TX_CONCURRENCY ??= '8';
  process.env.DB_POOL_SIZE ??= '10';

  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/app.setup.js');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}
