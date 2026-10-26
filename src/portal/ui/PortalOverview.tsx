'use client'

import React, { useState } from 'react'
import { AlertCircle, ArrowRight, Building2, Check, CheckCircle2, Clock, Plus, Users } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { PageHeader } from '@/portal/ui/AppShell'
import { PhaseLine, StatusBadge, deadlineText } from '@/portal/ui/PhaseTimeline'
import { applicantView, type ApplicantView, type ProcessContext } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand, useProcessContext } from '@/portal/data/portalClient'
import { NOMINATION_REQUIRED_COUNT, SELF_REQUIRED_COUNT } from '@/portal/domain/registration'
import { isProfileComplete, submissionCompany } from '@/portal/domain/selectors'
import type { Account, Submission, SubmissionType } from '@/portal/domain/types'
import { formatDate, formatDateTime } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void

/** „Meine Vorgänge“: Seitenkopf mit der Hauptaktion, offene erste Schritte und die Liste der eigenen Anmeldungen. */
export function PortalOverview({
  account,
  submissions,
  freshId,
  navigate,
  startSubmission,
  registration,
}: {
  account: Account
  submissions: Submission[]
  freshId: string | null
  navigate: Navigate
  startSubmission: (type?: SubmissionType) => void
  /** Rundenverwaltung: Ist die Anmeldung offen, bis wann, und welcher Rundenstatus gilt? */
  registration: { open: boolean; deadline: string; status: string }
}) {
  const copy = portalContent.overview
  const ctx = useProcessContext()
  const profileComplete = isProfileComplete(account.profile)
  const submittedCount = submissions.filter((submission) => submission.status === 'eingereicht').length
  const draftCount = submissions.length - submittedCount
  const doneSteps = 1 + (profileComplete ? 1 : 0) + (submittedCount > 0 ? 1 : 0)
  const name = account.profile.firstName ? `${account.profile.firstName} ${account.profile.lastName}`.trim() : ''

  return (
    <div className={styles.view}>
      <PageHeader
        title={`${copy.greeting}${name ? `, ${name}` : ''}`}
        lead={
          registration.open
            ? copy.registrationUntil(new Date(`${registration.deadline}T12:00:00`).toLocaleDateString('de-DE'))
            : copy.registrationClosed(registration.status)
        }
        actions={
          <button type="button" className={cx(styles.btn, styles.btnGold)} onClick={() => startSubmission()} disabled={!registration.open}>
            <Plus size={16} aria-hidden="true" />
            {copy.newSubmission}
          </button>
        }
      />

      {/* Erste Schritte nur, solange etwas offen ist. */}
      {doneSteps < 3 && (
        <section className={styles.onboarding} aria-labelledby="portal-onboarding">
          <h2 className={styles.onboardingTitle} id="portal-onboarding">
            {copy.checklistHeading} <span className={styles.onboardingCount}>{copy.checklistCount(doneSteps, 3)}</span>
          </h2>
          <ul className={styles.onboardingList}>
            <ChecklistItem done label={copy.checklist.account} />
            {profileComplete ? (
              <ChecklistItem done label={copy.checklist.profile} />
            ) : (
              <li className={styles.checkItem}>
                <span className={styles.checkMark} aria-hidden="true" />
                <button type="button" className={cx(styles.textBtn, styles.checkLink)} onClick={() => navigate('/portal/stammdaten')}>
                  {copy.checklist.profileTodo}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            )}
            <ChecklistItem done={submittedCount > 0} label={copy.checklist.submission} />
          </ul>
        </section>
      )}

      <section aria-labelledby="portal-list-heading">
        <div className={styles.sectionBar}>
          <h2 className={styles.sectionHeading} id="portal-list-heading">
            {copy.listHeading}
          </h2>
          {submissions.length > 0 && <span className={styles.count}>{copy.listSummary(submittedCount, draftCount)}</span>}
        </div>

        {submissions.length === 0 ? (
          <div className={styles.empty}>
            <h3 className={styles.emptyTitle}>{copy.empty.heading}</h3>
            <p className={styles.emptyBody}>{copy.empty.body}</p>
            <div className={styles.emptyPaths}>
              <EmptyPath
                icon={<Building2 size={20} aria-hidden="true" />}
                title={portalContent.submission.type.self.title}
                subtitle={portalContent.submission.type.self.subtitle}
                required={SELF_REQUIRED_COUNT}
                disabled={!registration.open}
                onClick={() => startSubmission('eigenbewerbung')}
              />
              <EmptyPath
                icon={<Users size={20} aria-hidden="true" />}
                title={portalContent.submission.type.nomination.title}
                subtitle={portalContent.submission.type.nomination.subtitle}
                required={NOMINATION_REQUIRED_COUNT}
                disabled={!registration.open}
                onClick={() => startSubmission('fremdvorschlag')}
              />
            </div>
          </div>
        ) : (
          <ul className={styles.caseList}>
            {sortByAction(submissions, ctx).map((submission) => (
              <SubmissionRow key={submission.id} submission={submission} fresh={submission.id === freshId} navigate={navigate} />
            ))}
          </ul>
        )}
      </section>

      <p className={styles.contact}>
        {copy.contact.prompt} <a href={`mailto:${copy.contact.email}`}>{copy.contact.email}</a>
      </p>
    </div>
  )
}

