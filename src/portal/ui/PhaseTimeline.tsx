'use client'

import React from 'react'
import { AlertCircle, CheckCircle2, Circle, Clock, Hourglass, Lock, Mail, PencilLine, Sparkle, Unlock } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { PHASES, TONE_LABEL, type ApplicantView, type Tone } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import styles from '@/portal/ui/portal.module.css'

const TONE_ICON: Record<Tone, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  neu: Sparkle,
  wartend: Clock,
  aktion: AlertCircle,
  freigeschaltet: Unlock,
  bearbeitung: PencilLine,
  abgeschlossen: CheckCircle2,
  einladung: Mail,
  neutral: Circle,
}

/** Ebene B: Detailstatus. Bedeutung immer auch als Text und Symbol, nie nur über die Farbe. */
export function StatusBadge({ label, tone, onNavy = false }: { label: string; tone: Tone; onNavy?: boolean }) {
  const Icon = TONE_ICON[tone]
  return (
    <span className={cx(styles.badge, styles[`badge_${tone}`], onNavy && styles.badgeOnNavy)} title={TONE_LABEL[tone]}>
      <Icon size={13} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

const STATE_TEXT = { done: 'abgeschlossen', current: 'aktuelle Phase', upcoming: 'noch nicht erreicht', closed: 'abgeschlossen' } as const

/**
 * Ebene A: die vier Hauptphasen. Waagerecht, wenn Platz ist; senkrecht auf schmalen Bildschirmen.
 * Abgeschlossen = Gold mit Haken, aktuell = Navy mit Ring, zukünftig = Umriss mit Schloss bzw. Nummer.
 */
export function PhaseTimeline({ view, compact = false, hideCurrentNote = false }: { view: ApplicantView; compact?: boolean; hideCurrentNote?: boolean }) {
  return (
    <ol className={cx(styles.phases, compact && styles.phasesCompact)} aria-label="Bewerbungsphasen">
      {view.steps.map((step) => {
        const locked = step.state === 'upcoming' && step.number === 2
        const invitation = step.state === 'current' && view.status.tone === 'einladung'
        return (
          <li
            key={step.number}
            className={cx(styles.phase, styles[`phase_${step.state}`])}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className={styles.phaseMark} aria-hidden="true">
              {step.state === 'done' ? (
                <CheckCircle2 size={compact ? 14 : 16} />
              ) : step.state === 'closed' ? (
                <Circle size={compact ? 12 : 14} />
              ) : locked ? (
                <Lock size={compact ? 12 : 14} />
              ) : invitation ? (
                <Mail size={compact ? 12 : 14} />
              ) : step.state === 'current' ? (
                <Hourglass size={compact ? 12 : 14} />
              ) : (
                <span>{String(step.number).padStart(2, '0')}</span>
              )}
            </span>
            <span className={styles.phaseText}>
              <span className={styles.phaseNumber}>Phase {String(step.number).padStart(2, '0')}</span>
              <span className={styles.phaseTitle}>{step.title}</span>
              {step.note && !(hideCurrentNote && step.state === 'current') && <span className={styles.phaseNote}>{step.note}</span>}
              <span className={styles.srOnly}> – {STATE_TEXT[step.state]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export const deadlineText = (deadline: string) =>
  `Frist ${new Date(`${deadline}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} (Demo)`

/** Ebene C: nächste Handlung – unterscheidet klar „Sie sind dran“ von „Wir melden uns“. */
export function NextStep({ view, action }: { view: ApplicantView; action?: React.ReactNode }) {
  const { next } = view
  return (
    <div className={cx(styles.nextStep, next.mustAct ? styles.nextStepAct : styles.nextStepWait)}>
      <span className={styles.nextIcon} aria-hidden="true">
        {next.mustAct ? <AlertCircle size={18} /> : <Clock size={18} />}
      </span>
      <span className={styles.nextText}>
        <span className={styles.nextValue}>
          <span className={styles.nextLead}>{next.mustAct ? portalContent.overview.row.act : portalContent.overview.row.wait}:</span> {next.label}
          {next.deadline && <span className={styles.nextDeadline}> · {deadlineText(next.deadline)}</span>}
        </span>
      </span>
      {action && <span className={styles.nextAction}>{action}</span>}
    </div>
  )
}

/** Kurze Phasenzeile für Listen: „Phase 02 von 4 · Fragebogen wird freigeschaltet“. */
export function PhaseLine({ view }: { view: ApplicantView }) {
  const phase = PHASES[view.phase - 1]
  return (
    <span className={styles.phaseLine}>
      <span className={styles.phaseLineDots} aria-hidden="true">
        {view.steps.map((step) => (
          <span key={step.number} className={styles[`dot_${step.state}`]} />
        ))}
      </span>
      <span>
        Phase {String(view.phase).padStart(2, '0')} von 4 · {phase.title}
        {view.steps[view.phase - 1].state === 'closed' ? ' · abgeschlossen' : ''}
      </span>
    </span>
  )
}
