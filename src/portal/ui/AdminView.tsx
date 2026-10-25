'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CircleDashed, Download, Eye, FileSpreadsheet, Info, Search, ShieldCheck } from 'lucide-react'

import { FootLabel, cx } from '@/portal/ui/fields'
import { PhaseLine, PhaseTimeline, StatusBadge } from '@/portal/ui/PhaseTimeline'
import {
  DOC_META,
  DOC_STATUS_LABEL,
  documentsProgress,
  JURY_LABEL,
  JURY_TYPE_HINT,
  JURY_TYPE_LABEL,
  assignedOf,
  juryProgress,
  PAYMENT_LABEL,
  PHASES,
  QUESTIONNAIRE_LABEL,
  RESULT_LABEL,
  PARTY_LABEL,
  REVIEW_LABEL,
  ROUND_LABEL,
  adminNext,
  applicantView,
  onlyPendingPrizes,
  canRelease,
  juryTally,
  phaseOf,
  type PhaseNumber,
} from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { summaryGroups } from '@/portal/ui/QuestionnaireSheet'
import { QUESTIONNAIRE, REQUIRED_FIELDS, isFilled, prizeTitles, prizesOf } from '@/portal/domain/questionnaire'
import { portalDemo, runCommand } from '@/portal/data/portalClient'
import type { PortalCommand } from '@/portal/domain/commands'
import { can, type Permission, type Role } from '@/portal/domain/permissions'
import { accountOf, submissionCompany, submittedSubmissions } from '@/portal/domain/selectors'
import { DOC_KEYS, JURY_TYPES, type JuryStage, type JuryType, type PortalSnapshot, type ProcessState, type ResultStatus, type RoundStatus, type Submission } from '@/portal/domain/types'
import { DocumentsCell, ExportsSection, RightsSection, RoundAdmin, documentsSummary } from '@/portal/ui/AdminAreas'
import { PageHeader } from '@/portal/ui/AppShell'
import { buildExport, buildListExport } from '@/portal/domain/exports'
import { downloadCsv } from '@/portal/ui/download'
import { JuryDashboard } from '@/portal/ui/JuryAdmin'
import { Page, type PageHandle } from '@/portal/ui/Page'
import { ReviewList, formatDate, formatDateTime, reviewGroups } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void
export type AdminTab = (typeof portalContent.admin.tabs)[number]['key']

const typeLabel = (submission: Submission) =>
  submission.type === 'fremdvorschlag' ? portalContent.submission.type.nomination.title : portalContent.submission.type.self.title

const fmtDeadline = (deadline: string) => (deadline ? formatDate(`${deadline}T12:00:00`) : '–')

/* ── Übersicht ───────────────────────────────────────────────────────────── */

/** Jeder Bereich zeigt standardmäßig nur offene Arbeit; erledigte Fälle lassen sich einblenden. */
const TAB_OPEN: Record<AdminTab, (process: ProcessState) => boolean> = {
  uebersicht: () => true,
  runde: () => true,
  anmeldungen: () => true,
  zahlungen: (process) => process.review === 'geprueft' && process.questionnaire === 'gesperrt',
  fragebogen: (process) => process.payment === 'zahlung_eingegangen' && process.questionnaire !== 'eingereicht',
  jury: (process) => process.questionnaire === 'eingereicht' && process.jury !== 'abgeschlossen',
  ergebnisse: (process) => process.jury === 'abgeschlossen' && process.result !== 'einladung' && process.result !== 'keine_einladung',
  unterlagen: (process) => process.result === 'einladung' && (!documentsProgress(process).requested || documentsProgress(process).submitted > 0),
  exporte: () => true,
  rechte: () => true,
}

const TAB_ALL: Record<AdminTab, (process: ProcessState) => boolean> = {
  uebersicht: () => true,
  runde: () => true,
  anmeldungen: () => true,
  zahlungen: (process) => process.review === 'geprueft',
  fragebogen: (process) => process.review === 'geprueft',
  jury: (process) => process.questionnaire === 'eingereicht',
  ergebnisse: (process) => process.jury === 'abgeschlossen',
  unterlagen: (process) => process.result === 'einladung',
  exporte: () => true,
  rechte: () => true,
}

/** Welches Recht ein Bereich voraussetzt (Sachbearbeitung sieht nur ihre Bereiche). */
const TAB_PERMISSION: Record<AdminTab, Permission | null> = {
  uebersicht: null,
  runde: 'round',
  anmeldungen: 'review',
  zahlungen: 'payment',
  fragebogen: 'release',
  jury: 'jury',
  ergebnisse: 'results',
  unterlagen: 'documents',
  exporte: 'exports',
  rechte: 'rights',
}

export const tabAllowed = (viewer: Role, tab: AdminTab) => !TAB_PERMISSION[tab] || can(viewer, TAB_PERMISSION[tab]!)

/** Offene Arbeit je Bereich – die Zahlen in der Seitenleiste. */
export function areaCounts(state: PortalSnapshot): Partial<Record<AdminTab, number>> {
  const all = submittedSubmissions(state)
  const open = (tab: AdminTab) => all.filter((submission) => TAB_OPEN[tab](submission.process)).length
  return {
    uebersicht: all.filter((submission) => adminNext(submission.process, submission.type).party === 'verwaltung').length,
    anmeldungen: all.filter((submission) => submission.process.review !== 'geprueft').length,
    zahlungen: open('zahlungen'),
    fragebogen: open('fragebogen'),
    jury: open('jury'),
    ergebnisse: open('ergebnisse'),
    unterlagen: open('unterlagen'),
  }
}

