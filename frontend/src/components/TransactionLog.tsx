import type { Person } from '../api/types'
import { LOG_LIMIT } from '../config'
import { useTransactionLog } from '../hooks/useTransactionLog'
import { failureLabel, formatTime } from '../lib/format'
import { formatMoney } from '../lib/money'

interface Props {
  persons: Person[]
}

export function TransactionLog({ persons }: Props) {
  const { transactions, isLoading, error } = useTransactionLog()
  const names = new Map(persons.map((p) => [p.id, p.name]))

  return (
    <section className="card">
      <div className="card-header">
        <h2>Recent transactions</h2>
        <span className="muted small">Latest {LOG_LIMIT}, newest first</span>
      </div>

      {error && transactions.length === 0 && <p className="error-text">{error.message}</p>}
      {isLoading && transactions.length === 0 && <p className="muted">Loading…</p>}
      {!isLoading && transactions.length === 0 && !error && (
        <p className="muted">No transactions yet.</p>
      )}

      {transactions.length > 0 && (
        <div className="table-scroll">
          <table className="table log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Person</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th className="num">Duration</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="mono">{formatTime(tx.createdAt)}</td>
                  <td>{names.get(tx.personId) ?? <span className="muted mono">{tx.personId.slice(0, 8)}…</span>}</td>
                  <td className="num">{formatMoney(tx.amount)}</td>
                  <td>
                    <span className={`badge ${tx.status === 'SUCCESS' ? 'badge-ok' : 'badge-fail'}`}>
                      {tx.status === 'SUCCESS' ? 'Success' : 'Failed'}
                    </span>
                    {tx.failureReason && <span className="muted small"> {failureLabel(tx.failureReason)}</span>}
                  </td>
                  <td className="num mono">{tx.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
