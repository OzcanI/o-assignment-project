import type { SendResult } from '../hooks/useSendTransactions'
import { failureLabel } from '../lib/format'
import { formatMoney } from '../lib/money'

interface Props {
  result: SendResult | undefined
  isSending: boolean
  pendingCount: number
  error: Error | null
}

export function BatchResult({ result, isSending, pendingCount, error }: Props) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Last batch</h2>
      </div>

      {isSending && (
        <p className="pending">
          <span className="spinner dark" aria-hidden="true" /> Processing {pendingCount} transaction
          {pendingCount === 1 ? '' : 's'}…
        </p>
      )}

      {!isSending && error && (
        <div className="banner banner-error" role="alert">
          {error.message}
        </div>
      )}

      {!isSending && !error && !result && <p className="muted">No batch sent yet.</p>}

      {!isSending && !error && result && <Stats result={result} />}
    </section>
  )
}

function Stats({ result: { response, clientMs } }: { result: SendResult }) {
  const failuresByReason = new Map<string, number>()
  for (const r of response.results) {
    if (r.status === 'FAILED') {
      const label = failureLabel(r.failureReason)
      failuresByReason.set(label, (failuresByReason.get(label) ?? 0) + 1)
    }
  }

  return (
    <>
      <dl className="stats">
        <div>
          <dt>Server time</dt>
          <dd>{response.durationMs} ms</dd>
        </div>
        <div>
          <dt>Round trip</dt>
          <dd>{clientMs} ms</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{response.total}</dd>
        </div>
        <div>
          <dt>Succeeded</dt>
          <dd className="ok">{response.successCount}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd className={response.failureCount ? 'fail' : undefined}>{response.failureCount}</dd>
        </div>
        <div>
          <dt>Duplicates</dt>
          <dd>{response.duplicateCount}</dd>
        </div>
      </dl>
      {failuresByReason.size > 0 && (
        <ul className="failure-list small">
          {[...failuresByReason].map(([label, count]) => (
            <li key={label}>
              {count} × {label}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Bank balance after batch: {formatMoney(response.bankBalance)} (version {response.bankVersion})
      </p>
    </>
  )
}
