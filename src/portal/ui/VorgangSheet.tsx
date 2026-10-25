'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, ClipboardList, FileCheck2, FileText, FolderUp, Info, Lock, Mail, MapPin, Receipt, Upload } from 'lucide-react'

import Image from '@/shared/UnoptimizedImage'
import { cx } from '@/portal/ui/fields'
import { NextStep, PhaseTimeline, StatusBadge } from '@/portal/ui/PhaseTimeline'
import {
  DOC_META,
  DOC_STATUS_LABEL,
  applicantView,
  documentsProgress,
  onlyPendingPrizes,
  questionnaireLockReason,
  type ApplicantView,
} from '@/portal/domain/process'
import { QUESTIONNAIRE, prizeTitles, prizesOf } from '@/portal/domain/questionnaire'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand } from '@/portal/data/portalClient'
import { submissionCompany } from '@/portal/domain/selectors'
import { DOC_KEYS, type Account, type DocKey, type Submission } from '@/portal/domain/types'
import { Page, type PageHandle } from '@/portal/ui/Page'
import { ReviewList, formatDate, formatDateTime, reviewGroups } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void

// Abschnitte des Fragebogens plus „Prüfen & einreichen“.
const QUESTIONNAIRE_SECTIONS = QUESTIONNAIRE.length + 1

/**
 * Detailansicht eines Vorgangs aus Bewerbersicht (z. B. NEWEDGE). Reihenfolge nach Wichtigkeit:
 * Unternehmen → Art & Referenz → Status → vier Phasen → aktuelle Phase → nächste Handlung → weitere Angaben.
 */
export function VorgangSheet({
  account,
  submission,
  onClose,
  navigate,
  initialSection,
}: {
  account: Account
  submission: Submission
  onClose: () => void
  navigate: Navigate
  initialSection?: string | null
}) {
  const copy = portalContent.vorgang
  const sheetRef = useRef<PageHandle>(null)
  const company = submissionCompany(submission)
  const view = applicantView(submission.process, submission.type, company)
  const typeLabel = submission.type === 'fremdvorschlag' ? portalContent.submission.type.nomination.title : portalContent.submission.type.self.title
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const questionnairePath = `/portal/vorgang/${submission.id}/fragebogen`

  const reveal = (key: string) => {
    setOpen((current) => ({ ...current, [key]: true }))
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    window.requestAnimationFrame(() => document.getElementById(`vorgang-${key}`)?.scrollIntoView({ behavior, block: 'start' }))
  }

  // Direkter Einstieg aus der Vorgangsliste, z. B. „Rechnung ansehen“.
  useEffect(() => {
    if (initialSection && ['anmeldung', 'zahlung', 'einladung', 'unterlagen'].includes(initialSection)) {
      const timer = window.setTimeout(() => reveal(initialSection), 360)
      return () => window.clearTimeout(timer)
    }
  }, [initialSection])

  const primaryAction = () => {
    switch (view.next.action) {
      case 'viewRegistration':
        return <ActionButton secondary onClick={() => reveal('anmeldung')} label={copy.actions.viewRegistration} />
      case 'checkCompanyData':
        return <ActionButton onClick={() => reveal('anmeldung')} label={copy.actions.checkCompanyData} />
      case 'viewPayment':
        return <ActionButton onClick={() => reveal('zahlung')} label={copy.actions.viewPayment} />
      case 'editQuestionnaire':
        return <ActionButton onClick={() => navigate(questionnairePath)} label={view.next.label} />
      case 'viewQuestionnaire':
        return <ActionButton secondary onClick={() => navigate(questionnairePath)} label={copy.actions.viewQuestionnaire} />
      case 'viewInvitation':
        return <ActionButton secondary={!view.next.mustAct} onClick={() => reveal('einladung')} label={copy.actions.viewInvitation} />
      case 'uploadDocuments':
        return <ActionButton onClick={() => reveal('unterlagen')} label={copy.actions.uploadDocuments} />
      case 'changePrizes':
        return <ActionButton secondary onClick={() => navigate(`${questionnairePath}?preise=1`)} label={copy.actions.changePrizes} />
      case 'demoHandover':
        return <ActionButton secondary onClick={() => navigate(`${questionnairePath}?demo=uebergabe`)} label={copy.actions.demoHandover} />
      default:
        return null
    }
  }

  return (
    <Page
      ref={sheetRef}
      title={company}
      subtitle={
        <>
          {typeLabel} · {copy.reference} <span className={styles.nowrap}>{submission.reference}</span> · {copy.submittedOn} {formatDate(submission.submittedAt)}
        </>
      }
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.overview}
      meta={
        <>
          <StatusBadge label={view.status.label} tone={view.status.tone} />
          <span className={styles.pageMetaNote}>{copy.demoData}</span>
        </>
      }
    >
      <section aria-labelledby="vorgang-phase-heading" className={styles.vorgangTop}>
        <PhaseTimeline view={view} />

        <div className={styles.phaseCard}>
          <h2 className={styles.phaseCardTitle} id="vorgang-phase-heading">
            {view.title}
          </h2>
          <p className={styles.phaseCardText}>{view.description}</p>
          {view.demoNote && (
            <p className={styles.noticeWarn}>
              <Info size={16} aria-hidden="true" />
              {view.demoNote}
            </p>
          )}
          <NextStep view={view} action={primaryAction()} />
        </div>
      </section>

      <div className={styles.blocks}>
        <Block
          id="anmeldung"
          icon={<ClipboardList size={18} aria-hidden="true" />}
          title={copy.blocks.registration}
          status={<StatusBadge label={copy.registrationStatus} tone="abgeschlossen" />}
          open={open.anmeldung}
          onToggle={(value) => setOpen((current) => ({ ...current, anmeldung: value }))}
          summary={`${typeLabel} · ${copy.submittedOn} ${formatDateTime(submission.submittedAt)}`}
        >
          {submission.type && <ReviewList groups={reviewGroups(submission.type, submission.self, submission.nomination, account)} />}
          <p className={styles.hint} style={{ marginTop: 10 }}>
            {submission.type === 'fremdvorschlag' ? copy.registrationHintNomination : copy.registrationHint}
          </p>
        </Block>

        <PaymentBlock submission={submission} view={view} company={company} open={open.zahlung} onToggle={(value) => setOpen((current) => ({ ...current, zahlung: value }))} />

        <QuestionnaireBlock submission={submission} view={view} navigate={navigate} path={questionnairePath} />

        <ResultBlock
          submission={submission}
          view={view}
          company={company}
          open={open.einladung}
          onToggle={(value) => setOpen((current) => ({ ...current, einladung: value }))}
        />

        {submission.type === 'eigenbewerbung' && submission.process.result === 'einladung' && submission.process.documents && (
          <DocumentsBlock submission={submission} />
        )}
      </div>
    </Page>
  )
}

