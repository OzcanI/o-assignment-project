import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { parseAmountToCents } from '../src/common/money/money.js';
import { hashBatchRequest } from '../src/common/request-hash.js';
import { SEED_PERSONS, SeedService } from '../src/seed/seed.service.js';
import type { BatchResponse } from '../src/transactions/transactions.service.js';
import { createApp, recreateDatabase } from './helpers.js';

type Transfer = { personId: string; amount: string };

interface DbState {
  persons: Map<string, bigint>;
  bank: { balance: bigint; version: bigint };
}

const UNKNOWN_PERSON = '00000000-0000-4000-8000-000000000000';

let app: INestApplication;
let ds: DataSource;
let personIds: Record<string, string>;

async function readState(): Promise<DbState> {
  const persons: Array<{ id: string; balance: string }> = await ds.query('SELECT id, balance FROM persons');
  const [bank]: Array<{ balance: string; version: string }> = await ds.query('SELECT balance, version FROM bank');
  return {
    persons: new Map(persons.map((p) => [p.id, BigInt(p.balance)])),
    bank: { balance: BigInt(bank.balance), version: BigInt(bank.version) },
  };
}

const totalMoney = (s: DbState) => [...s.persons.values()].reduce((a, b) => a + b, 0n) + s.bank.balance;

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const [row]: Array<{ count: number }> = await ds.query(sql, params);
  return row.count;
}

async function setBalance(personId: string, amount: string) {
  await ds.query('UPDATE persons SET balance = $1 WHERE id = $2', [parseAmountToCents(amount).toString(), personId]);
}

function post(transactions: unknown, idempotencyKey?: string) {
  const req = request(app.getHttpServer()).post('/api/transactions').send({ transactions });
  return idempotencyKey ? req.set('Idempotency-Key', idempotencyKey) : req;
}

