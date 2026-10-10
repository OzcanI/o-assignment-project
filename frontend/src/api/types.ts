// Wire types mirroring the backend. Money is always a decimal string ("12.34")
// and bigint counters (version) are decimal strings as well.

export interface Person {
  id: string
  name: string
  balance: string
}

export interface BankBalance {
  balance: string
  version: string
  updatedAt: string
}

export type TransactionStatus = 'SUCCESS' | 'FAILED'

export type FailureReason = 'INSUFFICIENT_FUNDS' | 'PERSON_NOT_FOUND' | 'INTERNAL_ERROR'

export interface TransactionRecord {
  id: string
  batchId: string
  itemIndex: number
  personId: string
  amount: string
  status: TransactionStatus
  failureReason: FailureReason | null
  durationMs: number
  createdAt: string
}

export interface TransferRequest {
  personId: string
  amount: string
}

export interface ItemResult {
  itemIndex: number
  transactionId: string | null
  personId: string
  amount: string
  status: TransactionStatus
  failureReason: FailureReason | null
  durationMs: number
  duplicate: boolean
  recorded: boolean
}

export interface BatchStats {
  batchId: string
  total: number
  successCount: number
  failureCount: number
  duplicateCount: number
  durationMs: number
}

export interface BatchResponse extends BatchStats {
  bankBalance: string
  bankVersion: string
  results: ItemResult[]
}
