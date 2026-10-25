'use client'

import React, { useState } from 'react'
import { AlertCircle, ArrowRight, Building2, Check, CheckCircle2, ClipboardList, Clock, PencilLine, Plus, Users } from 'lucide-react'

import { cx } from '@/portal/ui/fields'
import { PhaseLine, PhaseTimeline, StatusBadge, deadlineText } from '@/portal/ui/PhaseTimeline'
import { PHASES, applicantView, type ApplicantView } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand } from '@/portal/data/portalClient'
import { NOMINATION_REQUIRED_COUNT, SELF_REQUIRED_COUNT } from '@/portal/domain/registration'
import { isProfileComplete, submissionCompany } from '@/portal/domain/selectors'
import type { Account, Submission, SubmissionType } from '@/portal/domain/types'
import { formatDate, formatDateTime } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void

/** Dashboard „Meine Vorgänge“: Begrüßung, eigene Anmeldungen mit Phase, Status und nächstem Schritt. */
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
  const profileComplete = isProfileComplete(account.profile)
  const submittedCount = submissions.filter((submission) => submission.status === 'eingereicht').length
  const draftCount = submissions.length - submittedCount
  const doneSteps = 1 + (profileComplete ? 1 : 0) + (submittedCount > 0 ? 1 : 0)
  const name = account.profile.firstName ? `${account.profile.firstName} ${account.profile.lastName}`.trim() : ''

  return (
    <main id="inhalt" className={styles.mainWrap}>
      <section className={cx(styles.band, styles.onNavy)} aria-labelledby="portal-greeting">
        <div className={styles.bandInner}>
          <div>
            <h1 className={styles.bandTitle} id="portal-greeting">
              {copy.greeting}
              {name ? `, ${name}` : ''}
            </h1>
            <p className={styles.bandLead}>{copy.lead}</p>
            <div className={styles.bandActions}>
              <button type="button" className={cx(styles.btn, styles.btnGold)} onClick={() => startSubmission()} disabled={!registration.open}>
                <Plus size={16} aria-hidden="true" />
                {copy.newSubmission}
              </button>
            </div>
            <p className={styles.bandNote}>
              {registration.open
                ? copy.registrationUntil(new Date(`${registration.deadline}T12:00:00`).toLocaleDateString('de-DE'))
                : copy.registrationClosed(registration.status)}
            </p>
          </div>

          <div className={cx(styles.checklist, profileComplete && submittedCount > 0 && styles.checklistComplete)}>
            <h2 className={styles.checklistHeading}>
              <span>{profileComplete && submittedCount > 0 ? copy.checklistDoneHeading : copy.checklistHeading}</span>
              <span className={styles.checklistCount}>{copy.checklistCount(doneSteps, 3)}</span>
            </h2>
            <ul>
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
          </div>
        </div>
      </section>

      <div className={styles.main}>
        <section aria-labelledby="portal-list-heading">
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle} id="portal-list-heading">
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
            <ul className={styles.list}>
              {sortByAction(submissions).map((submission) => (
                <SubmissionRow key={submission.id} submission={submission} fresh={submission.id === freshId} navigate={navigate} />
              ))}
            </ul>
          )}
        </section>

        <aside className={styles.aside} aria-label={copy.profile.heading}>
          {profileComplete ? (
            <section className={styles.panel} aria-labelledby="portal-profile-heading">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle} id="portal-profile-heading">
                  {copy.profile.heading}
                </h2>
                <button type="button" className={styles.textBtn} onClick={() => navigate('/portal/stammdaten')}>
                  {copy.profile.edit}
                </button>
              </div>
              <ProfileFacts account={account} />
            </section>
          ) : (
            <section className={styles.missing} aria-labelledby="portal-profile-missing">
              <h2 className={styles.panelTitle} id="portal-profile-missing">
                {copy.profile.missingHeading}
              </h2>
              <p>{copy.profile.missingBody}</p>
              <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} onClick={() => navigate('/portal/stammdaten')}>
                {copy.profile.missingAction}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </section>
          )}

          <section className={styles.panel} aria-labelledby="portal-process-heading">
            <h2 className={styles.panelTitle} id="portal-process-heading" style={{ marginBottom: 6 }}>
              {copy.process.heading}
            </h2>
            <p className={styles.processIntro}>{copy.process.intro}</p>
            <ol>
              {PHASES.map((phase) => (
                <li key={phase.number} className={styles.processItem}>
                  <span className={styles.processNum} aria-hidden="true">
                    {String(phase.number).padStart(2, '0')}
                  </span>
                  <span className={styles.processTitle}>{phase.title}</span>
                  <span className={styles.processDesc}>{phase.summary}</span>
                </li>
              ))}
            </ol>
            <button type="button" className={styles.textBtn} style={{ marginTop: 6 }} onClick={() => navigate('/portal/hilfe')}>
              {copy.process.helpLink}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </section>

          <p className={styles.contact}>
            {copy.contact.prompt} <a href={`mailto:${copy.contact.email}`}>{copy.contact.email}</a>
          </p>
        </aside>
      </div>
    </main>
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

