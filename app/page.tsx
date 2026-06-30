'use client'

import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

const DERQ = {
  name: 'Derq Systems FZ-LLC',
  address: ['Office 1001, Aurora Tower', 'Dubai Media City', 'Dubai, UAE'],
  trn: 'TRN: 100268056700003',
}

interface LineItem {
  id: string
  label: string
  amount: string
}

interface Invoice {
  fromName: string
  number: string
  date: string
  period: string
  description: string
  items: LineItem[]
  accountName: string
  bankName: string
  accountNumber: string
  swiftBic: string
  currency: string
}

const STORAGE_KEY = 'invoice-state-v1'

const DEFAULT_ITEMS: LineItem[] = [
  { id: 'item-0', label: 'Consulting Service Fee', amount: '774.193548387097' },
  { id: 'item-1', label: 'Admin Fees', amount: '' },
  { id: 'item-2', label: 'VAT', amount: '' },
]

const LOCKED_IDS = new Set(['item-0', 'item-1', 'item-2'])

const DEFAULTS: Invoice = {
  fromName: '',
  number: '',
  date: '',
  period: '',
  description: 'Consulting Services',
  items: DEFAULT_ITEMS,
  accountName: '',
  bankName: '',
  accountNumber: '',
  swiftBic: '',
  currency: 'USD',
}

