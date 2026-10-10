import { bigintTransformer } from './bigint.transformer.js';
import { AMOUNT_REGEX, formatCents, parseAmountToCents } from './money.js';

describe('parseAmountToCents', () => {
  it.each([
    ['0.1', 10n],
    ['0.01', 1n],
    ['10', 1000n],
    ['12.3', 1230n],
    ['12.34', 1234n],
    ['999999999999.99', 99999999999999n],
  ])('parses %s as %s cents', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it.each(['1.234', '-1', '1e3', '', '.5', '5.', ' 1', '1,00', '0x10', '1234567890123'])(
    'rejects %j',
    (input) => {
      expect(AMOUNT_REGEX.test(input)).toBe(false);
      expect(() => parseAmountToCents(input)).toThrow();
    },
  );
});

describe('formatCents', () => {
  it.each([
    [0n, '0.00'],
    [1n, '0.01'],
    [10n, '0.10'],
    [1230n, '12.30'],
    [-1234n, '-12.34'],
    [99999999999999n, '999999999999.99'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatCents(input)).toBe(expected);
  });

  it('round-trips with parseAmountToCents', () => {
    for (const s of ['0.01', '7.50', '123456.78']) {
      expect(formatCents(parseAmountToCents(s))).toBe(s);
    }
  });
});

describe('bigintTransformer', () => {
  it('keeps precision beyond Number.MAX_SAFE_INTEGER', () => {
    const big = '9223372036854775807';
    expect(bigintTransformer.from(big)).toBe(9223372036854775807n);
    expect(bigintTransformer.to(9223372036854775807n)).toBe(big);
  });

  it('passes null and undefined through', () => {
    expect(bigintTransformer.from(null)).toBeNull();
    expect(bigintTransformer.to(null)).toBeNull();
    expect(bigintTransformer.to(undefined)).toBeUndefined();
  });
});
