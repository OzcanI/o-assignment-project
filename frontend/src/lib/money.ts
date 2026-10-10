import { CURRENCY } from '../config'

/** Same rule as the backend: up to 12 integer digits and up to 2 fraction digits. */
export const AMOUNT_REGEX = /^\d{1,12}(\.\d{1,2})?$/

/** Integer cents from a decimal string, without floating-point math. */
export function parseCents(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function isValidAmount(amount: string): boolean {
  return AMOUNT_REGEX.test(amount) && parseCents(amount) > 0n
}

export function centsToDecimal(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`
}

const formatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
})

/** Formats a decimal string exactly; Intl accepts numeric strings without converting to float. */
export function formatMoney(amount: string): string {
  return formatter.format(amount as `${number}`)
}
