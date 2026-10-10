import type { FailureReason } from '../api/types'

const FAILURE_LABELS: Record<FailureReason, string> = {
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  PERSON_NOT_FOUND: 'Person not found',
  INTERNAL_ERROR: 'Internal error',
}

export const failureLabel = (reason: FailureReason | null) => (reason ? FAILURE_LABELS[reason] : '')

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

export const formatTime = (iso: string) => timeFormatter.format(new Date(iso))
