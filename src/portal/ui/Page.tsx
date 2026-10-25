'use client'

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { portalContent } from '@/portal/content/portalContent'
import styles from '@/portal/ui/portal.module.css'

export type PageHandle = { close: () => void; scrollToTop: () => void }

type FocusTarget = { node: HTMLElement; tag: string; label: string | null; text: string; index: number } | null

const sameKind = (element: Element, tag: string, label: string | null, text: string) =>
  element.tagName === tag && element.getAttribute('aria-label') === label && (element.textContent || '').trim() === text

/** Auslöser merken (Tag, Name, Text, Position) – die Liste wird beim Zurückkehren neu aufgebaut, der Knoten ist dann ein anderer. */
function describe(node: Element | null): FocusTarget {
  if (!(node instanceof HTMLElement) || node === document.body) return null
  const tag = node.tagName
  const label = node.getAttribute('aria-label')
  const text = (node.textContent || '').trim()
  const peers = Array.from(document.querySelectorAll(tag)).filter((element) => sameKind(element, tag, label, text))
  return { node, tag, label, text, index: Math.max(0, peers.indexOf(node)) }
}

/** Fokus zurück auf den Auslöser in der Liste – sonst auf die Hauptüberschrift, nie auf `<body>`. */
function restoreFocus(target: FocusTarget) {
  if (document.querySelector('[data-portal-page]')) return
  if (document.activeElement && document.activeElement !== document.body) return
  const usable = (element: HTMLElement) => element.isConnected && element.offsetParent !== null
  const match = target
    ? usable(target.node)
      ? target.node
      : Array.from(document.querySelectorAll<HTMLElement>(target.tag)).filter((element) => usable(element) && sameKind(element, target.tag, target.label, target.text))[target.index]
    : undefined
  const fallback = document.querySelector<HTMLElement>('main h1')
  if (!match && fallback) fallback.tabIndex = -1
  ;(match ?? fallback)?.focus({ preventScroll: true })
}

/** Beim Tippen bleibt Escape beim Feld (z. B. Auswahl schließen) – Häkchen und Schaltflächen führen zurück. */
const isTyping = (element: Element | null) =>
  element instanceof HTMLElement && element.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable="true"]')

/**
 * Eigene Seite für Detailansichten (Vorgang, Fragebogen, Anmeldung, Stammdaten, Jurymitglied …). Ersetzt den Inhalt
 * des App-Rahmens statt darüber zu liegen. „Zurück“ oben (oder Escape außerhalb von Eingabefeldern) führt zur vorigen
 * Ansicht; der Fokus kehrt dort auf den Auslöser zurück.
 */
export const Page = React.forwardRef<
  PageHandle,
  {
    title: React.ReactNode
    subtitle?: React.ReactNode
    /** Zusatz unter dem Titel: Status, Hinweise, Fortschritt. */
    meta?: React.ReactNode
    /** Schritte eines Assistenten – auf großen Bildschirmen als Leiste links neben dem Inhalt. */
    rail?: React.ReactNode
    /** Aktionsleiste am Seitenende; bleibt beim Scrollen sichtbar. */
    footer?: React.ReactNode
    onClose: () => void
    backLabel?: string
    children: React.ReactNode
  }
>(function Page({ title, subtitle, meta, rail, footer, onClose, backLabel, children }, ref) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = React.useId()
  // Auslöser beim ersten Rendern merken – vor dem Commit, in dem die Liste verschwindet.
  const [trigger] = useState(() => (typeof document === 'undefined' ? null : describe(document.activeElement)))

  const close = useCallback(() => onClose(), [onClose])

  useImperativeHandle(ref, () => ({
    close,
    scrollToTop: () => {
      window.scrollTo({ top: 0 })
      titleRef.current?.focus({ preventScroll: true })
    },
  }))

  useEffect(() => {
    window.scrollTo({ top: 0 })
    titleRef.current?.focus({ preventScroll: true })
    return () => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => restoreFocus(trigger)))
    }
  }, [trigger])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isTyping(document.activeElement)) return
      // Eine darüberliegende Ebene (Demo-Steuerung, mobile Navigation) schließt zuerst.
      if (document.querySelector('[data-overlay-top]')) return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <article className={styles.page} data-portal-page aria-labelledby={titleId}>
      <header className={styles.pageHead}>
        <button type="button" className={styles.backLink} onClick={close}>
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel ?? portalContent.sheet.back}
        </button>
        <h1 className={styles.pageTitle} id={titleId} ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        {meta && <div className={styles.pageMeta}>{meta}</div>}
      </header>
      <div className={cx(styles.pageBody, rail ? styles.pageBodyRail : undefined)}>
        {rail && <div className={styles.pageRail}>{rail}</div>}
        <div className={styles.pageContent}>{children}</div>
      </div>
      {footer && <footer className={styles.pageFoot}>{footer}</footer>}
    </article>
  )
})

/** Schritte eines Assistenten: senkrecht mit Namen (Leiste links), auf kleinen Bildschirmen waagerecht mit Nummern. */
export function Steps({
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
  return (
    <ol className={styles.steps} aria-label={copy.stepOf(current + 1, labels.length)}>
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
            >
              <span className={styles.stepNum} aria-hidden="true">
                {done ? <Check size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span className={styles.stepLabel}>{label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
