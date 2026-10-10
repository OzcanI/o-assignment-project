import type { BankBalance } from '../api/types'
import { parseCents } from '../lib/money'

export interface BankState {
  balance: string | null
  version: bigint | null
  updatedAt: string | null
  /** Direction of the last applied change, for the flash animation. */
  trend: 'up' | 'down' | null
}

export const initialBankState: BankState = {
  balance: null,
  version: null,
  updatedAt: null,
  trend: null,
}

/**
 * Applies a polled balance snapshot only if it is strictly newer than what we
 * already show. Overlapping requests can resolve out of order; the version comes
 * from the same UPDATE that changed the balance, so it orders them correctly.
 */
export function bankReducer(state: BankState, payload: BankBalance): BankState {
  const version = BigInt(payload.version)
  if (state.version !== null && version <= state.version) return state

  let trend: BankState['trend'] = null
  if (state.balance !== null) {
    const delta = parseCents(payload.balance) - parseCents(state.balance)
    trend = delta > 0n ? 'up' : delta < 0n ? 'down' : null
  }
  return { balance: payload.balance, version, updatedAt: payload.updatedAt, trend }
}
