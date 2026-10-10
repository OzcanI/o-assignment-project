import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { LOG_LIMIT, POLL_INTERVAL_MS } from '../config'

export const TRANSACTIONS_QUERY_KEY = ['transactions'] as const

/** The most recent transactions (capped at LOG_LIMIT), newest first, refreshed by polling. */
export function useTransactionLog() {
  const query = useQuery({
    queryKey: [...TRANSACTIONS_QUERY_KEY, LOG_LIMIT],
    queryFn: () => api.getTransactions(LOG_LIMIT),
    refetchInterval: POLL_INTERVAL_MS,
  })

  return { transactions: query.data ?? [], isLoading: query.isPending, error: query.error }
}
