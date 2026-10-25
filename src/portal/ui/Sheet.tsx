'use client'

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { portalContent } from '@/portal/content/portalContent'
import styles from '@/portal/ui/portal.module.css'

export type SheetHandle = { close: () => void; scrollToTop: () => void }

type FocusTarget = { node: HTMLElement; tag: string; label: string | null; text: string; index: number } | null

const sameKind = (element: Element, tag: string, label: string | null, text: string) =>
  element.tagName === tag && element.getAttribute('aria-label') === label && (element.textContent || '').trim() === text

/** Merkt neben Tag, Name und Text die Position unter gleichartigen Elementen – so trifft die Rückgabe genau den Auslöser. */
function describe(node: Element | null): FocusTarget {
  if (!(node instanceof HTMLElement) || node === document.body) return null
  const tag = node.tagName
  const label = node.getAttribute('aria-label')
  const text = (node.textContent || '').trim()
  const root: ParentNode = node.closest('[role="dialog"]') ?? document
  const peers = Array.from(root.querySelectorAll(tag)).filter(
    (element) => sameKind(element, tag, label, text) && (root !== document || !element.closest('[role="dialog"]')),
  )
  return { node, tag, label, text, index: Math.max(0, peers.indexOf(node)) }
}

/** Je offener Mappe: ihr Auslöser und der Auslöser der Mappe davor (für Wechsel Mappe → Mappe → zurück). */
const sheetTrail = new WeakMap<Element, { trigger: FocusTarget; parent: FocusTarget }>()

/**
 * Auslöser beim Öffnen bestimmen. Kommt der Fokus aus einer anderen Mappe, entscheidet, ob er auf einem Bedienelement
 * lag (dann ist das der Auslöser, z. B. „Fragebogen fortsetzen“ im Vorgang) oder nicht (Rückkehr per Escape: den
 * ursprünglichen Auslöser erben und innen auf das Element zurückgehen, von dem man kam).
 */
function captureFocus(): { trigger: FocusTarget; parent: FocusTarget; inside: FocusTarget } {
  if (typeof document === 'undefined') return { trigger: null, parent: null, inside: null }
  const active = document.activeElement
  const host = active instanceof HTMLElement ? active.closest('[role="dialog"][aria-modal="true"]') : null
  const record = host ? sheetTrail.get(host) : undefined
  if (host && record && active instanceof HTMLElement) {
    // X, „Schließen“ oder „Zurück zum Vorgang“ einer schließenden Mappe sind kein neuer Auslöser.
    const closing = host.hasAttribute('data-closing')
    if (!closing && active.matches('button, a[href], input, select, textarea, summary')) return { trigger: describe(active), parent: record.trigger, inside: null }
    return { trigger: record.parent ?? record.trigger, parent: null, inside: record.trigger }
  }
  return { trigger: describe(active), parent: null, inside: null }
}

function findLike(target: FocusTarget, root: ParentNode = document): HTMLElement | undefined {
  if (!target) return undefined
  const usable = (element: HTMLElement) => element.isConnected && !element.closest('[inert]') && element.offsetParent !== null
  if (root === document && usable(target.node)) return target.node
  const matches = Array.from(root.querySelectorAll<HTMLElement>(target.tag)).filter(
    (element) => usable(element) && sameKind(element, target.tag, target.label, target.text),
  )
  return matches[target.index] ?? matches[0]
}

/** Fokus zurück zum Auslöser – derselbe Knoten oder ein gleichartiger; sonst die Hauptüberschrift, nie `<body>`. */
function restoreFocus(target: FocusTarget) {
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
  if (document.activeElement && document.activeElement !== document.body) return
  const match = findLike(target)
  if (match) {
    match.focus({ preventScroll: true })
    return
  }
  const heading = document.querySelector<HTMLElement>('main h1')
  if (heading) {
    heading.tabIndex = -1
    heading.focus({ preventScroll: true })
  }
}

const CLOSE_MS = 200

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Die „Mappe“: breites Seitenpanel über der Portal-Übersicht (mobil Vollbild). Das Portal bleibt darunter stehen und
 * ist währenddessen `inert`; Escape und das Schließen-Symbol schließen, die Zurück-Taste des Browsers ebenso (Route).
 */
