'use client'

import React, { useId, useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react'

import { PRIVACY_POLICY_PATH } from '@/shared/formSubmission'
import { portalContent } from '@/portal/content/portalContent'
import styles from '@/portal/ui/portal.module.css'

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ')

export { cx }

type FieldShellProps = {
  id: string
  label: React.ReactNode
  labelAside?: React.ReactNode
  optional?: boolean
  hint?: React.ReactNode
  hintBelow?: boolean
  error?: string
  className?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/** Label, Hinweis und Fehlermeldung um ein Eingabefeld; Fehler stehen direkt unter dem Feld. */
export function FieldShell({ id, label, labelAside, optional, hint, hintBelow, error, className, children, footer }: FieldShellProps) {
  const labelNode = (
    <label className={styles.label} htmlFor={id}>
      {label}
      {optional && <span className={styles.optional}> ({portalContent.submission.optional})</span>}
    </label>
  )
  return (
    <div className={cx(styles.field, className)}>
      {labelAside ? (
        <div className={styles.labelRow}>
          {labelNode}
          {labelAside}
        </div>
      ) : (
        labelNode
      )}
      {hint && !hintBelow && (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {hint && hintBelow && (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className={styles.error} id={`${id}-error`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      {footer}
    </div>
  )
}

const describedBy = (id: string, hint?: React.ReactNode, error?: string, extra?: string) =>
  [hint ? `${id}-hint` : '', error ? `${id}-error` : '', extra || ''].filter(Boolean).join(' ') || undefined

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  optional?: boolean
  hint?: React.ReactNode
  hintBelow?: boolean
  error?: string
  className?: string
}

export function TextField({ label, value, onValueChange, optional, hint, hintBelow, error, className, id, ...input }: TextFieldProps) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <FieldShell id={fieldId} label={label} optional={optional} hint={hint} hintBelow={hintBelow} error={error} className={className}>
      <input
        {...input}
        id={fieldId}
        className={cx(styles.input, error && styles.invalid)}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-required={!optional && !input.readOnly ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
      />
    </FieldShell>
  )
}

export function PasswordField({
  label,
  value,
  onValueChange,
  hint,
  error,
  autoComplete,
  id,
  onBlur,
  labelAside,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
  autoComplete: 'current-password' | 'new-password'
  id?: string
  onBlur?: () => void
  labelAside?: React.ReactNode
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const [visible, setVisible] = useState(false)
  const copy = portalContent.auth.fields
  return (
    <FieldShell id={fieldId} label={label} labelAside={labelAside} hint={hint} error={error}>
      <div className={styles.passwordWrap}>
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className={cx(styles.input, error && styles.invalid)}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-required="true"
          aria-describedby={describedBy(fieldId, hint, error)}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? copy.hidePassword : copy.showPassword}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  )
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  optional,
  hint,
  error,
  className,
  placeholder = portalContent.labels.choose,
  id,
  onBlur,
}: {
  label: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
  optional?: boolean
  hint?: React.ReactNode
  error?: string
  className?: string
  placeholder?: string
  id?: string
  onBlur?: () => void
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const hasEmptyOption = options.some((option) => option.value === '')
  return (
    <FieldShell id={fieldId} label={label} optional={optional} hint={hint} error={error} className={className}>
      <select
        id={fieldId}
        className={cx(styles.select, error && styles.invalid)}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-required={!optional ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
      >
        {!hasEmptyOption && (
          <option value="" disabled={!optional}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  value,
  onValueChange,
  maxLength,
  optional,
  hint,
  error,
  className,
  id,
  rows = 5,
  onBlur,
}: {
  label: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  maxLength: number
  optional?: boolean
  hint?: React.ReactNode
  error?: string
  className?: string
  id?: string
  rows?: number
  onBlur?: () => void
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const length = value.length
  const over = length > maxLength
  return (
    <FieldShell
      id={fieldId}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      className={className}
      footer={
        <p className={cx(styles.counter, over && styles.counterOver)} id={`${fieldId}-count`}>
          {length.toLocaleString('de-DE')} / {maxLength.toLocaleString('de-DE')}
        </p>
      }
    >
      <textarea
        id={fieldId}
        rows={rows}
        className={cx(styles.textarea, error && styles.invalid)}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-required={!optional ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error, `${fieldId}-count`)}
      />
    </FieldShell>
  )
}

/** Ja/Nein als zwei Schaltflächen (Radiogruppe). */
export function YesNoField({
  label,
  value,
  onValueChange,
  error,
  hint,
  name,
  id,
}: {
  label: string
  value: '' | 'ja' | 'nein'
  onValueChange: (value: 'ja' | 'nein') => void
  error?: string
  hint?: React.ReactNode
  name: string
  id?: string
}) {
  const autoId = useId()
  const groupId = id || autoId
  return (
    <fieldset className={styles.field} aria-describedby={describedBy(groupId, hint, error)} id={groupId} tabIndex={-1}>
      <legend className={styles.label} style={{ marginBottom: 6 }}>
        {label}
      </legend>
      {hint && (
        <p className={styles.hint} id={`${groupId}-hint`}>
          {hint}
        </p>
      )}
      <div className={cx(styles.yesNo, error && styles.pillGroupInvalid)} role="radiogroup" aria-invalid={error ? true : undefined}>
        {(['ja', 'nein'] as const).map((option) => (
          <label key={option} className={styles.pill}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onValueChange(option)} />
            {option === 'ja' ? portalContent.labels.yes : portalContent.labels.no}
          </label>
        ))}
      </div>
      {error && (
        <p className={styles.error} id={`${groupId}-error`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Auswahl als Kacheln mit Titel und Beschreibung (eine Antwort). */
export function ChoiceField<T extends string>({
  legend,
  hint,
  name,
  value,
  onValueChange,
  options,
  error,
  layout = 'row',
  id,
  legendClassName,
}: {
  legend: string
  legendClassName?: string
  hint?: React.ReactNode
  name: string
  value: T | ''
  onValueChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string; desc: string; tag?: string }>
  error?: string
  layout?: 'row' | 'stack'
  id?: string
}) {
  const autoId = useId()
  const groupId = id || autoId
  return (
    <fieldset className={styles.field} aria-describedby={describedBy(groupId, hint, error)} id={groupId} tabIndex={-1}>
      <legend className={legendClassName || styles.label} style={legendClassName ? undefined : { marginBottom: 6 }}>
        {legend}
      </legend>
      {hint && (
        <p className={styles.hint} id={`${groupId}-hint`} style={{ marginBottom: 4 }}>
          {hint}
        </p>
      )}
      <div className={cx(layout === 'row' ? styles.choicesRow : styles.choices, error && styles.choicesInvalid)}>
        {options.map((option) => (
          <label key={option.value} className={styles.choice}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onValueChange(option.value)} />
            <span className={styles.choiceMark} aria-hidden="true" />
            <span className={styles.choiceTitle}>{option.label}</span>
            <span className={styles.choiceDesc}>{option.desc}</span>
            {option.tag && <span className={styles.choiceTag}>{option.tag}</span>}
          </label>
        ))}
      </div>
      {error && (
        <p className={styles.error} id={`${groupId}-error`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Mehrfachauswahl als Kacheln (z. B. Preise) – gleiche Kachel wie ChoiceField, mit eckiger Markierung. */
export function MultiChoiceField<T extends string>({
  legend,
  legendClassName,
  hint,
  name,
  value,
  onValueChange,
  options,
  error,
  id,
}: {
  legend: string
  legendClassName?: string
  hint?: React.ReactNode
  name: string
  value: T[]
  onValueChange: (value: T[]) => void
  options: ReadonlyArray<{ value: T; label: string; desc: string; tag?: string }>
  error?: string
  id?: string
}) {
  const autoId = useId()
  const groupId = id || autoId
  const toggle = (option: T, checked: boolean) => {
    const next = checked ? [...value, option] : value.filter((item) => item !== option)
    onValueChange(options.map((item) => item.value).filter((item) => next.includes(item)))
  }
  return (
    <fieldset className={styles.field} aria-describedby={describedBy(groupId, hint, error)} id={groupId} tabIndex={-1}>
      <legend className={legendClassName || styles.label} style={legendClassName ? undefined : { marginBottom: 6 }}>
        {legend}
      </legend>
      {hint && (
        <p className={styles.hint} id={`${groupId}-hint`} style={{ marginBottom: 4 }}>
          {hint}
        </p>
      )}
      <div className={cx(styles.choices, error && styles.choicesInvalid)}>
        {options.map((option) => (
          <label key={option.value} className={styles.choice}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
            />
            <span className={cx(styles.choiceMark, styles.choiceMarkCheck)} aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className={styles.choiceTitle}>{option.label}</span>
            <span className={styles.choiceDesc}>{option.desc}</span>
            {option.tag && <span className={styles.choiceTag}>{option.tag}</span>}
          </label>
        ))}
      </div>
      {error && (
        <p className={styles.error} id={`${groupId}-error`} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Beschriftung mit Kurzform für schmale Fußleisten (≤480 px); sichtbar und damit Name ist jeweils nur eine. */
export function FootLabel({ long, short }: { long: string; short: string }) {
  return (
    <>
      <span className={styles.labelLong}>{long}</span>
      <span className={styles.labelShort}>{short}</span>
    </>
  )
}

/** Kurzer Datenschutzhinweis dort, wo Personendaten eingegeben oder weitergegeben werden (Text: Platzhalter). */
export function PrivacyNote({ children }: { children: React.ReactNode }) {
  const copy = portalContent.privacy
  return (
    <p className={styles.privacyNote}>
      <ShieldCheck size={15} aria-hidden="true" />
      <span>
        {children}{' '}
        <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer">
          {copy.link}
          <span className={styles.srOnly}> {copy.newTab}</span>
        </a>
        <span className={styles.privacyPlaceholder}> · {copy.placeholder}</span>
      </span>
    </p>
  )
}

/** Fokus auf das erste fehlerhafte Feld eines Bereichs (nach „Weiter“ oder „Einreichen“). */
export function focusFirstInvalid(container: HTMLElement | null) {
  if (!container) return
  window.requestAnimationFrame(() => {
    const target = container.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!target) return
    const focusable =
      target.matches('input, select, textarea') ? target : target.closest('fieldset') || target.querySelector<HTMLElement>('input')
    ;(focusable as HTMLElement | null)?.focus({ preventScroll: true })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  })
}
