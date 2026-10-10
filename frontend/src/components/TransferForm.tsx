import { useState, type FormEvent } from 'react'
import type { Person, TransferRequest } from '../api/types'
import { MAX_BATCH_SIZE } from '../config'
import { centsToDecimal, formatMoney, isValidAmount, parseCents } from '../lib/money'
import { PersonSelector, type Selection } from './PersonSelector'

const EMPTY_SELECTION: Selection = { selected: false, amount: '' }

function buildBatch(
  selected: Person[],
  selection: Record<string, Selection>,
  repeatCount: number,
): { transfers: TransferRequest[]; error: string | null } {
  if (selected.length === 0) return { transfers: [], error: 'Select at least one person.' }
  if (selected.some((p) => !isValidAmount(selection[p.id].amount))) {
    return { transfers: [], error: 'Every selected person needs an amount greater than 0 with at most 2 decimals.' }
  }
  if (repeatCount < 1) return { transfers: [], error: 'Repeat must be a whole number of at least 1.' }
  const count = selected.length * repeatCount
  if (count > MAX_BATCH_SIZE) {
    return { transfers: [], error: `A batch can hold at most ${MAX_BATCH_SIZE} transactions (currently ${count}).` }
  }
  // Round-robin so repeated transfers for the same person race each other.
  const transfers: TransferRequest[] = []
  for (let r = 0; r < repeatCount; r++) {
    for (const p of selected) transfers.push({ personId: p.id, amount: selection[p.id].amount })
  }
  return { transfers, error: null }
}

interface Props {
  persons: Person[]
  isSending: boolean
  onSend: (transfers: TransferRequest[]) => void
}

export function TransferForm({ persons, isSending, onSend }: Props) {
  const [selection, setSelection] = useState<Record<string, Selection>>({})
  const [bulkAmount, setBulkAmount] = useState('')
  const [repeat, setRepeat] = useState('1')

  const selected = persons.filter((p) => selection[p.id]?.selected)
  const repeatCount = /^\d+$/.test(repeat) ? Number(repeat) : 0

  const { transfers, error } = buildBatch(selected, selection, repeatCount)
  const totalCents = transfers.reduce((sum, t) => sum + parseCents(t.amount), 0n)

  const update = (personId: string, patch: Partial<Selection>) =>
    setSelection((prev) => ({
      ...prev,
      [personId]: { ...(prev[personId] ?? EMPTY_SELECTION), ...patch },
    }))

  const toggleAll = (value: boolean) =>
    setSelection((prev) =>
      Object.fromEntries(
        persons.map((p) => [p.id, { ...(prev[p.id] ?? EMPTY_SELECTION), selected: value }]),
      ),
    )

  const applyBulkAmount = () =>
    setSelection((prev) => {
      const next = { ...prev }
      for (const p of selected) next[p.id] = { ...next[p.id], amount: bulkAmount }
      return next
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!error && !isSending) onSend(transfers)
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-header">
        <h2>Send transactions</h2>
        <span className="muted small">Each transaction moves money from a person to the bank.</span>
      </div>

      <PersonSelector
        persons={persons}
        selection={selection}
        onChange={update}
        onToggleAll={toggleAll}
        disabled={isSending}
      />

      <div className="form-row">
        <label className="field">
          <span>Amount for selected</span>
          <div className="inline">
            <input
              className={`amount-input ${bulkAmount && !isValidAmount(bulkAmount) ? 'invalid' : ''}`}
              inputMode="decimal"
              placeholder="0.00"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value.trim())}
              disabled={isSending}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={applyBulkAmount}
              disabled={isSending || selected.length === 0 || !isValidAmount(bulkAmount)}
            >
              Apply
            </button>
          </div>
        </label>

        <label className="field">
          <span>Repeat each ×</span>
          <input
            className="repeat-input"
            type="number"
            min={1}
            max={MAX_BATCH_SIZE}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            disabled={isSending}
          />
        </label>
      </div>

      <div className="form-footer">
        <p className={error ? 'muted small' : 'small'}>
          {error ??
            `${transfers.length} transaction${transfers.length === 1 ? '' : 's'} totalling ${formatMoney(centsToDecimal(totalCents))}, processed in parallel.`}
        </p>
        <button type="submit" className="btn btn-primary" disabled={Boolean(error) || isSending}>
          {isSending && <span className="spinner" aria-hidden="true" />}
          {isSending ? 'Sending…' : 'Send Transactions'}
        </button>
      </div>
    </form>
  )
}