/** Deterministic pseudo-random generator so the mixed batch is reproducible. */
function lcg(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

beforeAll(async () => {
  await recreateDatabase();
  ({ app, dataSource: ds } = await createApp());
  const rows: Array<{ id: string; name: string }> = await ds.query('SELECT id, name FROM persons');
  personIds = Object.fromEntries(rows.map((r) => [r.name.split(' ')[0].toLowerCase(), r.id]));
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await ds.query('TRUNCATE transactions, transaction_batches');
  for (const p of SEED_PERSONS) {
    await ds.query('UPDATE persons SET balance = $1 WHERE name = $2', [
      parseAmountToCents(p.balance).toString(),
      p.name,
    ]);
  }
  await ds.query('UPDATE bank SET balance = 0, version = 0');
});

describe('seeding', () => {
  it('creates exactly one Bank and the predefined Persons on an empty database', async () => {
    expect(await count('SELECT count(*)::int AS count FROM bank')).toBe(1);
    expect(await count('SELECT count(*)::int AS count FROM persons')).toBe(SEED_PERSONS.length);
  });

  it('is idempotent, including concurrent runs and a full app restart', async () => {
    const seed = app.get(SeedService);
    expect(await Promise.all([seed.seed(), seed.seed(), seed.seed()])).toEqual([false, false, false]);

    const second = await createApp();
    await second.app.close();

    expect(await count('SELECT count(*)::int AS count FROM bank')).toBe(1);
    expect(await count('SELECT count(*)::int AS count FROM persons')).toBe(SEED_PERSONS.length);
  });

  it('rejects a second Bank row at the schema level', async () => {
    await expect(ds.query(`INSERT INTO bank (id, name) VALUES (2, 'Other')`)).rejects.toThrow(/CHK_bank_singleton/);
  });
});

describe('POST /api/transactions: concurrency invariants', () => {
  it('keeps money conserved and balances consistent for a large concurrent mixed batch', async () => {
    const random = lcg(42);
    const ids = Object.values(personIds);
    const amounts = ['0.01', '1.99', '25.00', '99.99', '150.50', '400.00', '1234.56'];
    const transfers: Transfer[] = Array.from({ length: 200 }, () => ({
      personId: random() < 0.05 ? UNKNOWN_PERSON : ids[Math.floor(random() * ids.length)],
      amount: amounts[Math.floor(random() * amounts.length)],
    }));

    const before = await readState();
    const res = await post(transfers).expect(200);
    const body = res.body as BatchResponse;
    const after = await readState();

    const successRows: Array<{ person_id: string; amount: string }> = await ds.query(
      `SELECT person_id, amount FROM transactions WHERE batch_id = $1 AND status = 'SUCCESS'`,
      [body.batchId],
    );
    const successSum = successRows.reduce((sum, r) => sum + BigInt(r.amount), 0n);

    expect(body.successCount).toBeGreaterThan(0);
    expect(body.failureCount).toBeGreaterThan(0);
    expect(body.results).toHaveLength(200);
    expect(body.results.every((r) => r.recorded && !r.duplicate)).toBe(true);
    expect(body.successCount).toBe(successRows.length);

    // Money is conserved.
    expect(totalMoney(after)).toBe(totalMoney(before));
    // The Bank grew by exactly the sum of successful amounts.
    expect(after.bank.balance - before.bank.balance).toBe(successSum);
    // Each Person lost exactly the sum of their successful amounts; failed transfers changed nothing.
    for (const [id, balanceBefore] of before.persons) {
      const theirs = successRows.filter((r) => r.person_id === id).reduce((s, r) => s + BigInt(r.amount), 0n);
      expect(balanceBefore - after.persons.get(id)!).toBe(theirs);
    }
    // No overdraft.
    for (const balance of after.persons.values()) expect(balance >= 0n).toBe(true);
    // Exactly one final row per item.
    expect(
      await count('SELECT count(DISTINCT item_index)::int AS count FROM transactions WHERE batch_id = $1', [body.batchId]),
    ).toBe(200);
    expect(await count('SELECT count(*)::int AS count FROM transactions WHERE batch_id = $1', [body.batchId])).toBe(200);
    // Version increments exactly once per successful transfer.
    expect(after.bank.version - before.bank.version).toBe(BigInt(successRows.length));
  });

  it('never overdraws when the same Person is repeated within one batch', async () => {
    const carol = personIds.carol;
    await setBalance(carol, '100.00');

    const res = await post(Array.from({ length: 10 }, () => ({ personId: carol, amount: '30.00' }))).expect(200);
    const body = res.body as BatchResponse;

    expect(body.successCount).toBe(3);
    expect(body.failureCount).toBe(7);
    expect(body.results.filter((r) => r.failureReason === 'INSUFFICIENT_FUNDS')).toHaveLength(7);
    const after = await readState();
    expect(after.persons.get(carol)).toBe(1000n);
    expect(after.bank.balance).toBe(9000n);
  });

  it('records a FAILED row for an unknown personId', async () => {
    const res = await post([{ personId: UNKNOWN_PERSON, amount: '1.00' }]).expect(200);
    const [result] = (res.body as BatchResponse).results;

    expect(result).toMatchObject({ status: 'FAILED', failureReason: 'PERSON_NOT_FOUND', recorded: true });
    const rows: Array<{ status: string; person_id: string }> = await ds.query(
      'SELECT status, person_id FROM transactions WHERE id = $1',
      [result.transactionId],
    );
    expect(rows).toEqual([{ status: 'FAILED', person_id: UNKNOWN_PERSON }]);
  });
});

describe('POST /api/transactions: idempotency', () => {
  it('applies a batch once when two requests with the same key race', async () => {
    const { alice, frank } = personIds;
    await setBalance(frank, '15.00');
    const transfers: Transfer[] = [
      ...Array.from({ length: 10 }, () => ({ personId: alice, amount: '10.00' })),
      { personId: frank, amount: '10.00' },
      { personId: frank, amount: '10.00' },
    ];
    const key = randomUUID();
    const before = await readState();

    const [a, b] = await Promise.all([post(transfers, key), post(transfers, key)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const after = await readState();

    expect(after.persons.get(alice)! - before.persons.get(alice)!).toBe(-10000n);
    expect(after.persons.get(frank)! - before.persons.get(frank)!).toBe(-1000n);
    expect(after.bank.balance - before.bank.balance).toBe(11000n);
    expect(after.bank.version - before.bank.version).toBe(11n);
    expect(await count('SELECT count(*)::int AS count FROM transactions WHERE batch_id = $1', [key])).toBe(12);

    const ra = (a.body as BatchResponse).results;
    const rb = (b.body as BatchResponse).results;
    for (let i = 0; i < transfers.length; i++) {
      expect(ra[i].status).toBe(rb[i].status);
      expect(ra[i].transactionId).toBe(rb[i].transactionId);
      // Exactly one of the two requests wrote the row; the other returned it as a duplicate.
      expect([ra[i].duplicate, rb[i].duplicate].filter((d) => !d)).toHaveLength(1);
    }
  });

  it('rejects a reused key with a different payload (422) without changing anything', async () => {
    const key = randomUUID();
    await post([{ personId: personIds.bob, amount: '5.00' }], key).expect(200);
    const before = await readState();

    const res = await post([{ personId: personIds.bob, amount: '6.00' }], key).expect(422);

    expect(res.body.message).toMatch(/different request payload/);
    expect(await readState()).toEqual(before);
    expect(await count('SELECT count(*)::int AS count FROM transactions')).toBe(1);
  });

  it('treats FAILED as final for a key, even after the Person is topped up', async () => {
    const henry = personIds.henry;
    await setBalance(henry, '5.00');
    const key = randomUUID();
    const transfers = [{ personId: henry, amount: '10.00' }];

    const first = await post(transfers, key).expect(200);
    expect((first.body as BatchResponse).results[0]).toMatchObject({
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
      duplicate: false,
    });

    await setBalance(henry, '100.00');
    const before = await readState();
    const retry = await post(transfers, key).expect(200);

    expect((retry.body as BatchResponse).results[0]).toMatchObject({
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
      duplicate: true,
      transactionId: (first.body as BatchResponse).results[0].transactionId,
    });
    expect(await readState()).toEqual(before);
  });

  it('finishes a partially processed batch on retry and reports whole-batch stats', async () => {
    const david = personIds.david;
    const key = randomUUID();
    const transfers = Array.from({ length: 4 }, () => ({ personId: david, amount: '10.00' }));
    const hash = hashBatchRequest(transfers.map((t) => ({ personId: t.personId, amountCents: 1000n })));

    // Simulate a crash after items 0 and 1 were committed.
    await ds.query('INSERT INTO transaction_batches (id, request_hash, item_count) VALUES ($1, $2, 4)', [key, hash]);
    for (const itemIndex of [0, 1]) {
      await ds.transaction(async (m) => {
        await m.query('UPDATE persons SET balance = balance - 1000 WHERE id = $1', [david]);
        await m.query(
          `INSERT INTO transactions (id, batch_id, item_index, person_id, amount, status, duration_ms)
           VALUES ($1, $2, $3, $4, 1000, 'SUCCESS', 1)`,
          [randomUUID(), key, itemIndex, david],
        );
        await m.query('UPDATE bank SET balance = balance + 1000, version = version + 1');
      });
    }

    const res = await post(transfers, key).expect(200);
    const body = res.body as BatchResponse;

    expect(body.results.map((r) => r.duplicate)).toEqual([true, true, false, false]);
    expect(body.results.every((r) => r.status === 'SUCCESS')).toBe(true);
    expect(body).toMatchObject({ total: 4, successCount: 4, failureCount: 0, duplicateCount: 2 });

    const after = await readState();
    expect(after.persons.get(david)).toBe(75050n - 4000n);
    expect(after.bank).toEqual({ balance: 4000n, version: 4n });
    const [batch]: Array<{ completed_at: Date | null }> = await ds.query(
      'SELECT completed_at FROM transaction_batches WHERE id = $1',
      [key],
    );
    expect(batch.completed_at).not.toBeNull();
  });

  it('rejects an Idempotency-Key that is not a UUID (400)', async () => {
    const res = await post([{ personId: personIds.alice, amount: '1.00' }], 'not-a-uuid').expect(400);
    expect(res.body.message).toMatch(/Idempotency-Key/);
    expect(await count('SELECT count(*)::int AS count FROM transaction_batches')).toBe(0);
  });
});

describe('POST /api/transactions: validation', () => {
  const validId = '6f1c1d2e-0000-4000-8000-000000000001';

  it.each([
    ['an empty array', []],
    ['201 items', Array.from({ length: 201 }, () => ({ personId: validId, amount: '1.00' }))],
    ['too many decimals', [{ personId: validId, amount: '1.234' }]],
    ['a negative amount', [{ personId: validId, amount: '-1' }]],
    ['exponent notation', [{ personId: validId, amount: '1e3' }]],
    ['zero', [{ personId: validId, amount: '0' }]],
    ['zero with decimals', [{ personId: validId, amount: '0.00' }]],
    ['an empty amount', [{ personId: validId, amount: '' }]],
    ['a number instead of a string', [{ personId: validId, amount: 10 }]],
    ['a non-uuid personId', [{ personId: 'alice', amount: '1.00' }]],
    ['an unknown field', [{ personId: validId, amount: '1.00', note: 'x' }]],
    ['a non-array', { personId: validId, amount: '1.00' }],
  ])('rejects %s with 400 and processes nothing', async (_label, transactions) => {
    await post(transactions).expect(400);
    expect(await count('SELECT count(*)::int AS count FROM transaction_batches')).toBe(0);
  });

  it('rejects a missing body with 400', async () => {
    await request(app.getHttpServer()).post('/api/transactions').send({}).expect(400);
  });
});

describe('GET endpoints', () => {
  it('returns the bank with its version', async () => {
    const res = await request(app.getHttpServer()).get('/api/bank').expect(200);
    expect(res.body).toMatchObject({ balance: '0.00', version: '0' });
  });

  it('lists recent transactions newest first and validates limit', async () => {
    await post(Array.from({ length: 5 }, () => ({ personId: personIds.eve, amount: '1.00' }))).expect(200);

    const res = await request(app.getHttpServer()).get('/api/transactions?limit=3').expect(200);
    expect(res.body).toHaveLength(3);
    const keys = res.body.map((t: { createdAt: string; id: string }) => `${t.createdAt}|${t.id}`);
    expect([...keys].sort().reverse()).toEqual(keys);

    await request(app.getHttpServer()).get('/api/transactions').expect(200);
    for (const limit of ['0', '201', 'abc', '1.5']) {
      await request(app.getHttpServer()).get(`/api/transactions?limit=${limit}`).expect(400);
    }
  });
});
