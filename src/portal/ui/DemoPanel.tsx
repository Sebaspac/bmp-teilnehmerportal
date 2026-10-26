'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { SCENARIOS, newedgeSubmission, scenarioOf, type ScenarioId } from '@/portal/domain/seed'
import { STAGES, hasFeature, stageLabel, type Stage } from '@/portal/domain/release'
import { portalContent } from '@/portal/content/portalContent'
import { configuredStage, portalDemo, useStage } from '@/portal/data/portalClient'
import type { PortalSnapshot } from '@/portal/domain/types'
import styles from '@/portal/ui/portal.module.css'

export type Perspective = 'bewerber' | 'admin' | 'jury'

/**
 * Demo-Steuerung: Ausbaustufe, Perspektivwechsel und NEWEDGE-Szenarien. Klar gekennzeichnet als Vorführwerkzeug – keine
 * Funktion des späteren Portals (dort ist die Ausbaustufe eine Einstellung des Deployments).
 */
export function DemoPanel({
  state,
  perspective,
  onClose,
  onPerspective,
  onScenario,
  onReset,
  returnTo,
}: {
  state: PortalSnapshot
  perspective: Perspective
  onClose: () => void
  onPerspective: (perspective: Perspective) => void
  onScenario: (scenario: ScenarioId) => void
  onReset: () => void
  /** Rückweg zum Konto vor dem Demo-Wechsel. */
  returnTo?: { name: string; onClick: () => void }
}) {
  const copy = portalContent.demo
  const panelRef = useRef<HTMLDivElement>(null)
  const stage = useStage()
  const newedge = newedgeSubmission(state)
  const active = newedge ? scenarioOf(newedge.process) : null
  const setStage = (next: Stage) => {
    portalDemo?.setStage(next === configuredStage ? null : next)
    // Gibt es die aktuelle Perspektive in der neuen Stufe nicht (Jury), zurück in die Verwaltung.
    if (perspective === 'jury' && !hasFeature(next, 'jury')) onPerspective('admin')
  }

  // Auslöser beim ersten Rendern merken; der Effekt läuft nur einmal (onClose über Ref, weil die Funktion nicht stabil ist).
  const [trigger] = useState(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      // Tab bleibt im Panel (es liegt über allem).
      if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'))
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const inside = panelRef.current.contains(document.activeElement)
        if (!inside || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current && !panelRef.current.contains(target) && !(target as HTMLElement).closest?.('[data-demo-toggle]')) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      // Fokus zurück auf den Auslöser – liegt er in der geschlossenen mobilen Schublade, auf „Menü“, sonst auf die Überschrift.
      window.requestAnimationFrame(() => {
        if (document.activeElement && document.activeElement !== document.body) return
        const visible = (element: HTMLElement | null | undefined) => Boolean(element?.isConnected && element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden')
        const menu = document.querySelector<HTMLElement>('[aria-controls="portal-sidebar"]')
        const heading = document.querySelector<HTMLElement>('main h1')
        const target = visible(trigger) ? trigger : visible(menu) ? menu : heading
        if (target === heading && heading) heading.tabIndex = -1
        target?.focus({ preventScroll: true })
      })
    }
  }, [trigger])

  return (
    <div className={styles.demoPanel} ref={panelRef} role="dialog" aria-label={copy.title} data-overlay-top="">
      <div className={styles.demoHead}>
        <span className={styles.demoTitle}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          {copy.title}
        </span>
        <button type="button" className={styles.demoClose} onClick={onClose} aria-label={copy.close}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.demoNote}>{copy.note}</p>

      <div className={styles.demoSection}>
        <span className={styles.demoLabel} id="demo-stage">
          {copy.stage}
        </span>
        <p className={styles.demoHint}>{copy.stageHint}</p>
        <div className={cx(styles.demoSegments, styles.demoStages)} role="group" aria-labelledby="demo-stage">
          {STAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx(styles.demoSegment, stage === item.id && styles.demoSegmentActive)}
              aria-pressed={stage === item.id}
              aria-label={item.label}
              title={item.includes}
              onClick={() => setStage(item.id)}
            >
              {item.short}
            </button>
          ))}
        </div>
        <p className={styles.demoHint}>
          {stageLabel(stage)} · {STAGES.find((item) => item.id === stage)!.includes}
          {stage !== configuredStage ? ` · ${copy.stageDefault(stageLabel(configuredStage))}` : ''}
        </p>
      </div>

      <div className={styles.demoSection}>
        <span className={styles.demoLabel} id="demo-perspective">
          {copy.perspective}
        </span>
        <p className={styles.demoHint}>{copy.perspectiveHint}</p>
        {returnTo && (
          <button type="button" className={styles.demoReturn} onClick={returnTo.onClick}>
            {copy.returnTo(returnTo.name)}
          </button>
        )}
        <div className={styles.demoSegments} role="group" aria-labelledby="demo-perspective">
          {(['bewerber', 'admin', 'jury'] as const).filter((item) => item !== 'jury' || hasFeature(stage, 'jury')).map((item) => (
            <button
              key={item}
              type="button"
              className={cx(styles.demoSegment, perspective === item && styles.demoSegmentActive)}
              aria-pressed={perspective === item}
              onClick={() => onPerspective(item)}
            >
              {copy.perspectives[item]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.demoSection}>
        <span className={styles.demoLabel} id="demo-scenario">
          {copy.scenario}
        </span>
        <p className={styles.demoHint}>{copy.scenarioHint}</p>
        {newedge ? (
          <ol className={styles.demoScenarios} aria-labelledby="demo-scenario">
            {SCENARIOS.filter((scenario) => hasFeature(stage, scenario.feature)).map((scenario) => (
              <li key={scenario.id}>
                <button
                  type="button"
                  className={cx(styles.demoScenario, active === scenario.id && styles.demoScenarioActive)}
                  aria-pressed={active === scenario.id}
                  onClick={() => onScenario(scenario.id)}
                >
                  <span className={styles.demoScenarioNum}>{scenario.id}</span>
                  <span className={styles.demoScenarioText}>
                    <span className={styles.demoScenarioTitle}>{scenario.title}</span>
                    <span className={styles.demoScenarioHint}>{scenario.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.demoHint}>{copy.missing}</p>
        )}
      </div>

      <button type="button" className={styles.demoReset} onClick={onReset}>
        <RotateCcw size={14} aria-hidden="true" />
        {copy.reset}
      </button>
    </div>
  )
}
