'use client'

import React, { useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

import { PageHeader } from '@/portal/ui/AppShell'
import { cx } from '@/portal/ui/fields'
import { StatusBadge } from '@/portal/ui/PhaseTimeline'
import { JURY_LABEL, JURY_TYPE_HINT, JURY_TYPE_LABEL, assignedOf, isEvaluated } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand } from '@/portal/data/portalClient'
import { jurorById, submissionCompany, submittedSubmissions } from '@/portal/domain/selectors'
import type { Account, Juror, JuryVote, PortalSnapshot, Submission } from '@/portal/domain/types'
import { prizeTitles } from '@/portal/domain/questionnaire'
import { APPLICATION_DOCS } from '@/portal/domain/application'
import { ApplicationContents, DocFileList } from '@/portal/ui/ApplicationView'
import styles from '@/portal/ui/portal.module.css'

const VOTES: JuryVote[] = ['ja', 'vielleicht', 'nein']
const STAGE_ORDER = ['nicht_zugewiesen', 'zugewiesen', 'jury1', 'jury2', 'abgeschlossen']

/** Ebene C für das Jurymitglied: Ist in seiner Bewertungsrunde die eigene Bewertung noch offen? */
function ownStatus(process: Submission['process'], juror: Juror): { label: string; open: boolean } {
  const copy = portalContent.jury.own
  if (isEvaluated(process, juror.type, juror.id)) return { label: copy.done, open: false }
  if (process.jury === juror.type) return { label: copy.open, open: true }
  if (STAGE_ORDER.indexOf(process.jury) < STAGE_ORDER.indexOf(juror.type)) return { label: copy.notStarted, open: false }
  return { label: copy.closed, open: false }
}

/**
 * Juryansicht: Jedes Mitglied gehört zu genau einer Jury-Art – Jury 1 stimmt Ja/Vielleicht/Nein, Jury 2 vergibt Punkte –
 * und sieht nur die ihm zugewiesenen Bewerbungen: je Unternehmen alle sechs Unterlagen und die Fragebögen der gewählten
 * Preise. Nie Teil der Bewerberansicht.
 */
export function JuryView({ state, account }: { state: PortalSnapshot; account: Account | null }) {
  const copy = portalContent.jury
  // Mit Jury-Zugang: das eigene Mitglied. Über die Demo-Steuerung ohne Zugang: wählbar (Vorführung).
  const ownJuror = account?.role === 'jury' ? jurorById(state, account.jurorId) : null
  const [demoJurorId, setDemoJurorId] = useState(() => state.jurors.find((juror) => juror.type === 'jury1')?.id ?? state.jurors[0]?.id)
  const juror = ownJuror ?? jurorById(state, demoJurorId)

  return (
    <div className={styles.view}>
      <PageHeader
        title={copy.title}
        lead={juror ? copy.lead(juror.name, JURY_TYPE_LABEL[juror.type], JURY_TYPE_HINT[juror.type]) : copy.noJuror}
        actions={
          <p className={styles.confidentialNote}>
            <ShieldCheck size={16} aria-hidden="true" />
            {copy.confidential}
          </p>
        }
      >
        {!ownJuror && state.jurors.length > 0 && (
          <label className={styles.juryAs}>
            <span className={styles.label}>{copy.demoAs}</span>
            <select className={styles.select} value={juror?.id ?? ''} onChange={(event) => setDemoJurorId(event.target.value)}>
              {state.jurors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {JURY_TYPE_LABEL[item.type]}
                </option>
              ))}
            </select>
          </label>
        )}
      </PageHeader>
      {juror ? <JurorList key={juror.id} state={state} juror={juror} /> : null}
    </div>
  )
}

function JurorList({ state, juror }: { state: PortalSnapshot; juror: Juror }) {
  const copy = portalContent.jury
  const mine = submittedSubmissions(state).filter(
    (submission) => submission.process.jury !== 'nicht_zugewiesen' && assignedOf(submission.process)[juror.type].includes(juror.id),
  )
  // Offene eigene Bewertungen zuerst – Reihenfolge nur beim Öffnen festlegen, damit nach einer Bewertung nichts springt.
  const [order] = useState(() =>
    [...mine].sort((a, b) => Number(ownStatus(b.process, juror).open) - Number(ownStatus(a.process, juror).open)).map((submission) => submission.id),
  )
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
  const list = [...mine].sort((a, b) => rank(a.id) - rank(b.id))
  const open = mine.filter((submission) => ownStatus(submission.process, juror).open).length

  if (list.length === 0)
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>{copy.empty}</h2>
        <p className={styles.emptyBody}>{copy.emptyHint}</p>
      </div>
    )

  return (
    <>
      <p className={styles.juryCount}>{copy.count(list.length, open)}</p>
      <ul className={styles.juryList}>
        {list.map((submission) => (
          <JuryItem key={submission.id} state={state} submission={submission} juror={juror} />
        ))}
      </ul>
    </>
  )
}

