/**
 * Money is represented as integer cents (`bigint`) everywhere inside the backend.
 * Decimal strings only exist at the API boundary.
 */

/** Positive or zero decimal with up to 12 integer digits and up to 2 fraction digits. */
export const AMOUNT_REGEX = /^\d{1,12}(\.\d{1,2})?$/;

/**
 * Converts a decimal string such as "12.3" into cents (1230n) without any
 * floating-point arithmetic. Throws on malformed input.
 */
export function parseAmountToCents(amount: string): bigint {
  if (!AMOUNT_REGEX.test(amount)) {
    throw new Error(`Invalid amount: "${amount}"`);
  }
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

/** Converts cents into a decimal string with exactly two fraction digits, e.g. 1230n -> "12.30". */
export function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}