function ActionButton({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  return (
    <button type="button" className={cx(styles.btn, secondary ? styles.btnSecondary : styles.btnPrimary, styles.btnSmall)} onClick={onClick}>
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  )
}

/** Abschnitt mit Kopfzeile; gesperrte Abschnitte sind sichtbar, aber nicht bedienbar. */
function Block({
  id,
  icon,
  title,
  status,
  summary,
  locked,
  lockedText,
  open,
  onToggle,
  action,
  children,
}: {
  id: string
  icon: React.ReactNode
  title: string
  status?: React.ReactNode
  summary?: React.ReactNode
  locked?: boolean
  lockedText?: string
  open?: boolean
  onToggle?: (open: boolean) => void
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  const hasDetails = Boolean(children) && !locked
  return (
    <section className={cx(styles.block, locked && styles.blockLocked)} id={`vorgang-${id}`} aria-labelledby={`vorgang-${id}-title`}>
      <div className={styles.blockHead}>
        <span className={styles.blockIcon} aria-hidden="true">
          {locked ? <Lock size={16} /> : icon}
        </span>
        <div className={styles.blockHeadText}>
          <h2 className={styles.blockTitle} id={`vorgang-${id}-title`}>
            {title}
          </h2>
          <p className={styles.blockSummary}>{locked ? lockedText : summary}</p>
        </div>
        {status && !locked && <span className={styles.blockStatus}>{status}</span>}
      </div>
      {action && !locked && <div className={styles.blockAction}>{action}</div>}
      {hasDetails && (
        <details className={styles.blockDetails} open={open} onToggle={(event) => onToggle?.((event.currentTarget as HTMLDetailsElement).open)}>
          <summary className={styles.blockToggle}>{open ? portalContent.vorgang.hideDetails : portalContent.vorgang.showDetails}</summary>
          <div className={styles.blockBody}>{children}</div>
        </details>
      )}
    </section>
  )
}

function PaymentBlock({
  submission,
  view,
  company,
  open,
  onToggle,
}: {
  submission: Submission
  view: ApplicantView
  company: string
  open?: boolean
  onToggle: (open: boolean) => void
}) {
  const copy = portalContent.vorgang
  const { payment } = submission.process
  const reached = view.phase >= 2
  const isNomination = submission.type === 'fremdvorschlag'
  const status = isNomination ? (
    <StatusBadge label={copy.payment.nominationStatus} tone="neutral" />
  ) : payment === 'rechnung_offen' ? (
      <StatusBadge label={copy.payment.open} tone="aktion" />
    ) : payment === 'zahlung_eingegangen' ? (
      <StatusBadge label={copy.payment.paid} tone="abgeschlossen" />
    ) : (
      <StatusBadge label={copy.payment.none} tone="neutral" />
    )
  return (
    <Block
      id="zahlung"
      icon={<Receipt size={18} aria-hidden="true" />}
      title={copy.blocks.payment}
      locked={!reached}
      lockedText={isNomination ? copy.payment.nomination(company) : copy.payment.locked}
      summary={
        isNomination
          ? copy.payment.nomination(company)
          : payment === 'keine_rechnung'
            ? copy.payment.noneText
            : payment === 'zahlung_eingegangen' && submission.process.questionnaire !== 'gesperrt'
              ? copy.payment.done
              : copy.payment.relation
      }
      status={status}
      open={open}
      onToggle={onToggle}
    >
      {/* Bei einer Fremdnominierung gibt es nichts aufzuklappen (Rechnung betrifft das Unternehmen). */}
      {!isNomination && (
        <>
      {payment !== 'keine_rechnung' ? (
        <div className={styles.invoice}>
          <div className={styles.invoiceHead}>
            <span className={styles.invoiceTitle}>{copy.payment.invoiceTitle}</span>
            <span className={styles.demoTag}>Demo</span>
          </div>
          <dl className={styles.reviewList}>
            <div className={styles.reviewRow}>
              <dt>{copy.payment.invoiceNumber}</dt>
              <dd>RE-DEMO-{submission.reference?.slice(4)}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>{copy.payment.invoiceItem}</dt>
              <dd>{copy.payment.invoiceItemValue}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>{copy.payment.invoiceAmount}</dt>
              <dd>{copy.payment.invoiceAmountValue}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>{copy.payment.invoiceStatus}</dt>
              <dd>{payment === 'zahlung_eingegangen' ? copy.payment.paid : copy.payment.open}</dd>
            </div>
          </dl>
        </div>
      ) : null}
          <p className={styles.noticeInline}>{copy.payment.freeNote}</p>
        </>
      )}
    </Block>
  )
}

function QuestionnaireBlock({ submission, view, navigate, path }: { submission: Submission; view: ApplicantView; navigate: Navigate; path: string }) {
  const copy = portalContent.vorgang
  const { questionnaire, deadline, questionnaireStep, questionnaireSubmittedAt, answers } = submission.process
  const locked = view.questionnaireAccess === 'locked'
  const prizes = prizesOf(answers)
  let summary: string = copy.questionnaire.available
  let status: React.ReactNode = null
  let action: React.ReactNode = null

  if (onlyPendingPrizes(submission.process)) {
    // Nur Preise ohne Fragebogen gewählt: kein Fortschritt, keine Frist, nur die Preisauswahl lässt sich ändern.
    summary = copy.questionnaire.pendingPrizes(prizeTitles(prizes))
    status = <StatusBadge label={portalContent.questionnaire.prize.pending} tone="wartend" />
    action = (
      <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(`${path}?preise=1`)}>
        {copy.actions.changePrizes}
      </button>
    )
  } else if (view.questionnaireAccess === 'hidden') {
    summary = copy.questionnaire.hiddenSummary
    status = <StatusBadge label="Eingereicht" tone="abgeschlossen" />
  } else if (view.questionnaireAccess === 'handover') {
    summary = copy.questionnaire.handover
    status = <StatusBadge label={copy.questionnaire.handoverStatus} tone="wartend" />
  } else if (questionnaire === 'eingereicht') {
    summary = `${copy.questionnaire.submitted} ${formatDateTime(questionnaireSubmittedAt)}`
    status = <StatusBadge label="Eingereicht" tone="abgeschlossen" />
    action = (
      <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(path)}>
        {copy.actions.viewQuestionnaire}
      </button>
    )
  } else if (questionnaire === 'in_bearbeitung') {
    summary = copy.questionnaire.progress(Math.min(questionnaireStep + 1, QUESTIONNAIRE_SECTIONS), QUESTIONNAIRE_SECTIONS)
    status = <StatusBadge label="In Bearbeitung" tone="bearbeitung" />
    action = (
      <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(path)}>
        {copy.actions.continueQuestionnaire}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    )
  } else if (questionnaire === 'verfuegbar') {
    status = <StatusBadge label="Freigeschaltet" tone="freigeschaltet" />
    action = (
      <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(path)}>
        {copy.actions.editQuestionnaire}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    )
  }

  return (
    <Block
      id="fragebogen"
      icon={<FileText size={18} aria-hidden="true" />}
      title={copy.blocks.questionnaire}
      locked={locked}
      lockedText={questionnaireLockReason(submission.process, submission.type)}
      summary={
        <>
          {prizes.length > 0 && view.questionnaireAccess !== 'handover' && !onlyPendingPrizes(submission.process) && <strong>{prizeTitles(prizes)} · </strong>}
          {summary}
          {deadline && questionnaire !== 'eingereicht' && !locked && !onlyPendingPrizes(submission.process) ? ` · ${copy.questionnaire.deadline} ${formatDate(`${deadline}T12:00:00`)} (Demo)` : ''}
        </>
      }
      status={status}
      action={action}
    />
  )
}

