import { describe, expect, it } from 'vitest'
import type { BankBalance } from '../api/types'
import { bankReducer, initialBankState } from './bankReducer'

const snap = (balance: string, version: string): BankBalance => ({
  balance,
  version,
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('bankReducer', () => {
  it('applies the first snapshot', () => {
    const state = bankReducer(initialBankState, snap('10.00', '3'))
    expect(state).toMatchObject({ balance: '10.00', version: 3n, trend: null })
  })

  it('applies strictly newer versions and tracks the trend', () => {
    let state = bankReducer(initialBankState, snap('10.00', '1'))
    state = bankReducer(state, snap('15.50', '2'))
    expect(state).toMatchObject({ balance: '15.50', version: 2n, trend: 'up' })
  })

  it('ignores lower and equal versions, returning the same state object', () => {
    const state = bankReducer(initialBankState, snap('30.00', '5'))
    expect(bankReducer(state, snap('20.00', '4'))).toBe(state)
    expect(bankReducer(state, snap('99.00', '5'))).toBe(state)
  })

  it('ignores a stale snapshot received on reconnect after newer live events', () => {
    let state = initialBankState
    for (const [balance, version] of [
      ['1.00', '1'],
      ['3.00', '3'],
      ['2.00', '2'], // out-of-order live event
    ] as const) {
      state = bankReducer(state, snap(balance, version))
    }
    const reconnectSnapshot = snap('1.00', '1')
    expect(bankReducer(state, reconnectSnapshot)).toBe(state)
    expect(state).toMatchObject({ balance: '3.00', version: 3n })
  })

  it('compares versions as bigints, not strings', () => {
    const state = bankReducer(initialBankState, snap('1.00', '9'))
    expect(bankReducer(state, snap('2.00', '10')).version).toBe(10n)
    const big = bankReducer(initialBankState, snap('1.00', '9007199254740993'))
    expect(bankReducer(big, snap('2.00', '9007199254740992'))).toBe(big)
  })
})