function ProfileFacts({ account }: { account: Account }) {
  const copy = portalContent.overview.profile
  const { profile } = account
  const group = portalContent.groups.find((item) => item.value === profile.group)?.label
  const org = [profile.orgName, profile.orgCity].filter(Boolean).join(', ')
  return (
    <dl className={styles.facts}>
      <div>
        <dt className={styles.srOnly}>{portalContent.labels.firstName}</dt>
        <dd className={styles.factName}>{`${profile.firstName} ${profile.lastName}`}</dd>
        {profile.orgRole && <dd className={styles.processDesc}>{profile.orgRole}</dd>}
      </div>
      <div className={styles.fact}>
        <dt>{copy.group}</dt>
        <dd>{group}</dd>
      </div>
      {org && (
        <div className={styles.fact}>
          <dt>{copy.organization}</dt>
          <dd>{org}</dd>
        </div>
      )}
      <div className={styles.fact}>
        <dt>{copy.email}</dt>
        <dd>{account.email}</dd>
      </div>
    </dl>
  )
}

/** Reihenfolge: zuerst „Ihr Schritt“ (z. B. mit Frist), dann Entwürfe, dann der Rest – sonst bleibt sie erhalten. */
function sortByAction(list: Submission[]) {
  const rank = (submission: Submission) => {
    if (submission.status === 'entwurf') return 1
    return applicantView(submission.process, submission.type, submissionCompany(submission)).next.mustAct ? 0 : 2
  }
  return [...list].sort((a, b) => rank(a) - rank(b))
}

function SubmissionRow({ submission, fresh, navigate }: { submission: Submission; fresh: boolean; navigate: Navigate }) {
  const copy = portalContent.overview.row
  const typeCopy = portalContent.submission.type
  const [confirming, setConfirming] = useState(false)
  const company = submissionCompany(submission)
  const typeLabel = submission.type === 'eigenbewerbung' ? typeCopy.self.title : submission.type === 'fremdvorschlag' ? typeCopy.nomination.title : copy.typeOpen
  const isDraft = submission.status === 'entwurf'
  const titleId = `portal-row-${submission.id}`
  const view = isDraft ? null : applicantView(submission.process, submission.type, company)
  const target = view ? rowTarget(view, submission.id) : null

  return (
    <li className={cx(styles.row, fresh && styles.rowFresh)} aria-labelledby={titleId}>
      <span className={cx(styles.rowMark, isDraft ? styles.rowMarkDraft : styles.rowMarkSubmitted)} aria-hidden="true">
        {isDraft ? <PencilLine size={16} /> : <ClipboardList size={16} />}
      </span>
      <div>
        <h3 className={cx(styles.rowTitle, !company && styles.rowTitleMuted)} id={titleId}>
          {isDraft ? (
            company || copy.untitled
          ) : (
            <a
              href={`/portal/vorgang/${submission.id}`}
              className={styles.rowTitleLink}
              onClick={(event) => {
                event.preventDefault()
                navigate(`/portal/vorgang/${submission.id}`)
              }}
            >
              {company || copy.untitled}
            </a>
          )}
        </h3>
        <p className={styles.rowMeta}>
          <span className={styles.typeTag}>{typeLabel}</span>
          {isDraft ? (
            <>
              <span className={styles.draftTag}>{copy.draft}</span>
              <span>
                {copy.draftStep} {formatDateTime(submission.updatedAt)}
              </span>
            </>
          ) : (
            <>
              <span>
                {copy.submittedOn} {formatDate(submission.submittedAt)}
              </span>
              <span>
                {copy.reference} {submission.reference}
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
      </div>

      <div className={styles.rowActions}>
        {isDraft ? (
          <>
            <button type="button" className={cx(styles.textBtn, styles.textBtnDanger)} onClick={() => setConfirming(true)} aria-expanded={confirming}>
              {copy.discard}
            </button>
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => navigate(`/portal/einreichung/${submission.id}`)}>
              {copy.continue}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </>
        ) : (
          view && <StatusBadge label={view.status.label} tone={view.status.tone} />
        )}
      </div>

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

      {view && target && (
        <div className={styles.rowProcess}>
          <div className={styles.rowTimeline}>
            <PhaseTimeline view={view} compact hideCurrentNote />
          </div>
          <div className={styles.rowPhaseLine}>
            <PhaseLine view={view} />
          </div>
          <div className={cx(styles.rowNext, view.next.mustAct ? styles.rowNextAct : styles.rowNextWait)}>
            {view.next.mustAct ? <AlertCircle size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
            <span>
              <span className={styles.rowNextLabel}>{view.next.mustAct ? copy.act : copy.wait}: </span>
              {view.next.label}
              {view.next.deadline && <span className={styles.nextDeadline}> · {deadlineText(view.next.deadline)}</span>}
            </span>
            <button
              type="button"
              className={cx(styles.btn, view.next.mustAct ? styles.btnPrimary : styles.btnSecondary, styles.btnSmall, styles.rowNextBtn)}
              onClick={() => navigate(target.path)}
            >
              {target.label}
              <span className={styles.srOnly}>: {company}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
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
    case 'editQuestionnaire':
      return { label: view.next.label, path: `${base}/fragebogen` }
    case 'viewQuestionnaire':
      return { label: labels.viewQuestionnaire, path: `${base}/fragebogen` }
    case 'viewInvitation':
      return { label: labels.viewInvitation, path: `${base}?abschnitt=einladung` }
    case 'changePrizes':
      return { label: labels.changePrizes, path: `${base}/fragebogen?preise=1` }
    case 'uploadDocuments':
      return { label: labels.uploadDocuments, path: `${base}?abschnitt=unterlagen` }
    default:
      return { label: portalContent.overview.row.openVorgang, path: base }
  }
}