function EmptyPath({
  icon,
  title,
  subtitle,
  required,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  required: number
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={styles.emptyPath} onClick={onClick} disabled={disabled}>
      <span className={styles.pathIcon}>{icon}</span>
      <span className={styles.emptyPathText}>
        <span className={styles.emptyPathTitle}>{title}</span>
        <span className={styles.pathSubtitle}>{subtitle}</span>
        <span className={styles.emptyPathCount}>{portalContent.submission.type.requiredCount(required)}</span>
      </span>
      <ArrowRight size={18} aria-hidden="true" className={styles.emptyPathArrow} />
    </button>
  )
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={cx(styles.checkItem, done && styles.checkItemDone)}>
      <span className={styles.checkMark} aria-hidden="true">
        {done && <Check size={14} strokeWidth={3} />}
      </span>
      <span>
        {label}
        <span className={styles.srOnly}>{done ? ' – erledigt' : ' – offen'}</span>
      </span>
    </li>
  )
}

/** Reihenfolge: zuerst „Ihr Schritt“ (z. B. mit Frist), dann Entwürfe, dann der Rest – sonst bleibt sie erhalten. */
function sortByAction(list: Submission[], ctx: ProcessContext) {
  const rank = (submission: Submission) => {
    if (submission.status === 'entwurf') return 1
    return applicantView(submission.process, submission.type, submissionCompany(submission), ctx).next.mustAct ? 0 : 2
  }
  return [...list].sort((a, b) => rank(a) - rank(b))
}