function ResultBlock({
  submission,
  view,
  company,
  open,
  onToggle,
}: {
  submission: Submission
  view: ApplicantView
  company: string
  open?: boolean
  onToggle: (open: boolean) => void
}) {
  const copy = portalContent.vorgang
  const { result } = submission.process
  const reached = view.phase === 4
  // Den Einladungsbrief sieht nur das eingeladene Unternehmen, nicht die vorschlagende Person.
  const invited = reached && result === 'einladung' && submission.type !== 'fremdvorschlag'
  const closed = reached && result === 'keine_einladung'
  const subject = submission.type === 'fremdvorschlag' ? company : 'Ihr Unternehmen'

  return (
    <section className={cx(styles.block, !reached && styles.blockLocked)} id="vorgang-einladung" aria-labelledby="vorgang-einladung-title">
      <div className={styles.blockHead}>
        <span className={styles.blockIcon} aria-hidden="true">
          {invited ? <Mail size={18} /> : reached ? <FileCheck2 size={18} /> : <Lock size={16} />}
        </span>
        <div className={styles.blockHeadText}>
          <h2 className={styles.blockTitle} id="vorgang-einladung-title">
            {copy.blocks.result}
          </h2>
          <p className={styles.blockSummary}>
            {!reached
              ? copy.result.locked
              : result === 'einladung'
                ? copy.result.invited(subject)
                : closed
                  ? submission.type === 'fremdvorschlag'
                    ? copy.result.closedNomination
                    : copy.result.closed
                  : copy.result.pending}
          </p>
        </div>
        {reached && (
          <span className={styles.blockStatus}>
            <StatusBadge label={view.status.label} tone={view.status.tone} />
          </span>
        )}
      </div>

      {invited && (
        <div className={styles.blockBody}>
          <div className={styles.inviteCard}>
            <div className={styles.inviteCardText}>
              <span className={styles.inviteCardTitle}>{copy.result.cardTitle}</span>
              <span className={styles.inviteRow}>
                <MapPin size={15} aria-hidden="true" /> {copy.result.place}
              </span>
              <span className={styles.inviteRow}>
                <CalendarDays size={15} aria-hidden="true" /> {copy.result.date}
              </span>
            </div>
            {open && (
              <div className={cx(styles.letter, styles.onNavy)} id="vorgang-einladung-brief" role="region" aria-label={copy.result.letterTitle}>
                <Image src="/images/goldene-bavaria.png" alt="" className={styles.letterArt} width={402} height={600} />
                <p className={styles.letterTitle}>{copy.result.letterTitle}</p>
                <p className={styles.letterText}>{copy.result.letterSalutation}</p>
                <p className={styles.letterText}>{copy.result.letterBody(company)}</p>
                <p className={styles.letterNote}>{copy.result.letterNote}</p>
              </div>
            )}
            <button
              type="button"
              className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, styles.inviteToggle)}
              aria-expanded={open}
              aria-controls={open ? 'vorgang-einladung-brief' : undefined}
              onClick={() => onToggle(!open)}
            >
              {open ? copy.result.hideLetter : copy.actions.viewInvitation}
            </button>
          </div>
          <p className={styles.noticeInline}>{copy.result.winnerNote}</p>
        </div>
      )}
    </section>
  )
}

