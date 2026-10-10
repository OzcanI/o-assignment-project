import { API_BASE_URL } from '../config'
import type { BankBalance, BatchResponse, Person, TransactionRecord, TransferRequest } from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    // Nest error bodies: { message: string | string[], statusCode, error }
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null
    const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message
    throw new ApiError(response.status, message ?? `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export const api = {
  getBank: () => request<BankBalance>('/bank'),
  getPersons: () => request<Person[]>('/persons'),
  getTransactions: (limit: number) => request<TransactionRecord[]>(`/transactions?limit=${limit}`),
  sendTransactions: (transactions: TransferRequest[], idempotencyKey: string) =>
    request<BatchResponse>('/transactions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ transactions }),
    }),
}
