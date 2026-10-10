import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import type { BatchResponse, TransferRequest } from '../api/types'
import { BANK_QUERY_KEY } from './useBank'
import { PERSONS_QUERY_KEY } from './usePersons'
import { TRANSACTIONS_QUERY_KEY } from './useTransactionLog'

export interface SendVariables {
  transfers: TransferRequest[]
  /** Generated once per submission so automatic retries reuse it. */
  idempotencyKey: string
}

export interface SendResult {
  response: BatchResponse
  /** Client-measured round trip, including network and serialization. */
  clientMs: number
}

/** Retry network errors and 5xx only; the idempotency key makes retries safe. */
const shouldRetry = (failureCount: number, error: Error) =>
  failureCount < 2 && !(error instanceof ApiError && error.status < 500)

export function useSendTransactions() {
  const queryClient = useQueryClient()
  return useMutation<SendResult, Error, SendVariables>({
    mutationFn: async ({ transfers, idempotencyKey }) => {
      const startedAt = performance.now()
      const response = await api.sendTransactions(transfers, idempotencyKey)
      return { response, clientMs: Math.round(performance.now() - startedAt) }
    },
    retry: shouldRetry,
    // Refetch everything the batch changed right away instead of waiting for the next poll.
    onSettled: () =>
      Promise.all(
        [BANK_QUERY_KEY, PERSONS_QUERY_KEY, TRANSACTIONS_QUERY_KEY].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