export const Sheet = React.forwardRef<
  SheetHandle,
  {
    title: React.ReactNode
    subtitle?: React.ReactNode
    steps?: React.ReactNode
    footer?: React.ReactNode
    onClose: () => void
    children: React.ReactNode
  }
>(function Sheet({ title, subtitle, steps, footer, onClose, children }, ref) {
  const [closing, setClosing] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = React.useId()
  // Auslöser beim ersten Rendern merken – vor dem Commit, bevor `inert` ihn entfokussiert. Weil der Knoten beim Schließen
  // neu gerendert werden kann, zusätzlich eine stabile Beschreibung (Tag, Name, Text) zum Wiederfinden.
  const [{ trigger, parent, inside }] = useState(captureFocus)

  const close = useCallback(() => {
    if (closing) return
    sheetRef.current?.setAttribute('data-closing', '')
    if (prefersReducedMotion()) {
      onClose()
      return
    }
    setClosing(true)
    window.setTimeout(onClose, CLOSE_MS)
  }, [closing, onClose])

  useImperativeHandle(ref, () => ({
    close,
    scrollToTop: () => {
      bodyRef.current?.scrollTo({ top: 0 })
      titleRef.current?.focus({ preventScroll: true })
    },
  }))

  useEffect(() => {
    if (sheetRef.current) sheetTrail.set(sheetRef.current, { trigger, parent })
    // Rückkehr aus einer Folgemappe: auf das Element, von dem man kam; sonst auf den Titel.
    const back = inside && sheetRef.current ? findLike(inside, sheetRef.current) : undefined
    ;(back ?? titleRef.current)?.focus({ preventScroll: true })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      // Beim Schließen den Auslöser wieder fokussieren, sobald der Hintergrund bedienbar ist.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => restoreFocus(trigger)))
    }
  }, [trigger, parent, inside])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Eine darüberliegende Ebene (z. B. die Demo-Steuerung) schließt zuerst – nicht beide auf einmal.
        if (event.defaultPrevented || document.querySelector('[data-overlay-top]')) return
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current || document.querySelector('[data-overlay-top]')) return
      // Fokus bleibt in der Mappe.
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <>
      <div className={cx(styles.scrim, closing && styles.scrimClosing)} onClick={close} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={cx(styles.sheet, closing && styles.sheetClosing)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={cx(styles.sheetHead, styles.onNavy)}>
          <div className={styles.sheetTitleRow}>
            <div>
              <h2 className={styles.sheetTitle} id={titleId} ref={titleRef} tabIndex={-1}>
                {title}
              </h2>
              {subtitle && <p className={styles.sheetSubtitle}>{subtitle}</p>}
            </div>
            <button type="button" className={styles.sheetClose} onClick={close} aria-label={portalContent.sheet.close}>
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          {steps}
        </header>
        {/* Fokussierbar, damit sich auch reine Lesemappen per Tastatur scrollen lassen. */}
        <div className={styles.sheetBody} ref={bodyRef} tabIndex={0} role="region" aria-labelledby={titleId}>
          {children}
        </div>
        {footer && <footer className={styles.sheetFoot}>{footer}</footer>}
      </div>
    </>
  )
})

export function SheetSteps({
  labels,
  current,
  reachable,
  onSelect,
}: {
  labels: readonly string[]
  current: number
  reachable: number
  onSelect: (index: number) => void
}) {
  const copy = portalContent.submission
  // Ab vier Schritten nur Nummern zeigen; der aktuelle Abschnitt steht dann in der Zeile darunter.
  const dense = labels.length > 3
  return (
    <ol className={cx(styles.steps, dense && styles.stepsDense)} aria-label={copy.stepOf(current + 1, labels.length)}>
      {labels.map((label, index) => {
        const done = index < current
        const active = index === current
        const canJump = !active && index <= reachable
        return (
          <li key={label} className={cx(styles.stepItem, done && styles.stepItemDone)}>
            <button
              type="button"
              className={cx(styles.step, done && styles.stepDone, active && styles.stepActive)}
              onClick={() => onSelect(index)}
              disabled={!canJump}
              aria-current={active ? 'step' : undefined}
              title={label}
            >
              <span className={styles.stepNum} aria-hidden="true">
                {done ? <Check size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span className={dense ? styles.srOnly : styles.stepLabel}>{label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
