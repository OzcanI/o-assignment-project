import { useQuery } from '@tanstack/react-query'
import { useEffect, useReducer } from 'react'
import { api } from '../api/client'
import { POLL_INTERVAL_MS } from '../config'
import { bankReducer, initialBankState } from '../state/bankReducer'

export const BANK_QUERY_KEY = ['bank'] as const

/**
 * Live Bank balance, refreshed by polling. Responses go through a
 * version-guarded reducer, so a slow or out-of-order response can never replace
 * a newer balance with an older one.
 */
export function useBank() {
  const [state, apply] = useReducer(bankReducer, initialBankState)

  const query = useQuery({
    queryKey: BANK_QUERY_KEY,
    queryFn: api.getBank,
    refetchInterval: POLL_INTERVAL_MS,
  })

  useEffect(() => {
    if (query.data) apply(query.data)
  }, [query.data])

  return { ...state, isStale: query.isError, error: state.balance === null ? query.error : null }
}