/** Aufschlüsselung einer Phase für die Übersicht (nur vorhandene Zustände). */
function phaseBreakdown(list: Submission[], phase: PhaseNumber): string {
  const parts = portalContent.admin.funnel.parts
  const inPhase = list.filter((submission) => phaseOf(submission.process) === phase).map((submission) => submission.process)
  const tally = (label: string, test: (process: ProcessState) => boolean) => [label, inPhase.filter(test).length] as const
  const entries =
    phase === 1
      ? [tally(parts.neu, (p) => p.review === 'neu'), tally(parts.in_pruefung, (p) => p.review === 'in_pruefung'), tally(parts.rueckfrage, (p) => p.review === 'rueckfrage')]
      : phase === 2
        ? [
            tally(parts.rechnungFolgt, (p) => p.questionnaire === 'gesperrt' && p.payment === 'keine_rechnung'),
            tally(parts.rechnungOffen, (p) => p.questionnaire === 'gesperrt' && p.payment === 'rechnung_offen'),
            tally(parts.freigabeOffen, (p) => p.questionnaire === 'gesperrt' && p.payment === 'zahlung_eingegangen'),
            tally(parts.inArbeit, (p) => p.questionnaire === 'verfuegbar' || p.questionnaire === 'in_bearbeitung'),
            tally(parts.eingereicht, (p) => p.questionnaire === 'eingereicht'),
          ]
        : phase === 3
          ? [tally(parts.zugewiesen, (p) => p.jury === 'zugewiesen'), tally(parts.jury1, (p) => p.jury === 'jury1'), tally(parts.jury2, (p) => p.jury === 'jury2')]
          : [tally(parts.offen, (p) => p.result !== 'einladung' && p.result !== 'keine_einladung'), tally(parts.keine, (p) => p.result === 'keine_einladung')]
  return entries
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`)
    .join(' · ')
}

/**
 * Nächster Schritt direkt aus der Liste ausführen – nur für Schritte ohne weitere Eingaben. Prüfung, Freigabe (Frist)
 * und Ergebnis laufen bewusst über den Vorgang.
 */
function quickAction(submission: Submission, viewer: Role): { label: string; run: () => void } | null {
  const p = submission.process
  const id = submission.id
  const progress = juryProgress(p)
  const act = (label: string, command: PortalCommand) => ({ label, run: () => void runCommand(command) })
  if (p.result === 'einladung') {
    return !documentsProgress(p).requested && can(viewer, 'documents') ? act(portalContent.admin.docs.request, { type: 'documents.request', submissionId: id }) : null
  }
  if (p.review === 'geprueft' && p.questionnaire === 'gesperrt') {
    if (!can(viewer, 'payment')) return null
    if (p.payment === 'keine_rechnung') return act('Rechnung stellen', { type: 'payment.invoice', submissionId: id })
    if (p.payment === 'rechnung_offen') return act('Zahlung bestätigen', { type: 'payment.confirm', submissionId: id })
    return null
  }
  if (p.questionnaire !== 'eingereicht' || p.result === 'keine_einladung' || !can(viewer, 'jury')) return null
  // Ohne eigene Auswahl weist der Befehl die Standardbesetzung zu.
  if (p.jury === 'nicht_zugewiesen') return act('Der Jury zuweisen', { type: 'jury.assign', submissionId: id })
  if (p.jury === 'zugewiesen' && progress.jury1.assigned > 0) return act('Jury 1 starten', { type: 'jury.start', submissionId: id, stage: 'jury1' })
  if (p.jury === 'jury1' && progress.jury1.done === progress.jury1.assigned && progress.jury1.assigned > 0 && progress.jury2.assigned > 0)
    return act('Jury 2 starten', { type: 'jury.start', submissionId: id, stage: 'jury2' })
  if (p.jury === 'jury2' && progress.jury2.done === progress.jury2.assigned && progress.jury2.assigned > 0)
    return act('Juryprüfung abschließen', { type: 'jury.finish', submissionId: id })
  return null
}

const hasAnswers = (submission: Submission) => submission.process.questionnaire === 'in_bearbeitung' || submission.process.questionnaire === 'eingereicht'

const fmtAverage = (value: number | null) => (value === null ? '–' : value.toLocaleString('de-DE', { maximumFractionDigits: 1 }))

export function AdminOverview({
  state,
  tab,
  navigate,
  viewer,
  sessionAccountId,
}: {
  state: PortalSnapshot
  tab: AdminTab
  navigate: Navigate
  viewer: Role
  sessionAccountId: string | null
}) {
  const copy = portalContent.admin
  const all = submittedSubmissions(state)
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<PhaseNumber | 0>(0)
  const [exported, setExported] = useState<{ filename: string; count: number } | null>(null)
  const [showDone, setShowDone] = useState(false)
  const inTab = all.filter((submission) => (showDone ? TAB_ALL : TAB_OPEN)[tab](submission.process))
  // Phasenzähler beziehen sich auf den aktuellen Bereich.
  const counts = useMemo(() => {
    const result: Record<PhaseNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    inTab.forEach((submission) => (result[phaseOf(submission.process)] += 1))
    return result
  }, [inTab])

  const saveExport = (result: { filename: string; csv: string; count: number }) => {
    downloadCsv(result.filename, result.csv)
    setExported({ filename: result.filename, count: result.count })
  }

  const rows = inTab.filter((submission) => {
    if (phase && phaseOf(submission.process) !== phase) return false
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return submissionCompany(submission).toLowerCase().includes(needle) || (submission.reference || '').toLowerCase().includes(needle)
  })

  const tabInfo = copy.tabs.find((item) => item.key === tab)!
  const lead =
    tab === 'uebersicht' ? (
      <>
        {copy.round} · {copy.roundStatus}: <strong>{ROUND_LABEL[state.round]}</strong>
      </>
    ) : tab === 'exporte' ? (
      copy.exportsRights.exportsLead
    ) : tab === 'rechte' ? (
      copy.exportsRights.rightsLead
    ) : undefined

  return (
    <div className={styles.view}>
      <PageHeader
        title={tabInfo.title}
        lead={lead}
        actions={
          tab === 'uebersicht' && can(viewer, 'round') ? (
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate('/portal/admin?bereich=runde')}>
              {copy.manageRound}
            </button>
          ) : undefined
        }
      />
      {tab === 'uebersicht' && (
        <div className={styles.phaseCounts} role="group" aria-label="Nach Phase filtern">
          {PHASES.map((item) => (
            <button
              key={item.number}
              type="button"
              className={cx(styles.phaseCount, phase === item.number && styles.phaseCountActive)}
              onClick={() => setPhase(phase === item.number ? 0 : item.number)}
              aria-pressed={phase === item.number}
            >
              <span className={styles.phaseCountNum}>{counts[item.number]}</span>
              <span className={styles.phaseCountLabel}>
                Phase {String(item.number).padStart(2, '0')} · {item.title}
              </span>
              <span className={styles.phaseCountCaption}>
                {item.number === 4
                  ? copy.funnel.invited(inTab.filter((submission) => submission.process.result === 'einladung').length)
                  : copy.funnel.captions[item.number]}
              </span>
              {phaseBreakdown(inTab, item.number) && <span className={styles.phaseCountParts}>{phaseBreakdown(inTab, item.number)}</span>}
            </button>
          ))}
        </div>
      )}
        {!tabAllowed(viewer, tab) ? (
          <p className={styles.tableEmpty}>{copy.noPermission}</p>
        ) : tab === 'runde' ? (
          <RoundAdmin state={state} />
        ) : tab === 'exporte' ? (
          <ExportsSection state={state} />
        ) : tab === 'rechte' ? (
          <RightsSection state={state} sessionAccountId={sessionAccountId} />
        ) : (
          <>
            {tab === 'jury' && <JuryDashboard state={state} navigate={navigate} />}
            {tab === 'uebersicht' && <TaskList rows={rows} state={state} navigate={navigate} viewer={viewer} />}
            {tab === 'unterlagen' && <p className={styles.noticeInline} style={{ marginBottom: 14 }}>{copy.docs.placeholder}</p>}
            {tab === 'uebersicht' && (
              <h2 className={styles.sectionTitle} style={{ margin: '8px 0 14px' }}>
                {copy.overview.allTitle}
              </h2>
            )}
            <div className={styles.toolbar}>
              <label className={styles.searchWrap}>
                <Search size={16} aria-hidden="true" />
                <span className={styles.srOnly}>{copy.search}</span>
                <input className={styles.searchInput} type="search" placeholder={copy.searchShort} value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              {phase !== 0 && (
                <button type="button" className={cx(styles.chip, styles.chipActive)} onClick={() => setPhase(0)}>
                  Phase {String(phase).padStart(2, '0')} · {copy.clearFilter}
                </button>
              )}
              {tab !== 'anmeldungen' && tab !== 'uebersicht' && (
                <button type="button" className={styles.textBtn} aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
                  {showDone ? copy.hideDone : copy.showDone}
                </button>
              )}
              {tab === 'ergebnisse' && (
                <>
                  <button type="button" className={styles.textBtn} onClick={() => saveExport(buildExport(state, 'mail_eingeladen'))}>
                    <Download size={15} aria-hidden="true" />
                    {copy.mailingInvited}
                  </button>
                  <button type="button" className={styles.textBtn} onClick={() => saveExport(buildExport(state, 'mail_keine'))}>
                    <Download size={15} aria-hidden="true" />
                    {copy.mailingDeclined}
                  </button>
                </>
              )}
              {can(viewer, 'exports') && (
                <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => saveExport(buildListExport(state, rows, tab))}>
                  <FileSpreadsheet size={15} aria-hidden="true" />
                  {copy.listExport}
                </button>
              )}
            </div>
            {exported && (
              <p className={styles.notice} role="status" style={{ marginBottom: 14 }}>
                <Info size={16} aria-hidden="true" />
                {copy.listExportDone(exported.filename, exported.count)}
              </p>
            )}
            <AdminTable rows={rows} tab={tab} state={state} navigate={navigate} viewer={viewer} />
          </>
        )}
    </div>
  )
}

/** Übersicht: Vorgänge, bei denen die Verwaltung am Zug ist – mit dem nächsten Schritt direkt zum Ausführen. */
function TaskList({ rows, state, navigate, viewer }: { rows: Submission[]; state: PortalSnapshot; navigate: Navigate; viewer: Role }) {
  const copy = portalContent.admin.overview
  const tasks = rows.filter((submission) => adminNext(submission.process, submission.type).party === 'verwaltung')
  return (
    <section className={styles.taskSection} aria-labelledby="admin-tasks">
      <h2 className={styles.sectionTitle} id="admin-tasks">
        {copy.tasksTitle} <span className={styles.taskCount}>{tasks.length}</span>
      </h2>
      <p className={styles.juryBoardLead}>{copy.tasksLead}</p>
      {tasks.length === 0 ? (
        <p className={styles.tableEmpty}>{copy.tasksEmpty}</p>
      ) : (
        <ul className={styles.taskList}>
          {tasks.map((submission) => {
            const view = applicantView(submission.process, submission.type, submissionCompany(submission))
            const next = adminNext(submission.process, submission.type)
            const quick = quickAction(submission, viewer)
            return (
              <li key={submission.id} className={styles.taskItem}>
                <div className={styles.taskText}>
                  <span className={styles.tableCompany}>{submissionCompany(submission)}</span>
                  <span className={styles.tableSub}>
                    <span className={styles.tableMono}>{submission.reference}</span>
                    <span>{typeLabel(submission)}</span>
                  </span>
                  <PhaseLine view={view} />
                </div>
                <div className={styles.taskNext}>
                  <span className={cx(styles.adminNext, styles.adminNextOwn)}>
                    <span className={styles.adminNextWho}>{PARTY_LABEL[next.party]}</span>
                    {next.label}
                  </span>
                  <div className={styles.taskActions}>
                    {quick && (
                      <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} onClick={quick.run}>
                        {quick.label}
                        <span className={styles.srOnly}>: {submissionCompany(submission)}</span>
                      </button>
                    )}
                    {hasAnswers(submission) && (
                      <button type="button" className={styles.textBtn} onClick={() => navigate(`/portal/admin/fragebogen/${submission.id}`)}>
                        {copy.viewQuestionnaire}
                        <span className={styles.srOnly}>: {submissionCompany(submission)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)}
                      onClick={() => navigate(`/portal/admin/vorgang/${submission.id}`)}
                    >
                      {copy.openCase}
                      <span className={styles.srOnly}>: {submissionCompany(submission)}</span>
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Live-Ansicht eines Fragebogens für die Verwaltung: zuletzt gespeicherter Stand, aktualisiert sich mit jeder Speicherung. */
export function AdminQuestionnaireSheet({ submission, onClose, onOpenCase }: { submission: Submission; onClose: () => void; onOpenCase: () => void }) {
  const copy = portalContent.admin.liveQuestionnaire
  const sheetRef = React.useRef<PageHandle>(null)
  const p = submission.process
  const filled = REQUIRED_FIELDS.filter((field) => isFilled(p.answers, field)).length
  const prizes = prizesOf(p.answers)
  const started = Object.keys(p.answers).length > 0

  return (
    <Page
      ref={sheetRef}
      title={submissionCompany(submission)}
      subtitle={copy.subtitle}
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.list}
      meta={
        <>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            {copy.live}
          </span>
          <span className={styles.pageMetaNote}>{copy.liveHint}</span>
          <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, styles.pageMetaAction)} onClick={onOpenCase}>
            {copy.openCase}
          </button>
        </>
      }
    >
      <dl className={styles.reviewList} style={{ marginBottom: 20 }}>
        <div className={styles.reviewRow}>
          <dt>{copy.status}</dt>
          <dd>{QUESTIONNAIRE_LABEL[p.questionnaire]}</dd>
        </div>
        <div className={styles.reviewRow}>
          <dt>{copy.progress}</dt>
          <dd>
            {portalContent.admin.overview.progress(filled, REQUIRED_FIELDS.length)}
            {p.questionnaire === 'in_bearbeitung' ? ` · ${copy.section(Math.min(p.questionnaireStep + 1, QUESTIONNAIRE.length + 1), QUESTIONNAIRE.length + 1)}` : ''}
          </dd>
        </div>
        <div className={styles.reviewRow}>
          <dt>{p.questionnaire === 'eingereicht' ? copy.submittedAt : copy.savedAt}</dt>
          <dd>{formatDateTime(p.questionnaire === 'eingereicht' ? p.questionnaireSubmittedAt : p.questionnaireSavedAt)}</dd>
        </div>
        <div className={styles.reviewRow}>
          <dt>{copy.prizes}</dt>
          <dd>{prizeTitles(prizes) || '–'}</dd>
        </div>
      </dl>
      {started ? <ReviewList groups={summaryGroups(p.answers)} /> : <p className={styles.tableEmpty}>{copy.none}</p>}
    </Page>
  )
}

function AdminTable({ rows, tab, state, navigate, viewer }: { rows: Submission[]; tab: AdminTab; state: PortalSnapshot; navigate: Navigate; viewer: Role }) {
  const copy = portalContent.admin
  const c = copy.columns
  const extra: Array<{ label: string; value: (submission: Submission) => React.ReactNode }> =
    tab === 'uebersicht'
      ? [
          {
            label: copy.overview.questionnaireCol,
            value: (s) => (
              <span className={styles.tableStack}>
                <span>{QUESTIONNAIRE_LABEL[s.process.questionnaire]}</span>
                {hasAnswers(s) && (
                  <>
                    <span className={styles.tableSubText}>
                      {copy.overview.progress(REQUIRED_FIELDS.filter((field) => isFilled(s.process.answers, field)).length, REQUIRED_FIELDS.length)}
                    </span>
                    <button type="button" className={cx(styles.textBtn, styles.nowrap)} onClick={() => navigate(`/portal/admin/fragebogen/${s.id}`)}>
                      {copy.overview.viewLive}
                      <span className={styles.srOnly}>: {submissionCompany(s)}</span>
                    </button>
                  </>
                )}
              </span>
            ),
          },
        ]
      : tab === 'unterlagen'
        ? [
            { label: copy.docs.column, value: (s) => documentsSummary(s.process) },
            { label: copy.docs.mediaColumn, value: (s) => <DocumentsCell process={s.process} /> },
          ]
      : tab === 'zahlungen'
      ? [{ label: c.payment, value: (s) => PAYMENT_LABEL[s.process.payment] }]
      : tab === 'fragebogen'
        ? [
            { label: c.prize, value: (s) => prizeTitles(prizesOf(s.process.answers), 'short') || '–' },
            { label: c.questionnaire, value: (s) => QUESTIONNAIRE_LABEL[s.process.questionnaire] },
            { label: c.deadline, value: (s) => fmtDeadline(s.process.deadline) },
          ]
        : tab === 'jury'
          ? [
              { label: c.jury, value: (s) => JURY_LABEL[s.process.jury] },
              {
                label: c.votesPoints,
                value: (s) => {
                  const tally = juryTally(s.process)
                  const progress = juryProgress(s.process)
                  return (
                    <span className={styles.tableStack}>
                      <span>
                        Jury 1: {progress.jury1.done}/{progress.jury1.assigned} · Ja {tally.ja} · Vielleicht {tally.vielleicht} · Nein {tally.nein}
                      </span>
                      <span>
                        Jury 2: {progress.jury2.done}/{progress.jury2.assigned} · Ø {fmtAverage(tally.average)}
                      </span>
                    </span>
                  )
                },
              },
            ]
          : tab === 'ergebnisse'
            ? [{ label: c.result, value: (s) => RESULT_LABEL[s.process.result] }]
            : [
                { label: c.type, value: (s) => typeLabel(s) },
                { label: c.date, value: (s) => formatDate(s.submittedAt) },
              ]

  if (!rows.length) return <p className={styles.tableEmpty}>{copy.empty}</p>

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{c.company}</th>
            {extra.map((column) => (
              <th key={column.label} scope="col">
                {column.label}
              </th>
            ))}
            <th scope="col">{c.phaseStatus}</th>
            <th scope="col">{c.next}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((submission) => {
            const view = applicantView(submission.process, submission.type, submissionCompany(submission))
            const owner = accountOf(state, submission.accountId)
            const next = adminNext(submission.process, submission.type)
            const quick = quickAction(submission, viewer)
            return (
              <tr key={submission.id}>
                <td className={styles.tableCompanyCell}>
                  <div>
                    <span className={styles.tableCompany}>{submissionCompany(submission)}</span>
                    <span className={styles.tableSub}>
                      <span className={styles.tableMono}>{submission.reference}</span>
                      {tab !== 'anmeldungen' && <span>{typeLabel(submission)}</span>}
                      {submission.sample || owner?.id === 'demo-beispiele' ? <span className={styles.demoTag}>{copy.sample}</span> : null}
                    </span>
                  </div>
                </td>
                {extra.map((column) => (
                  <td key={column.label} data-label={column.label}>
                    {column.value(submission)}
                  </td>
                ))}
                <td data-label={c.phaseStatus}>
                  <div className={styles.tableStack}>
                    <PhaseLine view={view} />
                    <StatusBadge label={view.status.label} tone={view.status.tone} />
                  </div>
                </td>
                <td data-label={c.next}>
                  <div className={styles.adminNextCell}>
                    <span className={cx(styles.adminNext, next.party === 'verwaltung' && styles.adminNextOwn)}>
                      <span className={styles.adminNextWho}>{PARTY_LABEL[next.party]}</span>
                      {next.label}
                    </span>
                    {quick && (
                      <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} onClick={quick.run}>
                        {quick.label}
                        <span className={styles.srOnly}>: {submissionCompany(submission)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)}
                      onClick={() => navigate(`/portal/admin/vorgang/${submission.id}${tab !== 'anmeldungen' ? `?bereich=${tab}` : ''}`)}
                    >
                      {copy.open}
                      <span className={styles.srOnly}>: {submissionCompany(submission)}</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Vorgang (Verwaltung) ────────────────────────────────────────────────── */

export function AdminVorgangSheet({
  state,
  submission,
  onClose,
  onOpenApplicant,
  onOpenQuestionnaire,
  viewer = 'verwaltung',
}: {
  state: PortalSnapshot
  submission: Submission
  onClose: () => void
  /** Nur Prototyp: in die Bewerberansicht wechseln (Demo-Steuerung). Ohne Funktion entfällt der Button. */
  onOpenApplicant?: () => void
  /** Live-Ansicht des Fragebogens (Verwaltung). */
  onOpenQuestionnaire?: () => void
  /** Rolle der angemeldeten Person – Bereiche ohne Recht sind nur lesbar. */
  viewer?: Role
}) {
  const copy = portalContent.admin.sheet
  const sheetRef = React.useRef<PageHandle>(null)
  const p = submission.process
  const view = applicantView(p, submission.type, submissionCompany(submission))
  const owner = accountOf(state, submission.accountId)
  const id = submission.id
  const run = (command: PortalCommand) => void runCommand(command)
  const beforeRelease = p.questionnaire === 'gesperrt'
  // Die Prüfung lässt sich nur ändern, solange noch keine Rechnung gestellt ist.
  const reviewEditable = beforeRelease && p.payment === 'keine_rechnung'
  // Jurystufen nur in Reihenfolge und erst, wenn die Stimmen der vorigen Stufe vollständig sind.
  const progress = juryProgress(p)
  const allVotes = progress.jury1.assigned > 0 && progress.jury1.done === progress.jury1.assigned
  const allPoints = progress.jury2.assigned > 0 && progress.jury2.done === progress.jury2.assigned
  const decided = p.result === 'einladung' || p.result === 'keine_einladung'
  const stageAllowed = (stage: JuryStage) => {
    if (p.questionnaire !== 'eingereicht' || decided) return false
    if (stage === 'zugewiesen') return p.jury === 'nicht_zugewiesen'
    if (stage === 'jury1') return p.jury === 'zugewiesen' && progress.jury1.assigned > 0
    if (stage === 'jury2') return p.jury === 'jury1' && allVotes
    return p.jury === 'jury2' && allPoints
  }
  // Nur die Steuerung des nächsten Schritts ist hervorgehoben.
  const nextStep = adminNext(p, submission.type).label
  const isNomination = submission.type === 'fremdvorschlag'
  const setResult = (value: ResultStatus) => {
    if (p.result === 'einladung' && value !== 'einladung' && !window.confirm(copy.withdrawConfirm)) return
    if (p.result === 'keine_einladung' && value !== 'keine_einladung' && !window.confirm(copy.revertConfirm)) return
    run({ type: 'result.set', submissionId: id, result: value })
  }
  const tally = juryTally(p)
  const stageCommand = (stage: JuryStage): PortalCommand =>
    stage === 'zugewiesen'
      ? { type: 'jury.assign', submissionId: id }
      : stage === 'abgeschlossen'
        ? { type: 'jury.finish', submissionId: id }
        : { type: 'jury.start', submissionId: id, stage: stage as JuryType }

  return (
    <Page
      ref={sheetRef}
      title={submissionCompany(submission)}
      subtitle={
        <>
          {[typeLabel(submission), prizeTitles(prizesOf(submission.process.answers))].filter(Boolean).join(' · ')} · Eingangsnummer{' '}
          <span className={styles.nowrap}>{submission.reference}</span> · eingereicht am {formatDate(submission.submittedAt)}
        </>
      }
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.list}
      meta={
        <>
          <StatusBadge label={view.status.label} tone={view.status.tone} />
          {onOpenApplicant && (
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, styles.pageMetaAction)} onClick={onOpenApplicant}>
              <Eye size={16} aria-hidden="true" />
              {isNomination ? copy.openNominator : copy.openApplicant}
            </button>
          )}
        </>
      }
    >
      <div className={styles.caseLayout}>
        <div className={styles.controlList}>
          <Control number={1} title={copy.blocks.review} state={REVIEW_LABEL[p.review]} done={p.review === 'geprueft'} readOnly={!can(viewer, 'review')}>
            <div className={styles.controlActions}>
              <ControlButton active={p.review === 'in_pruefung'} disabled={!reviewEditable} onClick={() => run({ type: 'review.set', submissionId: id, status: 'in_pruefung' })}>
                {copy.reviewActions.inReview}
              </ControlButton>
              <ControlButton active={p.review === 'rueckfrage'} disabled={!reviewEditable} onClick={() => run({ type: 'review.set', submissionId: id, status: 'rueckfrage' })}>
                {copy.reviewActions.question}
              </ControlButton>
              <ControlButton primary={reviewEditable && p.review !== 'geprueft'} active={p.review === 'geprueft'} disabled={!reviewEditable} onClick={() => run({ type: 'review.set', submissionId: id, status: 'geprueft' })}>
                {copy.reviewActions.approve}
              </ControlButton>
            </div>
            {owner && submission.type && (
              <details className={styles.blockDetails}>
                <summary className={styles.blockToggle}>{portalContent.vorgang.showDetails}</summary>
                <div className={styles.blockBody}>
                  <ReviewList groups={reviewGroups(submission.type, submission.self, submission.nomination, owner)} />
                </div>
              </details>
            )}
          </Control>

          <Control number={2} title={copy.blocks.payment} state={PAYMENT_LABEL[p.payment]} done={p.payment === 'zahlung_eingegangen'} locked={p.review !== 'geprueft'} readOnly={!can(viewer, 'payment')}>
            <Requirements items={[{ label: copy.requirements.reviewed, met: p.review === 'geprueft' }]} />
            <div className={styles.controlActions}>
              <ControlButton
                primary={nextStep === 'Rechnung stellen'}
                active={p.payment !== 'keine_rechnung'}
                disabled={p.review !== 'geprueft' || !beforeRelease || p.payment !== 'keine_rechnung'}
                onClick={() => run({ type: 'payment.invoice', submissionId: id })}>
                {copy.paymentActions.invoice}
              </ControlButton>
              <ControlButton
                primary={p.payment === 'rechnung_offen'}
                active={p.payment === 'zahlung_eingegangen'}
                disabled={p.payment === 'keine_rechnung' || !beforeRelease}
                onClick={() => run({ type: 'payment.confirm', submissionId: id })}
              >
                {copy.paymentActions.paid}
              </ControlButton>
            </div>
            <p className={styles.noticeInline}>{copy.paymentNote}</p>
          </Control>

          <Control number={3} title={copy.blocks.release} state={QUESTIONNAIRE_LABEL[p.questionnaire]} done={!beforeRelease} locked={p.review !== 'geprueft'} readOnly={!can(viewer, 'release')}>
            <Requirements
              items={[
                { label: copy.requirements.reviewed, met: p.review === 'geprueft' },
                { label: copy.requirements.paid, met: p.payment === 'zahlung_eingegangen' },
                { label: copy.requirements.deadline, met: Boolean(p.deadline) },
              ]}
            />
            <div className={styles.controlRow}>
              <label className={styles.field} style={{ maxWidth: 240 }}>
                <span className={styles.label}>{copy.deadline}</span>
                <input
                  type="date"
                  className={styles.input}
                  value={p.deadline}
                  onChange={(event) => run({ type: 'questionnaire.setDeadline', submissionId: id, deadline: event.target.value })}
                />
                {!p.deadline && beforeRelease && state.roundSettings.questionnaireDeadline && (
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => run({ type: 'questionnaire.setDeadline', submissionId: id, deadline: state.roundSettings.questionnaireDeadline })}
                  >
                    {copy.useDefaultDeadline(fmtDeadline(state.roundSettings.questionnaireDeadline))}
                  </button>
                )}
              </label>
              <ControlButton
                primary={nextStep === 'Fragebogen freigeben'}
                active={!beforeRelease}
                disabled={!canRelease(p) || !p.deadline || !beforeRelease}
                onClick={() => run({ type: 'questionnaire.release', submissionId: id })}
              >
                {beforeRelease ? copy.release : copy.released}
              </ControlButton>
            </div>
            {(p.questionnaire === 'in_bearbeitung' || p.questionnaire === 'eingereicht') && onOpenQuestionnaire && (
              <button type="button" className={styles.textBtn} onClick={onOpenQuestionnaire}>
                <Eye size={15} aria-hidden="true" />
                {portalContent.admin.overview.viewQuestionnaire}
              </button>
            )}
            {submission.type === 'fremdvorschlag' && <p className={styles.noticeInline}>{copy.nominationNote}</p>}
            {onlyPendingPrizes(p) && <p className={styles.noticeInline}>{copy.pendingPrizesNote}</p>}
          </Control>

          <Control
            number={4}
            title={copy.blocks.jury}
            state={JURY_LABEL[p.jury]}
            done={p.jury === 'abgeschlossen'}
            locked={p.questionnaire !== 'eingereicht'}
            confidential
            readOnly={!can(viewer, 'jury')}
          >
            <Requirements
              items={[
                { label: copy.requirements.submitted, met: p.questionnaire === 'eingereicht' },
                { label: copy.requirements.votes, met: allVotes },
                { label: copy.requirements.points, met: allPoints },
              ]}
            />
            <div className={styles.controlActions}>
              {(
                [
                  ['zugewiesen', copy.juryActions.assign],
                  ['jury1', copy.juryActions.jury1],
                  ['jury2', copy.juryActions.jury2],
                  ['abgeschlossen', copy.juryActions.finish],
                ] as Array<[JuryStage, string]>
              ).map(([stage, label]) => (
                <ControlButton
                  key={stage}
                  primary={stageAllowed(stage)}
                  active={p.jury === stage}
                  disabled={!stageAllowed(stage)}
                  // Ohne eigene Auswahl weist „Der Jury zuweisen“ alle Jurymitglieder zu (Standardbesetzung).
                  onClick={() => run(stageCommand(stage))}
                >
                  {label}
                </ControlButton>
              ))}
            </div>
            {p.questionnaire === 'eingereicht' && (
              <>
                {/* Besetzung je Jury-Art: zuweisen/lösen und den Stand jedes Mitglieds sehen. */}
                <div className={styles.juryAssign}>
                  {JURY_TYPES.map((type) => (
                    <fieldset key={type} className={styles.juryAssignGroup} disabled={decided || p.jury === 'abgeschlossen'}>
                      <legend className={styles.juryAssignLegend}>
                        {JURY_TYPE_LABEL[type]} <span className={styles.optional}>· {JURY_TYPE_HINT[type]}</span>
                      </legend>
                      <ul className={styles.juryAssignList}>
                        {state.jurors
                          .filter((juror) => juror.type === type)
                          .map((juror) => {
                            const isAssigned = assignedOf(p)[type].includes(juror.id)
                            const value = type === 'jury1' ? (p.jury1[juror.id] ? portalContent.jury.votes[p.jury1[juror.id]] : null) : (p.jury2[juror.id] ?? null)
                            return (
                              <li key={juror.id}>
                                <label className={styles.check}>
                                  <input type="checkbox" checked={isAssigned} onChange={(event) => run({ type: 'jury.setMember', submissionId: id, jurorId: juror.id, assigned: event.target.checked })} />
                                  <span>{juror.name}</span>
                                </label>
                                <span className={styles.juryAssignValue}>{isAssigned ? (value ?? copy.juryOpen) : copy.juryNotAssigned}</span>
                              </li>
                            )
                          })}
                      </ul>
                    </fieldset>
                  ))}
                </div>
                {p.jury !== 'nicht_zugewiesen' && (
                  <>
                    <p className={styles.tallyLine}>
                      Ja {tally.ja} · Vielleicht {tally.vielleicht} · Nein {tally.nein} · Ø Punkte {fmtAverage(tally.average)}
                    </p>
                    {portalDemo && (
                      <button type="button" className={styles.textBtn} onClick={() => portalDemo?.simulateVotes(id)}>
                        {copy.juryActions.simulate}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </Control>

          <Control
            number={5}
            title={copy.blocks.result}
            state={RESULT_LABEL[p.result]}
            done={p.result === 'einladung' || p.result === 'keine_einladung'}
            locked={p.jury !== 'abgeschlossen'}
            readOnly={!can(viewer, 'results')}
          >
            <Requirements items={[{ label: copy.requirements.juryDone, met: p.jury === 'abgeschlossen' }]} />
            <div className={styles.controlActions}>
              {(
                [
                  ['ausstehend', copy.resultActions.pending],
                  ['vorbereitet', copy.resultActions.prepare],
                  ['einladung', copy.resultActions.invite],
                  ['keine_einladung', copy.resultActions.decline],
                ] as Array<[ResultStatus, string]>
              ).map(([value, label]) => (
                <ControlButton key={value} active={p.result === value} disabled={p.jury !== 'abgeschlossen'} onClick={() => setResult(value)}>
                  {label}
                </ControlButton>
              ))}
            </div>
            <p className={styles.noticeInline}>
              {copy.resultNote} {copy.noMessages}
            </p>
          </Control>

          <Control
            number={6}
            title={portalContent.admin.tabs.find((item) => item.key === 'unterlagen')!.title}
            state={documentsSummary(p)}
            done={documentsProgress(p).requested && documentsProgress(p).approved === documentsProgress(p).total}
            locked={p.result !== 'einladung'}
            readOnly={!can(viewer, 'documents')}
          >
            <Requirements items={[{ label: portalContent.admin.docs.requirement, met: p.result === 'einladung' }]} />
            {p.result === 'einladung' && !p.documents && (
              <div className={styles.controlActions}>
                <ControlButton primary onClick={() => run({ type: 'documents.request', submissionId: id })}>
                  {portalContent.admin.docs.request}
                </ControlButton>
              </div>
            )}
            {p.documents && (
              <ul className={cx(styles.juryAssignList, styles.docReviewList)}>
                {DOC_KEYS.map((key) => {
                  const item = p.documents!.items[key]
                  return (
                    <li key={key}>
                      <span className={styles.tableStack}>
                        <strong>{DOC_META[key].label}</strong>
                        <span className={styles.tableSubText}>{item.fileName ?? (item.value ? item.value.slice(0, 120) : portalContent.admin.docs.notSubmitted)}</span>
                      </span>
                      <span className={styles.docActions}>
                        <span className={cx(styles.docState, styles[`docState_${item.status}`])}>{DOC_STATUS_LABEL[item.status]}</span>
                        <ControlButton active={item.status === 'geprueft'} disabled={item.status === 'offen'} onClick={() => run({ type: 'documents.review', submissionId: id, key, status: 'geprueft' })}>
                          {portalContent.admin.docs.approve}
                        </ControlButton>
                        <ControlButton
                          active={item.status === 'nachbesserung'}
                          disabled={item.status === 'offen'}
                          onClick={() => run({ type: 'documents.review', submissionId: id, key, status: 'nachbesserung', note: portalContent.admin.docs.fixNote })}
                        >
                          {portalContent.admin.docs.fix}
                        </ControlButton>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className={styles.noticeInline}>{portalContent.admin.docs.placeholder}</p>
          </Control>

        </div>

        <aside className={styles.caseAside}>
          <section aria-labelledby="admin-applicant-sees">
            <h2 className={styles.miniHeading} id="admin-applicant-sees">
              {isNomination ? copy.nominatorSees : copy.applicantSees}
            </h2>
            <PhaseTimeline view={view} compact />
          </section>

          <section className={styles.logBox} aria-labelledby="admin-log">
            <h2 className={styles.miniHeading} id="admin-log">
              {copy.log}
            </h2>
            {p.log.length ? (
              <ol className={styles.logList}>
                {[...p.log].reverse().map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <span className={styles.logTime}>{formatDateTime(entry.at)}</span>
                    <span>{entry.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.hint}>{copy.logEmpty}</p>
            )}
          </section>
        </aside>
      </div>
    </Page>
  )
}

function Control({
  number,
  title,
  state,
  done,
  locked,
  confidential,
  readOnly,
  children,
}: {
  number: number
  title: string
  state: string
  done?: boolean
  locked?: boolean
  confidential?: boolean
  /** Ohne Recht: sichtbar, aber nicht bedienbar (z. B. Sachbearbeitung bei Jury und Ergebnis). */
  readOnly?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={cx(styles.control, locked && styles.controlLocked)} aria-labelledby={`control-${number}`}>
      <div className={styles.controlHead}>
        <span className={cx(styles.controlNum, done && styles.controlNumDone)} aria-hidden="true">
          {done ? <Check size={14} strokeWidth={3} /> : number}
        </span>
        <div className={styles.controlHeadText}>
          <h2 className={styles.controlTitle} id={`control-${number}`}>
            {title}
          </h2>
          <span className={styles.controlState}>{state}</span>
        </div>
        {confidential && (
          <span className={styles.confidential}>
            <ShieldCheck size={14} aria-hidden="true" />
            {portalContent.admin.sheet.confidential}
          </span>
        )}
      </div>
      <div className={styles.controlBody}>
        {readOnly ? (
          <>
            <p className={styles.noticeInline}>{portalContent.admin.sheet.readOnly}</p>
            <fieldset disabled className={styles.controlFieldset}>
              {children}
            </fieldset>
          </>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function ControlButton({
  children,
  onClick,
  disabled,
  active,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      className={cx(styles.controlBtn, primary && styles.controlBtnPrimary, active && styles.controlBtnActive)}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {active && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      {children}
    </button>
  )
}

function Requirements({ items }: { items: Array<{ label: string; met: boolean }> }) {
  const copy = portalContent.admin.sheet
  return (
    <ul className={styles.requirements} aria-label={copy.requirement}>
      {items.map((item) => (
        <li key={item.label} className={item.met ? styles.reqMet : styles.reqOpen}>
          {item.met ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <CircleDashed size={14} aria-hidden="true" />}
          <span>
            {copy.requirement}: {item.label} – {item.met ? copy.requirementMet : copy.requirementOpen}
          </span>
        </li>
      ))}
    </ul>
  )
}

