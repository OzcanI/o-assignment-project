import { useBank } from '../hooks/useBank'
import { formatMoney } from '../lib/money'
import { formatTime } from '../lib/format'

export function BankBalanceCard() {
  const { balance, version, updatedAt, trend, isStale, error } = useBank()

  return (
    <section className="card bank-card" aria-live="polite">
      <div className="card-header">
        <h2>Bank balance</h2>
        <span className={`badge ${isStale ? 'badge-warn' : 'badge-live'}`}>
          {isStale ? 'Connection problem' : 'Live'}
        </span>
      </div>

      {balance === null ? (
        <p className="bank-amount muted">{error ? 'Unavailable' : 'Loading…'}</p>
      ) : (
        // Re-keying on version restarts the flash animation on every change.
        <p key={version?.toString()} className={`bank-amount ${trend ? `flash-${trend}` : ''}`}>
          {formatMoney(balance)}
        </p>
      )}

      {error && balance === null && <p className="error-text">{error.message}</p>}
      {updatedAt && (
        <p className="muted small">
          Version {version?.toString()} · updated {formatTime(updatedAt)}
        </p>
      )}
    </section>
  )
}
