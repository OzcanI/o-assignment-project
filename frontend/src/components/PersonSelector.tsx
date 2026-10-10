import type { Person } from '../api/types'
import { formatMoney, isValidAmount } from '../lib/money'

export interface Selection {
  selected: boolean
  amount: string
}

interface Props {
  persons: Person[]
  selection: Record<string, Selection>
  onChange: (personId: string, patch: Partial<Selection>) => void
  onToggleAll: (selected: boolean) => void
  disabled?: boolean
}

export function PersonSelector({ persons, selection, onChange, onToggleAll, disabled }: Props) {
  const selectedCount = persons.filter((p) => selection[p.id]?.selected).length
  const allSelected = persons.length > 0 && selectedCount === persons.length

  return (
    <table className="table person-table">
      <thead>
        <tr>
          <th className="col-check">
            <input
              type="checkbox"
              aria-label="Select all persons"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = selectedCount > 0 && !allSelected
              }}
              onChange={(e) => onToggleAll(e.target.checked)}
              disabled={disabled}
            />
          </th>
          <th>Person</th>
          <th className="num">Balance</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {persons.map((person) => {
          const row = selection[person.id] ?? { selected: false, amount: '' }
          const invalid = row.selected && row.amount !== '' && !isValidAmount(row.amount)
          return (
            <tr key={person.id} className={row.selected ? 'selected' : undefined}>
              <td className="col-check">
                <input
                  type="checkbox"
                  aria-label={`Select ${person.name}`}
                  checked={row.selected}
                  onChange={(e) => onChange(person.id, { selected: e.target.checked })}
                  disabled={disabled}
                />
              </td>
              <td>{person.name}</td>
              <td className="num">{formatMoney(person.balance)}</td>
              <td className="num">
                <input
                  className={`amount-input ${invalid ? 'invalid' : ''}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Amount for ${person.name}`}
                  aria-invalid={invalid}
                  value={row.amount}
                  onChange={(e) =>
                    onChange(person.id, {
                      amount: e.target.value.trim(),
                      selected: row.selected || e.target.value.trim() !== '',
                    })
                  }
                  disabled={disabled}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
