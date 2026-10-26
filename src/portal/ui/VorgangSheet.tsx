'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, ClipboardList, FileCheck2, FileText, FolderUp, Info, Lock, Mail, MapPin, Receipt, Upload } from 'lucide-react'

import Image from '@/shared/UnoptimizedImage'
import { cx } from '@/portal/ui/fields'
import { NextStep, PhaseTimeline, StatusBadge } from '@/portal/ui/PhaseTimeline'
import { applicationOpen, applicationProgress } from '@/portal/domain/application'
import {
  DOC_META,
  DOC_STATUS_LABEL,
  applicantView,
  applicationLockReason,
  documentsProgress,
  type ApplicantView,
} from '@/portal/domain/process'
import { definitionOf, prizeById, prizeTitles } from '@/portal/domain/questionnaire'
import { hasFeature } from '@/portal/domain/release'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand, useProcessContext, usePortalSnapshot } from '@/portal/data/portalClient'
import { submissionCompany } from '@/portal/domain/selectors'
import { DOC_KEYS, type Account, type DocKey, type PrizeId, type Submission } from '@/portal/domain/types'
import { DocUploadList } from '@/portal/ui/ApplicationView'
import { Page, type PageHandle } from '@/portal/ui/Page'
import { ReviewList, formatDate, formatDateTime, reviewGroups } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void

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
  demoHandover = false,
}: {
  account: Account
  submission: Submission
  onClose: () => void
  navigate: Navigate
  initialSection?: string | null
  /** Nur Prototyp: Fremdnominierung aus Sicht des vorgeschlagenen Unternehmens (`?demo=uebergabe`). */
  demoHandover?: boolean
}) {
  const copy = portalContent.vorgang
  const sheetRef = useRef<PageHandle>(null)
  const ctx = useProcessContext()
  const company = submissionCompany(submission)
  const view = applicantView(submission.process, submission.type, company, ctx)
  const typeLabel = submission.type === 'fremdvorschlag' ? portalContent.submission.type.nomination.title : portalContent.submission.type.self.title
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const reveal = (key: string) => {
    setOpen((current) => ({ ...current, [key]: true }))
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    window.requestAnimationFrame(() => document.getElementById(`vorgang-${key}`)?.scrollIntoView({ behavior, block: 'start' }))
  }

  // Direkter Einstieg aus der Vorgangsliste, z. B. „Rechnung ansehen“.
  useEffect(() => {
    if (initialSection && ['anmeldung', 'zahlung', 'bewerbung', 'einladung', 'unterlagen'].includes(initialSection)) {
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
      case 'editApplication':
        return <ActionButton secondary={!view.next.mustAct} onClick={() => reveal('bewerbung')} label={copy.actions.editApplication} />
      case 'viewApplication':
        return <ActionButton secondary onClick={() => reveal('bewerbung')} label={copy.actions.viewApplication} />
      case 'viewInvitation':
        return <ActionButton secondary={!view.next.mustAct} onClick={() => reveal('einladung')} label={copy.actions.viewInvitation} />
      case 'uploadDocuments':
        return <ActionButton onClick={() => reveal('unterlagen')} label={copy.actions.uploadDocuments} />
      case 'demoHandover':
        return demoHandover ? null : <ActionButton secondary onClick={() => navigate(`/portal/vorgang/${submission.id}?demo=uebergabe`)} label={copy.actions.demoHandover} />
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
        {view.steps.length > 1 && <PhaseTimeline view={view} />}

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

        {hasFeature(ctx.stage, 'bewerbung') && (
          <>
            <PaymentBlock submission={submission} view={view} company={company} open={open.zahlung} onToggle={(value) => setOpen((current) => ({ ...current, zahlung: value }))} />
            <ApplicationBlock submission={submission} view={view} navigate={navigate} demoHandover={demoHandover} />
          </>
        )}

        {hasFeature(ctx.stage, 'jury') && (
          <ResultBlock
            submission={submission}
            view={view}
            company={company}
            open={open.einladung}
            onToggle={(value) => setOpen((current) => ({ ...current, einladung: value }))}
          />
        )}

        {hasFeature(ctx.stage, 'gewinnerunterlagen') && submission.type === 'eigenbewerbung' && submission.process.result === 'einladung' && submission.process.documents && (
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
            : payment === 'zahlung_eingegangen' && submission.process.application !== 'gesperrt'
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

/**
 * Bewerbung (Phase 02) auf der Vorgangsseite: Preise, je Preis ein Fragebogen und die sechs Unterlagen – alles an
 * einer Stelle, damit sichtbar ist, was noch fehlt.
 */
function ApplicationBlock({ submission, view, navigate, demoHandover }: { submission: Submission; view: ApplicantView; navigate: Navigate; demoHandover: boolean }) {
  const copy = portalContent.vorgang.application
  const snapshot = usePortalSnapshot()
  const ctx = useProcessContext()
  const p = submission.process
  const access = view.applicationAccess
  const progress = applicationProgress(p, ctx.released)
  const base = `/portal/vorgang/${submission.id}`
  const demo = demoHandover && access === 'handover' ? '?demo=uebergabe' : ''
  const editable = access === 'open' || (access === 'handover' && demoHandover && p.application !== 'gesperrt')
  const showContents = editable || access === 'readonly'

  const summary =
    access === 'locked'
      ? applicationLockReason(p, submission.type)
      : access === 'hidden'
        ? copy.hiddenSummary
        : access === 'handover' && !demoHandover
          ? copy.handover
          : [
              copy.parts(progress.submitted, progress.chosen, progress.docs.uploaded, progress.docs.total),
              p.application === 'eingereicht' && p.applicationCompletedAt
                ? copy.completed(formatDateTime(p.applicationCompletedAt))
                : p.deadline
                  ? copy.deadline(formatDate(`${p.deadline}T12:00:00`))
                  : '',
            ]
              .filter(Boolean)
              .join(' · ')

  const status =
    access === 'hidden' || p.application === 'eingereicht' ? (
      <StatusBadge label="Eingereicht" tone="abgeschlossen" />
    ) : access === 'handover' && !demoHandover ? (
      <StatusBadge label={copy.handoverStatus} tone="wartend" />
    ) : p.application === 'in_bearbeitung' ? (
      <StatusBadge label="In Bearbeitung" tone="bearbeitung" />
    ) : p.application === 'verfuegbar' ? (
      <StatusBadge label="Freigeschaltet" tone="freigeschaltet" />
    ) : null

  return (
    <section className={cx(styles.block, access === 'locked' && styles.blockLocked)} id="vorgang-bewerbung" aria-labelledby="vorgang-bewerbung-title">
      <div className={styles.blockHead}>
        <span className={styles.blockIcon} aria-hidden="true">
          {access === 'locked' ? <Lock size={16} /> : <FileText size={18} />}
        </span>
        <div className={styles.blockHeadText}>
          <h2 className={styles.blockTitle} id="vorgang-bewerbung-title">
            {portalContent.vorgang.blocks.application}
          </h2>
          <p className={styles.blockSummary}>{summary}</p>
        </div>
        {status && access !== 'locked' && <span className={styles.blockStatus}>{status}</span>}
      </div>

      {access === 'handover' && !demoHandover && p.application !== 'gesperrt' && (
        <div className={styles.blockAction}>
          <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(`${base}?demo=uebergabe`)}>
            {portalContent.vorgang.actions.demoHandover}
          </button>
        </div>
      )}

      {showContents && (
        <div className={styles.applicationBody}>
          {demo && (
            <p className={styles.noticeWarn}>
              <Info size={16} aria-hidden="true" />
              {copy.handoverDemo}
            </p>
          )}

          <div className={styles.appPart}>
            <div className={styles.appPartHead}>
              <h3 className={styles.appPartTitle}>{copy.prizesHeading}</h3>
              {editable && applicationOpen(p) && (
                <button type="button" className={cx(styles.btn, progress.chosen ? styles.btnSecondary : styles.btnPrimary, styles.btnSmall)} onClick={() => navigate(`${base}/preise${demo}`)}>
                  {progress.chosen ? copy.changePrizes : copy.choosePrizes}
                </button>
              )}
            </div>
            <p className={styles.appPartText}>{progress.chosen ? prizeTitles(p.prizes) : copy.prizesNone}</p>
          </div>

          {progress.chosen > 0 && (
            <div className={styles.appPart}>
              <h3 className={styles.appPartTitle}>{copy.questionnairesHeading}</h3>
              <ul className={styles.appRows}>
                {p.prizes.map((prize) => (
                  <QuestionnaireRow key={prize} prize={prize} submission={submission} sections={definitionOf(snapshot, prize)?.sections.length ?? 0} released={ctx.released.includes(prize)} editable={editable} path={`${base}/fragebogen/${prize}${demo}`} navigate={navigate} />
                ))}
              </ul>
            </div>
          )}

          <div className={styles.appPart}>
            <div className={styles.appPartHead}>
              <h3 className={styles.appPartTitle}>{copy.docsHeading}</h3>
              <span className={styles.appPartCount}>{copy.docsCount(progress.docs.uploaded, progress.docs.total)}</span>
            </div>
            <DocUploadList submission={submission} />
          </div>
        </div>
      )}
    </section>
  )
}

function QuestionnaireRow({
  prize,
  submission,
  sections,
  released,
  editable,
  path,
  navigate,
}: {
  prize: PrizeId
  submission: Submission
  sections: number
  released: boolean
  editable: boolean
  path: string
  navigate: Navigate
}) {
  const copy = portalContent.vorgang.application
  const entry = submission.process.questionnaires[prize]
  const title = prizeById(prize).title
  const submitted = entry?.status === 'eingereicht'
  const state = submitted
    ? copy.qStatus.submitted(formatDateTime(entry.submittedAt))
    : !released
      ? copy.qStatus.waiting
      : entry
        ? copy.qStatus.progress(Math.min(entry.step + 1, sections + 1), sections + 1)
        : copy.qStatus.notStarted
  const action = submitted ? copy.qActions.view : !released || !editable ? null : entry ? copy.qActions.continue : copy.qActions.start
  return (
    <li className={styles.appRow}>
      <span className={styles.appRowText}>
        <span className={styles.appRowTitle}>{title}</span>
        <span className={styles.appRowState}>{state}</span>
      </span>
      {action && (
        <button type="button" className={cx(styles.btn, submitted ? styles.btnSecondary : styles.btnPrimary, styles.btnSmall)} onClick={() => navigate(path)}>
          {action}
          <span className={styles.srOnly}>: Fragebogen {title}</span>
          {!submitted && <ArrowRight size={14} aria-hidden="true" />}
        </button>
      )}
    </li>
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