/** Unterlagen für Gala und Presse – nach Anforderung durch die Geschäftsstelle. Dateien werden im Prototyp nicht hochgeladen. */
function DocumentsBlock({ submission }: { submission: Submission }) {
  const copy = portalContent.vorgang.documents
  const documents = submission.process.documents!
  const progress = documentsProgress(submission.process)
  const [drafts, setDrafts] = useState<Partial<Record<DocKey, string>>>({})

  return (
    <section className={styles.block} id="vorgang-unterlagen" aria-labelledby="vorgang-unterlagen-title">
      <div className={styles.blockHead}>
        <span className={styles.blockIcon} aria-hidden="true">
          <FolderUp size={18} />
        </span>
        <div className={styles.blockHeadText}>
          <h2 className={styles.blockTitle} id="vorgang-unterlagen-title">
            {copy.title}
          </h2>
          <p className={styles.blockSummary}>{copy.summary(progress.approved, progress.total, progress.open)}</p>
        </div>
        <span className={styles.blockStatus}>
          <StatusBadge label={progress.open ? copy.statusOpen : copy.statusDone} tone={progress.open ? 'aktion' : 'abgeschlossen'} />
        </span>
      </div>
      <div className={styles.blockBody}>
        <p className={styles.noticeInline}>{copy.intro}</p>
        <ul className={styles.docList}>
          {DOC_KEYS.map((key) => {
            const meta = DOC_META[key]
            const item = documents.items[key]
            const editable = item.status === 'offen' || item.status === 'nachbesserung'
            const draft = drafts[key] ?? ''
            const inputId = `doc-${submission.id}-${key}`
            return (
              <li key={key} className={styles.docItem}>
                <div className={styles.docHead}>
                  <label className={styles.label} htmlFor={editable ? inputId : undefined}>
                    {meta.label}
                  </label>
                  <span className={cx(styles.docState, styles[`docState_${item.status}`])}>{DOC_STATUS_LABEL[item.status]}</span>
                </div>
                <p className={styles.hint}>{meta.hint}</p>
                {item.status === 'nachbesserung' && item.note && (
                  <p className={styles.noticeWarn}>
                    <Info size={16} aria-hidden="true" />
                    {copy.note(item.note)}
                  </p>
                )}
                {editable ? (
                  <div className={styles.docInput}>
                    {meta.kind === 'file' ? (
                      // Eigener Auswahl-Button statt des nativen Felds, dessen Text der Browser in seiner Sprache setzt.
                      <span className={styles.filePick}>
                        <input
                          id={inputId}
                          type="file"
                          accept={meta.accept}
                          className={cx(styles.srOnly, styles.fileInput)}
                          onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.files?.[0]?.name ?? '' }))}
                        />
                        <label htmlFor={inputId} className={cx(styles.btn, styles.btnSecondary, styles.btnSmall, styles.fileButton)}>
                          <Upload size={16} aria-hidden="true" />
                          {copy.chooseFile}
                        </label>
                        <span className={styles.fileName}>{draft || copy.noFile}</span>
                      </span>
                    ) : (
                      <textarea
                        id={inputId}
                        className={styles.textarea}
                        rows={key === 'portraet' ? 5 : 2}
                        maxLength={meta.maxLength}
                        value={draft}
                        onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                      />
                    )}
                    <button
                      type="button"
                      className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)}
                      disabled={!draft.trim()}
                      onClick={async () => {
                        const value = meta.kind === 'file' ? { fileName: draft } : { value: draft.trim() }
                        if (await runCommand({ type: 'documents.submit', submissionId: submission.id, key, ...value })) setDrafts((current) => ({ ...current, [key]: '' }))
                      }}
                    >
                      {copy.submit}
                      <span className={styles.srOnly}>: {meta.label}</span>
                    </button>
                  </div>
                ) : (
                  <p className={styles.docValue}>
                    {item.fileName ?? item.value}
                    {item.updatedAt && <span className={styles.tableSubText}> · {copy.submittedAt(formatDateTime(item.updatedAt))}</span>}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <p className={styles.hint}>{copy.demo}</p>
      </div>
    </section>
  )
}
