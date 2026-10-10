import { describe, expect, it } from 'vitest'
import { centsToDecimal, isValidAmount, parseCents } from './money'

describe('money helpers', () => {
  it('validates amounts like the backend', () => {
    for (const ok of ['1', '0.01', '12.3', '999999999999.99']) expect(isValidAmount(ok)).toBe(true)
    for (const bad of ['0', '0.00', '', '-1', '1.234', '1e3', '.5', '1,00']) expect(isValidAmount(bad)).toBe(false)
  })

  it('sums exactly in cents', () => {
    const total = ['0.10', '0.20'].reduce((s, a) => s + parseCents(a), 0n)
    expect(centsToDecimal(total)).toBe('0.30')
  })
})
