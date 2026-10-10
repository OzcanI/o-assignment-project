import type { TransferRequest } from './api/types'
import { BankBalanceCard } from './components/BankBalanceCard'
import { BatchResult } from './components/BatchResult'
import { TransactionLog } from './components/TransactionLog'
import { TransferForm } from './components/TransferForm'
import { usePersons } from './hooks/usePersons'
import { useSendTransactions } from './hooks/useSendTransactions'
import { uuidv4 } from './lib/uuid'

export default function App() {
  const persons = usePersons()
  const send = useSendTransactions()

  const handleSend = (transfers: TransferRequest[]) =>
    send.mutate({ transfers, idempotencyKey: uuidv4() })

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bank Transactions</h1>
        <p className="muted">Send concurrent transfers from persons to the bank and watch the balance update live.</p>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <BankBalanceCard />
          <BatchResult
            result={send.data}
            isSending={send.isPending}
            pendingCount={send.variables?.transfers.length ?? 0}
            error={send.error}
          />
        </aside>

        <div className="content">
          {persons.isPending && <section className="card muted">Loading persons…</section>}
          {persons.error && !persons.data && (
            <section className="card banner banner-error" role="alert">
              Could not load persons: {persons.error.message}
            </section>
          )}
          {persons.data && (
            <TransferForm persons={persons.data} isSending={send.isPending} onSend={handleSend} />
          )}
          <TransactionLog persons={persons.data ?? []} />
        </div>
      </main>
    </div>
  )
}
