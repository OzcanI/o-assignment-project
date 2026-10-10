import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { POLL_INTERVAL_MS } from '../config'

export const PERSONS_QUERY_KEY = ['persons'] as const

/** Person balances change with every batch, so they are polled like the Bank balance. */
export function usePersons() {
  return useQuery({
    queryKey: PERSONS_QUERY_KEY,
    queryFn: api.getPersons,
    refetchInterval: POLL_INTERVAL_MS,
  })
}