/** Eine Zeile je Vorgang: Unternehmen und Status, kompakte Phase, nächster Schritt mit der passenden Schaltfläche. */
function SubmissionRow({ submission, fresh, navigate }: { submission: Submission; fresh: boolean; navigate: Navigate }) {
  const copy = portalContent.overview.row
  const typeCopy = portalContent.submission.type
  const [confirming, setConfirming] = useState(false)
  const company = submissionCompany(submission)
  const typeLabel = submission.type === 'eigenbewerbung' ? typeCopy.self.title : submission.type === 'fremdvorschlag' ? typeCopy.nomination.title : copy.typeOpen
  const isDraft = submission.status === 'entwurf'
  const titleId = `portal-row-${submission.id}`
  const ctx = useProcessContext()
  const view = isDraft ? null : applicantView(submission.process, submission.type, company, ctx)
  const target = view ? rowTarget(view, submission.id) : null

  return (
    <li className={cx(styles.caseRow, fresh && styles.caseRowFresh)} aria-labelledby={titleId}>
      <div className={styles.caseMain}>
        <h3 className={cx(styles.caseTitle, !company && styles.rowTitleMuted)} id={titleId}>
          {isDraft ? (
            company || copy.untitled
          ) : (
            <a
              href={`/portal/vorgang/${submission.id}`}
              className={styles.caseLink}
              onClick={(event) => {
                event.preventDefault()
                navigate(`/portal/vorgang/${submission.id}`)
              }}
            >
              {company || copy.untitled}
            </a>
          )}
        </h3>
        <p className={styles.caseMeta}>
          <span>{typeLabel}</span>
          {isDraft ? (
            <span>
              {copy.draftStep} {formatDateTime(submission.updatedAt)}
            </span>
          ) : (
            <>
              <span>
                {copy.reference} {submission.reference}
              </span>
              <span>
                {copy.submittedOn} {formatDate(submission.submittedAt)}
              </span>
            </>
          )}
          {fresh && (
            <span className={styles.freshTag}>
              <CheckCircle2 size={14} aria-hidden="true" />
              {copy.fresh}
            </span>
          )}
        </p>
        {view && <PhaseLine view={view} />}
      </div>

      <div className={styles.caseSide}>
        {isDraft ? <span className={styles.draftTag}>{copy.draft}</span> : view && <StatusBadge label={view.status.label} tone={view.status.tone} />}
      </div>

      {isDraft ? (
        <div className={styles.caseNext}>
          <span className={styles.caseNextText}>{copy.draftHint}</span>
          <div className={styles.caseActions}>
            <button type="button" className={cx(styles.textBtn, styles.textBtnDanger)} onClick={() => setConfirming(true)} aria-expanded={confirming}>
              {copy.discard}
            </button>
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(`/portal/einreichung/${submission.id}`)}>
              {copy.continue}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        view &&
        target && (
          <div className={cx(styles.caseNext, view.next.mustAct && styles.caseNextAct)}>
            <span className={styles.caseNextText}>
              {view.next.mustAct ? <AlertCircle size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
              <span>
                <span className={styles.rowNextLabel}>{view.next.mustAct ? copy.act : copy.wait}: </span>
                {view.next.label}
                {view.next.deadline && <span className={styles.nextDeadline}> · {deadlineText(view.next.deadline)}</span>}
              </span>
            </span>
            <button
              type="button"
              className={cx(styles.btn, view.next.mustAct ? styles.btnPrimary : styles.btnSecondary, styles.btnSmall)}
              onClick={() => navigate(target.path)}
            >
              {target.label}
              <span className={styles.srOnly}>: {company}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        )
      )}

      {isDraft && confirming && (
        <div className={styles.discardConfirm} role="alertdialog" aria-label={copy.discardConfirm}>
          <span>{copy.discardConfirm}</span>
          <button type="button" className={cx(styles.btn, styles.btnSmall, styles.btnDanger)} onClick={() => void runCommand({ type: 'draft.discard', submissionId: submission.id })}>
            {copy.discardYes}
          </button>
          <button type="button" className={styles.textBtn} onClick={() => setConfirming(false)}>
            {copy.discardNo}
          </button>
        </div>
      )}
    </li>
  )
}

/** Die Schaltfläche einer Zeile nennt die konkrete nächste Handlung und führt direkt dorthin. */
function rowTarget(view: ApplicantView, id: string) {
  const labels = portalContent.vorgang.actions
  const base = `/portal/vorgang/${id}`
  switch (view.next.action) {
    case 'viewRegistration':
      return { label: labels.viewRegistration, path: `${base}?abschnitt=anmeldung` }
    case 'checkCompanyData':
      return { label: labels.checkCompanyData, path: `${base}?abschnitt=anmeldung` }
    case 'viewPayment':
      return { label: labels.viewPayment, path: `${base}?abschnitt=zahlung` }
    case 'editApplication':
      return { label: view.next.label, path: `${base}?abschnitt=bewerbung` }
    case 'viewApplication':
      return { label: labels.viewApplication, path: `${base}?abschnitt=bewerbung` }
    case 'viewInvitation':
      return { label: labels.viewInvitation, path: `${base}?abschnitt=einladung` }
    case 'uploadDocuments':
      return { label: labels.uploadDocuments, path: `${base}?abschnitt=unterlagen` }
    default:
      return { label: portalContent.overview.row.openVorgang, path: base }
  }
}
