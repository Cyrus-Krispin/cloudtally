import { useState } from 'react'
import type { ConfigValue, FieldDef } from '../engine/types'

/** A number input that lets you clear and retype the value before committing it. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  id,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  id?: string
}) {
  const [text, setText] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  // Pick up changes made elsewhere (such as loading a file) without disturbing what's being typed.
  if (value !== prevValue) {
    setPrevValue(value)
    if (Number(text) !== value) setText(String(value))
  }

  return (
    <input
      id={id}
      type="number"
      value={text}
      min={min}
      max={max}
      step={step ?? 'any'}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n)) {
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)))
        }
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

export function Field({ field, value, onChange }: { field: FieldDef; value: ConfigValue; onChange: (v: ConfigValue) => void }) {
  const id = `field-${field.key}`
  return (
    <div className="field">
      <label htmlFor={id}>
        {field.label}
        {field.type === 'number' && field.unit && <span className="unit"> ({field.unit})</span>}
      </label>
      {field.type === 'number' ? (
        <NumberInput id={id} value={Number(value)} onChange={onChange} min={field.min} max={field.max} step={field.step} />
      ) : (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {field.help && <p className="help">{field.help}</p>}
    </div>
  )
}
