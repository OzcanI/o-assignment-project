import { hashBatchRequest } from './request-hash.js';

const A = '6f1c1d2e-0000-4000-8000-000000000001';
const B = '6f1c1d2e-0000-4000-8000-000000000002';

describe('hashBatchRequest', () => {
  it('is stable for equal input', () => {
    const items = [{ personId: A, amountCents: 500n }];
    expect(hashBatchRequest(items)).toBe(hashBatchRequest([...items]));
    expect(hashBatchRequest(items)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores person id casing', () => {
    expect(hashBatchRequest([{ personId: A.toUpperCase(), amountCents: 1n }])).toBe(
      hashBatchRequest([{ personId: A, amountCents: 1n }]),
    );
  });

  it('changes when an amount, a person or the item order changes', () => {
    const base = hashBatchRequest([
      { personId: A, amountCents: 1n },
      { personId: B, amountCents: 2n },
    ]);
    expect(
      hashBatchRequest([
        { personId: A, amountCents: 1n },
        { personId: B, amountCents: 3n },
      ]),
    ).not.toBe(base);
    expect(
      hashBatchRequest([
        { personId: B, amountCents: 2n },
        { personId: A, amountCents: 1n },
      ]),
    ).not.toBe(base);
  });
});