function n(val: string): number { return parseFloat(val) || 0 }
function fmt(val: string): string {
  const num = parseFloat(val)
  return isNaN(num) ? '' : num.toFixed(2)
}
function calcTotal(items: LineItem[]): string {
  return items.reduce((sum, item) => sum + n(item.amount), 0).toFixed(2)
}
function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function Home() {
  const [inv, setInv] = useState<Invoice>(DEFAULTS)
  const [feeRevealed, setFeeRevealed] = useState(false)
  const counter = useRef(3)
  const initialLoadDone = useRef(false)

  // drag state — refs so drop handler always reads fresh values
  const draggingId = useRef<string | null>(null)
  const dropTarget = useRef<{ id: string; position: 'top' | 'bottom' } | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ id: string; position: 'top' | 'bottom' } | null>(null)

  const MS_24H = 24 * 60 * 60 * 1000

  // Load full state on mount; clear consulting fee if untouched for 24h
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved) as Invoice & { lastInteraction?: number }
        const stale = data.lastInteraction && (Date.now() - data.lastInteraction > MS_24H)
        if (stale) {
          data.items = data.items.map(item =>
            item.id === 'item-0' ? { ...item, amount: '' } : item
          )
        }
        setInv(data)
        const maxId = data.items.reduce((max, item) => {
          const num = parseInt(item.id.replace('item-', ''), 10)
          return isNaN(num) ? max : Math.max(max, num + 1)
        }, 3)
        counter.current = maxId
      }
    } catch {}
    initialLoadDone.current = true
  }, [])

  // Save full state + last interaction timestamp on every change
  useEffect(() => {
    if (!initialLoadDone.current) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...inv, lastInteraction: Date.now() }))
  }, [inv])

  function set(field: keyof Invoice, value: string) {
    setInv(prev => ({ ...prev, [field]: value }))
  }

  function addItem() {
    const id = `item-${counter.current++}`
    setInv(prev => ({
      ...prev,
      items: [...prev.items, { id, label: '', amount: '' }],
    }))
  }

  function removeItem(id: string) {
    setInv(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }))
  }

  function updateItem(id: string, field: 'label' | 'amount', value: string) {
    setInv(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item),
    }))
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    draggingId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingId.current === id) return
    const rect = e.currentTarget.getBoundingClientRect()
    const position: 'top' | 'bottom' = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom'
    dropTarget.current = { id, position }
    setDropIndicator({ id, position })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const from = draggingId.current
    const over = dropTarget.current
    draggingId.current = null
    dropTarget.current = null
    setDropIndicator(null)
    if (!from || !over || from === over.id) return

    setInv(prev => {
      const items = [...prev.items]
      const fromIdx = items.findIndex(i => i.id === from)
      if (fromIdx === -1) return prev
      const [moved] = items.splice(fromIdx, 1)
      const toIdx = items.findIndex(i => i.id === over.id)
      if (toIdx === -1) return prev
      const insertAt = over.position === 'bottom' ? toIdx + 1 : toIdx
      items.splice(insertAt, 0, moved)
      return { ...prev, items }
    })
  }

  function handleDragEnd() {
    draggingId.current = null
    dropTarget.current = null
    setDropIndicator(null)
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="no-print w-72 flex-shrink-0 bg-white border-r border-zinc-200 overflow-y-auto flex flex-col">
        <div className="p-5 flex-1">
          <h1 className="text-base font-semibold text-zinc-900 mb-5">Invoice Generator</h1>

          <Section label="From">
            <Field label="Your Name / Company" placeholder="Jane Smith"
              value={inv.fromName} onChange={v => set('fromName', v)} />
          </Section>

          <Section label="Invoice Details">
            <Field label="Invoice Number" placeholder="JUN/2025/HK/001"
              value={inv.number} onChange={v => set('number', v)} />
            <Field label="Invoice Date" type="date"
              value={inv.date} onChange={v => set('date', v)} />
            <Field label="Service Period" placeholder="June 1 – June 30, 2025"
              value={inv.period} onChange={v => set('period', v)} />
            <Field label="Description"
              value={inv.description} onChange={v => set('description', v)} />
          </Section>

          <Section label="Amounts">
            <div className="space-y-1">
              {inv.items.map(item => {
                const locked = LOCKED_IDS.has(item.id)
                const indicator = dropIndicator?.id === item.id ? dropIndicator.position : null
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={e => handleDragStart(e, item.id)}
                    onDragOver={e => handleDragOver(e, item.id)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={[
                      'flex gap-1.5 items-start rounded transition-colors select-none',
                      indicator === 'top' ? 'border-t-2 border-blue-400 pt-0' : 'border-t-2 border-transparent',
                      indicator === 'bottom' ? 'border-b-2 border-blue-400' : 'border-b-2 border-transparent',
                    ].join(' ')}
                  >
                    {/* drag handle */}
                    <div className="mt-2 flex-shrink-0 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-colors"
                      title="Drag to reorder">
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="3" cy="3" r="1.5" /><circle cx="7" cy="3" r="1.5" />
                        <circle cx="3" cy="8" r="1.5" /><circle cx="7" cy="8" r="1.5" />
                        <circle cx="3" cy="13" r="1.5" /><circle cx="7" cy="13" r="1.5" />
                      </svg>
                    </div>

                    <div className="flex-1 space-y-1.5 py-1">
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => updateItem(item.id, 'label', e.target.value)}
                        placeholder="Item name"
                        disabled={locked}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full border border-zinc-200 rounded px-2 py-1.5 text-xs text-zinc-900 placeholder-zinc-300 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-500"
                      />
                      <div
                        className="flex items-center border border-zinc-200 rounded overflow-hidden focus-within:ring-1 focus-within:ring-zinc-400"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <span className="px-2 py-1.5 text-xs text-zinc-400 bg-zinc-50 border-r border-zinc-200 select-none flex-shrink-0">
                          {inv.currency}
                        </span>
                        {item.id === 'item-0' && !feeRevealed ? (
                          <button
                            onClick={() => setFeeRevealed(true)}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs text-zinc-400 bg-white text-left tracking-widest cursor-pointer hover:bg-zinc-50 transition-colors"
                          >
                            ••••••
                          </button>
                        ) : (
                          <input
                            type="number"
                            value={item.amount}
                            onChange={e => updateItem(item.id, 'amount', e.target.value)}
                            placeholder="0.00"
                            step="any"
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs text-zinc-900 placeholder-zinc-300 bg-white focus:outline-none"
                          />
                        )}
                        {item.id === 'item-0' && (
                          <button
                            onClick={() => setFeeRevealed(v => !v)}
                            onMouseDown={e => e.stopPropagation()}
                            className="px-2 text-zinc-300 hover:text-zinc-500 transition-colors cursor-pointer bg-white flex-shrink-0"
                            title={feeRevealed ? 'Hide' : 'Reveal'}
                          >
                            {feeRevealed ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {!locked ? (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="mt-2 flex-shrink-0 text-zinc-300 hover:text-red-400 transition-colors text-lg leading-none cursor-pointer"
                        title="Remove"
                      >
                        ×
                      </button>
                    ) : (
                      <div className="w-4 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={addItem}
              className="mt-2 w-full border border-dashed border-zinc-200 rounded py-1.5 text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
            >
              + Add line item
            </button>
          </Section>

          <Section label="Bank Details">
            <p className="text-[11px] text-zinc-400 -mt-1 mb-2">Auto-saved in browser</p>
            <Field label="Account Name"
              value={inv.accountName} onChange={v => set('accountName', v)} />
            <Field label="Bank Name"
              value={inv.bankName} onChange={v => set('bankName', v)} />
            <Field label="Account Number / IBAN"
              value={inv.accountNumber} onChange={v => set('accountNumber', v)} />
            <Field label="SWIFT / BIC"
              value={inv.swiftBic} onChange={v => set('swiftBic', v)} />
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Currency</label>
              <select
                value={inv.currency}
                onChange={e => set('currency', e.target.value)}
                className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {['USD', 'AED', 'EUR', 'GBP', 'INR', 'PKR'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </Section>
        </div>

        <div className="p-5 border-t border-zinc-100">
          <button
            onClick={() => {
              const slug = inv.number
                ? `derq_invoice_${inv.number.replace(/\//g, '_')}`
                : 'derq_invoice'
              const original = document.title
              document.title = slug
              // Force-reveal fee so PDF always shows the real value
              if (!feeRevealed) flushSync(() => setFeeRevealed(true))
              window.addEventListener('afterprint', () => {
                document.title = original
                setFeeRevealed(false)
              }, { once: true })
              window.print()
            }}
            className="w-full bg-zinc-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-zinc-700 active:bg-zinc-800 transition-colors cursor-pointer"
          >
            Print / Save as PDF
          </button>
        </div>
      </aside>

      {/* ── Invoice preview ── */}
      <main className="flex-1 flex items-start justify-center p-10 bg-zinc-100">
        <div
          id="invoice"
          className="bg-white w-full max-w-2xl shadow-sm rounded-md"
          style={{ padding: '48px 56px' }}
        >
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-400 mb-0.5">From</div>
              <div className="font-semibold text-zinc-900 text-base">
                {inv.fromName || 'Your Name'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight text-zinc-900">INVOICE</div>
              <div className="mt-1.5 text-xs text-zinc-500 space-y-0.5">
                <div><span className="font-medium text-zinc-700">No.&nbsp;</span>{inv.number || '—'}</div>
                <div><span className="font-medium text-zinc-700">Date:&nbsp;</span>{fmtDate(inv.date)}</div>
                {inv.period && (
                  <div><span className="font-medium text-zinc-700">Period:&nbsp;</span>{inv.period}</div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-400 mb-2">Bill To</div>
            <div className="font-semibold text-zinc-900">{DERQ.name}</div>
            {DERQ.address.map(line => (
              <div key={line} className="text-zinc-600 text-sm">{line}</div>
            ))}
            <div className="text-zinc-500 text-xs mt-1">{DERQ.trn}</div>
          </div>

          <div className="mb-8">
            <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-400 mb-3">
              {inv.description}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400 pb-2">Item</th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-400 pb-2">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map(item => {
                  const isPrivate = item.id === 'item-0' && !feeRevealed
                  return (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="py-2.5 text-zinc-800">{item.label || '—'}</td>
                      <td className="py-2.5 text-right text-zinc-800 tabular-nums">
                        {isPrivate
                          ? <span className="text-zinc-400 tracking-widest">••••••</span>
                          : fmt(item.amount)
                            ? <><span className="text-zinc-400 text-xs mr-1">{inv.currency}</span>{fmt(item.amount)}</>
                            : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-semibold text-zinc-900">Total Amount Due</td>
                  <td className="pt-3 text-right font-semibold text-zinc-900 tabular-nums">
                    {feeRevealed
                      ? <>{inv.currency}&nbsp;{calcTotal(inv.items)}</>
                      : <span className="text-zinc-400 tracking-widest">••••••</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-zinc-100 pt-6">
            <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-400 mb-3">Bank Details</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
              <BankRow label="Account Name" value={inv.accountName} />
              <BankRow label="Bank Name" value={inv.bankName} />
              <BankRow label="Account Number / IBAN" value={inv.accountNumber} />
              <BankRow label="SWIFT / BIC" value={inv.swiftBic} />
              <BankRow label="Currency" value={inv.currency} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">{label}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        step={type === 'number' ? 'any' : undefined}
        className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-300 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
      />
    </div>
  )
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-800">{value || '—'}</span>
    </>
  )
}