function JuryItem({ state, submission, juror }: { state: PortalSnapshot; submission: Submission; juror: Juror }) {
  const copy = portalContent.jury
  const p = submission.process
  const stageTone = p.jury === 'abgeschlossen' ? 'abgeschlossen' : p.jury === 'zugewiesen' ? 'wartend' : 'bearbeitung'
  const own = ownStatus(p, juror)
  const running = p.jury === juror.type
  const myVote = p.jury1[juror.id]
  const myPoints = p.jury2[juror.id]
  const evaluated = isEvaluated(p, juror.type, juror.id)

  return (
    <li className={styles.juryItem} aria-labelledby={`jury-${submission.id}`}>
      <div className={styles.juryHead}>
        <div>
          <h2 className={styles.rowTitle} id={`jury-${submission.id}`}>
            {submissionCompany(submission)}
          </h2>
          <p className={styles.rowMeta}>
            {p.prizes.length > 0 && <span>{prizeTitles(p.prizes)}</span>}
            <span>Eingangsnummer {submission.reference}</span>
          </p>
          <p className={cx(styles.juryOwn, own.open && styles.juryOwnOpen)}>
            {copy.own.label}: {own.label}
          </p>
        </div>
        <StatusBadge label={JURY_LABEL[p.jury]} tone={stageTone} />
      </div>

      {/* Alle Unterlagen des Unternehmens stehen offen; die Fragebögen sind lang und lassen sich aufklappen. */}
      <section className={styles.juryDocs} aria-labelledby={`jury-docs-${submission.id}`}>
        <h3 className={styles.miniHeading} id={`jury-docs-${submission.id}`}>
          {copy.docsTitle(APPLICATION_DOCS.length)}
        </h3>
        <DocFileList process={p} />
        <p className={styles.hint}>{copy.docsNote}</p>
      </section>

      <details className={styles.blockDetails}>
        <summary className={styles.blockToggle}>{copy.readAnswers(Object.keys(p.questionnaires).length)}</summary>
        <div className={styles.blockBody}>
          <ApplicationContents data={state} process={p} docs={false} />
        </div>
      </details>

      {/* Nur die Bewertungsform der eigenen Jury-Art. */}
      {juror.type === 'jury1' ? (
        <fieldset className={styles.field} disabled={!running}>
          <legend className={styles.label} style={{ marginBottom: 6 }}>
            {copy.jury1} <span className={styles.optional}>· {copy.jury1Hint}</span>
          </legend>
          <div className={styles.yesNo}>
            {VOTES.map((vote) => (
              <label key={vote} className={styles.pill}>
                <input type="radio" name={`vote-${submission.id}`} checked={myVote === vote} onChange={() => void runCommand({ type: 'jury.vote', submissionId: submission.id, jurorId: juror.id, vote })} />
                {copy.votes[vote]}
              </label>
            ))}
          </div>
          {!running && <p className={styles.hint}>{STAGE_ORDER.indexOf(p.jury) < STAGE_ORDER.indexOf('jury1') ? copy.waiting : copy.roundClosed}</p>}
        </fieldset>
      ) : (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`points-${submission.id}`}>
            {copy.jury2} <span className={styles.optional}>· {copy.jury2Hint}</span>
          </label>
          <select
            id={`points-${submission.id}`}
            className={styles.select}
            disabled={!running}
            value={myPoints ?? ''}
            onChange={(event) => void runCommand({ type: 'jury.points', submissionId: submission.id, jurorId: juror.id, points: Number(event.target.value) })}
          >
            <option value="" disabled>
              {portalContent.labels.choose}
            </option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {!running && <p className={styles.hint}>{STAGE_ORDER.indexOf(p.jury) < STAGE_ORDER.indexOf('jury2') ? copy.waitingJury2 : copy.roundClosed}</p>}
        </div>
      )}

      {/* Rückmeldung nur zur eigenen Bewertung – nie „gespeichert“ neben „offen“. */}
      {(evaluated || p.jury === 'abgeschlossen') && (
        <p className={styles.savedNote}>
          <CheckCircle2 size={14} aria-hidden="true" />
          {p.jury === 'abgeschlossen' ? copy.closed : copy.saved}
        </p>
      )}
    </li>
  )
}
