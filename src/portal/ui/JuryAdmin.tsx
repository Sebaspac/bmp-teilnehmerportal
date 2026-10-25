'use client'

import React, { useRef, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Info, Plus, RefreshCw } from 'lucide-react'

import { isValidSubmissionEmail } from '@/shared/formSubmission'
import { ChoiceField, TextField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { JURY_LABEL, JURY_TYPE_HINT, JURY_TYPE_LABEL, assignedOf, isEvaluated } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { reportCommandError, runCommand, sendCommand } from '@/portal/data/portalClient'
import { accountOf, submissionCompany, submittedSubmissions } from '@/portal/domain/selectors'
import { JURY_TYPES, type Juror, type JuryType, type PortalSnapshot, type Submission } from '@/portal/domain/types'
import { Sheet, type SheetHandle } from '@/portal/ui/Sheet'
import styles from '@/portal/ui/portal.module.css'

type Navigate = (path: string) => void

/** Fragebögen, die einer Jury vorgelegt werden können: eingereicht. */
const juryCases = (state: PortalSnapshot) => submittedSubmissions(state).filter((submission) => submission.process.questionnaire === 'eingereicht')

/** Stand eines Jurymitglieds: zugewiesene Fragebögen, davon bearbeitet und offen. */
export function jurorStats(state: PortalSnapshot, juror: Juror) {
  const assigned = juryCases(state).filter((submission) => assignedOf(submission.process)[juror.type].includes(juror.id))
  const done = assigned.filter((submission) => isEvaluated(submission.process, juror.type, juror.id)).length
  return { assigned: assigned.length, done, open: assigned.length - done }
}

/** Stand eines Mitglieds für einen Fragebogen – abgeleitet aus Jurystufe und Bewertung. */
function caseStatus(submission: Submission, juror: Juror) {
  const status = portalContent.admin.juryBoard.status
  const p = submission.process
  if (isEvaluated(p, juror.type, juror.id)) return status.done
  if (p.jury === juror.type) return status.open
  const order = ['nicht_zugewiesen', 'zugewiesen', 'jury1', 'jury2', 'abgeschlossen']
  return order.indexOf(p.jury) < order.indexOf(juror.type) ? status.waiting : status.closed
}

const TYPE_OPTIONS = JURY_TYPES.map((type) => ({ value: type, label: JURY_TYPE_LABEL[type], desc: portalContent.admin.juryBoard.typeDesc[type] }))

/* ── Dashboard (Verwaltung › Jury) ───────────────────────────────────────── */

export function JuryDashboard({ state, navigate }: { state: PortalSnapshot; navigate: Navigate }) {
  const copy = portalContent.admin.juryBoard
  const cases = juryCases(state)
  const inStage = (stage: JuryType) => cases.filter((submission) => submission.process.jury === stage).length
  const count = (type: JuryType) => state.jurors.filter((juror) => juror.type === type).length
  const openTotal = state.jurors.reduce((sum, juror) => sum + jurorStats(state, juror).open, 0)

  return (
    <section className={styles.juryBoard} aria-labelledby="jury-board-title">
      <div className={styles.juryBoardHead}>
        <div>
          <h2 className={styles.sectionTitle} id="jury-board-title">
            {copy.title}
          </h2>
          <p className={styles.juryBoardLead}>{copy.lead}</p>
        </div>
        <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} onClick={() => navigate('/portal/admin/jury/neu')}>
          <Plus size={15} aria-hidden="true" />
          {copy.create}
        </button>
      </div>

      <dl className={styles.juryKpis}>
        <div>
          <dt>{copy.kpiMembers}</dt>
          <dd>{state.jurors.length}</dd>
          <dd className={styles.juryKpiNote}>{copy.kpiMembersSplit(count('jury1'), count('jury2'))}</dd>
        </div>
        <div>
          <dt>{copy.kpiJury1}</dt>
          <dd>{inStage('jury1')}</dd>
        </div>
        <div>
          <dt>{copy.kpiJury2}</dt>
          <dd>{inStage('jury2')}</dd>
        </div>
        <div>
          <dt>{copy.kpiOpen}</dt>
          <dd>{openTotal}</dd>
        </div>
      </dl>

      {JURY_TYPES.map((type) => {
        const members = state.jurors.filter((juror) => juror.type === type)
        const c = copy.columns
        return (
          <section key={type} className={styles.juryBoardGroup} aria-labelledby={`jury-board-${type}`}>
            <h3 className={styles.miniHeading} id={`jury-board-${type}`}>
              {JURY_TYPE_LABEL[type]} <span className={styles.optional}>· {JURY_TYPE_HINT[type]}</span>
            </h3>
            {members.length === 0 ? (
              <p className={styles.tableEmpty}>{copy.emptyType}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{c.member}</th>
                      <th scope="col">{c.assigned}</th>
                      <th scope="col">{c.done}</th>
                      <th scope="col">{c.open}</th>
                      <th scope="col">{c.progress}</th>
                      <th scope="col">
                        <span className={styles.srOnly}>{c.action}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((juror) => {
                      const stats = jurorStats(state, juror)
                      const percent = stats.assigned ? Math.round((stats.done / stats.assigned) * 100) : 0
                      return (
                        <tr key={juror.id}>
                          <td className={styles.tableCompanyCell}>
                            <div>
                              <span className={styles.tableCompany}>{juror.name}</span>
                              <span className={styles.tableSub}>{juror.email}</span>
                            </div>
                          </td>
                          <td data-label={c.assigned}>{stats.assigned}</td>
                          <td data-label={c.done}>{stats.done}</td>
                          <td data-label={c.open}>
                            <span className={cx(stats.open > 0 && styles.juryOpenCount)}>{stats.open}</span>
                          </td>
                          <td data-label={c.progress}>
                            <span className={styles.juryProgress}>
                              <span className={styles.juryBar} aria-hidden="true">
                                <span style={{ transform: `scaleX(${percent / 100})` }} />
                              </span>
                              <span>{stats.assigned ? `${percent} %` : '–'}</span>
                            </span>
                          </td>
                          <td className={styles.tableAction}>
                            <button
                              type="button"
                              className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)}
                              onClick={() => navigate(`/portal/admin/jury/${juror.id}`)}
                            >
                              {copy.manage}
                              <span className={styles.srOnly}>: {juror.name}</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}

      <h3 className={styles.miniHeading} style={{ marginTop: 8 }}>
        {copy.casesTitle}
      </h3>
    </section>
  )
}

/* ── Jurymitglied anlegen ────────────────────────────────────────────────── */

export function NewJurorSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const copy = portalContent.admin.juryBoard
  const sheetRef = useRef<SheetHandle>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<JuryType | ''>('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; type?: string }>({})

  const submit = async () => {
    const found: typeof errors = {}
    if (!name.trim()) found.name = copy.errors.name
    if (!isValidSubmissionEmail(email)) found.email = copy.errors.email
    if (!type) found.type = copy.errors.type
    if (!found.name && !found.email && type) {
      const response = await sendCommand({ type: 'juror.create', name, email, jurorType: type })
      if (response.ok) return onCreated(response.result.jurorId)
      if (response.error.code !== 'conflict') return void reportCommandError(response.error)
      found.email = copy.errors.taken
    }
    setErrors(found)
    focusFirstInvalid(bodyRef.current)
  }

  return (
    <Sheet
      ref={sheetRef}
      title={copy.newTitle}
      subtitle={copy.newSubtitle}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.footClose)} onClick={() => sheetRef.current?.close()}>
            {portalContent.sheet.close}
          </button>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={submit}>
            <Plus size={16} aria-hidden="true" />
            {copy.createSubmit}
          </button>
        </>
      }
    >
      <div ref={bodyRef} className={styles.juryForm}>
        <div className={styles.grid2}>
          <TextField label={copy.name} value={name} onValueChange={(value) => setName(value)} error={errors.name} maxLength={120} autoComplete="off" />
          <TextField label={copy.email} type="email" value={email} onValueChange={(value) => setEmail(value)} error={errors.email} maxLength={200} autoComplete="off" />
        </div>
        <ChoiceField<JuryType>
          legend={copy.type}
          name="juror-type"
          layout="stack"
          value={type}
          onValueChange={(value) => setType(value)}
          options={TYPE_OPTIONS}
          error={errors.type}
        />
        <p className={styles.notice}>
          <Info size={16} aria-hidden="true" />
          {copy.newNote}
        </p>
      </div>
    </Sheet>
  )
}

/* ── Jurymitglied verwalten: Angaben, Zugang, Zuweisung ──────────────────── */

export function JurorSheet({ state, juror, justCreated, onClose }: { state: PortalSnapshot; juror: Juror; justCreated: boolean; onClose: () => void }) {
  const copy = portalContent.admin.juryBoard
  const sheetRef = useRef<SheetHandle>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const account = accountOf(state, juror.accountId)
  const stats = jurorStats(state, juror)
  const cases = juryCases(state)
  const [name, setName] = useState(juror.name)
  const [email, setEmail] = useState(juror.email)
  const [type, setType] = useState<JuryType>(juror.type)
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [saved, setSaved] = useState(false)
  const [showPassword, setShowPassword] = useState(justCreated)
  const [regenerated, setRegenerated] = useState(false)
  // Die Jury-Art bestimmt die Bewertungsform – wechseln nur ohne Zuweisungen, damit keine Bewertung „verrutscht“.
  const typeLocked = stats.assigned > 0

  const save = async () => {
    const found: typeof errors = {}
    if (!name.trim()) found.name = copy.errors.name
    if (!isValidSubmissionEmail(email)) found.email = copy.errors.email
    if (!found.name && !found.email) {
      const response = await sendCommand({ type: 'juror.update', jurorId: juror.id, name, email, jurorType: typeLocked ? juror.type : type })
      if (!response.ok && response.error.code !== 'conflict') return void reportCommandError(response.error)
      if (response.ok) {
        setErrors({})
        setSaved(true)
        return
      }
      found.email = copy.errors.taken
    }
    setSaved(false)
    setErrors(found)
    focusFirstInvalid(bodyRef.current)
  }

  return (
    <Sheet
      ref={sheetRef}
      title={juror.name}
      subtitle={`${JURY_TYPE_LABEL[juror.type]} · ${juror.email}`}
      onClose={onClose}
      footer={
        <>
          <div className={styles.sheetFootStart}>
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.footClose)} onClick={() => sheetRef.current?.close()}>
              {portalContent.sheet.close}
            </button>
            <span className={styles.savedNote} aria-live="polite">
              {saved && (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {copy.saved}
                </>
              )}
            </span>
          </div>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={save}>
            {copy.save}
          </button>
        </>
      }
    >
      <div ref={bodyRef} className={styles.juryForm}>
        {justCreated && (
          <p className={styles.notice} role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            {copy.created}
          </p>
        )}

        <dl className={cx(styles.juryKpis, styles.juryKpisCompact)}>
          <div>
            <dt>{copy.columns.assigned}</dt>
            <dd>{stats.assigned}</dd>
          </div>
          <div>
            <dt>{copy.columns.done}</dt>
            <dd>{stats.done}</dd>
          </div>
          <div>
            <dt>{copy.columns.open}</dt>
            <dd>{stats.open}</dd>
          </div>
        </dl>

        <section aria-labelledby="juror-details">
          <h3 className={styles.miniHeading} id="juror-details">
            {copy.detailsTitle}
          </h3>
          <div className={styles.grid2}>
            <TextField label={copy.name} value={name} onValueChange={(value) => (setName(value), setSaved(false))} error={errors.name} maxLength={120} />
            <TextField label={copy.email} type="email" value={email} onValueChange={(value) => (setEmail(value), setSaved(false))} error={errors.email} maxLength={200} />
          </div>
          {typeLocked ? (
            <p className={styles.juryTypeLine}>
              <strong>{copy.type}:</strong> {JURY_TYPE_LABEL[juror.type]} <span className={styles.hint}>– {copy.typeLocked}</span>
            </p>
          ) : (
            <ChoiceField<JuryType>
              legend={copy.type}
              name={`juror-type-${juror.id}`}
              layout="stack"
              value={type}
              onValueChange={(value) => (setType(value), setSaved(false))}
              options={TYPE_OPTIONS}
            />
          )}
        </section>

        <section aria-labelledby="juror-access">
          <h3 className={styles.miniHeading} id="juror-access">
            {copy.accessTitle}
          </h3>
          <dl className={styles.reviewList}>
            <div className={styles.reviewRow}>
              <dt>{copy.email}</dt>
              <dd>{account?.email ?? juror.email}</dd>
            </div>
            <div className={styles.reviewRow}>
              <dt>{copy.password}</dt>
              <dd className={styles.juryPassword}>
                <code>{showPassword ? account?.demoPassword : '••••••••'}</code>
                <button type="button" className={styles.textBtn} onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  {showPassword ? copy.hide : copy.show}
                </button>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => {
                    void runCommand({ type: 'account.resetAccess', accountId: juror.accountId })
                    setShowPassword(true)
                    setRegenerated(true)
                  }}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  {copy.regenerate}
                </button>
              </dd>
            </div>
          </dl>
          <p className={styles.hint} aria-live="polite">
            {regenerated ? `${copy.regenerated} ` : ''}
            {copy.accessHint}
          </p>
        </section>

        <section aria-labelledby="juror-assign">
          <h3 className={styles.miniHeading} id="juror-assign">
            {copy.assignTitle}
          </h3>
          <p className={styles.hint}>{copy.assignHint(JURY_TYPE_LABEL[juror.type])}</p>
          {cases.length === 0 ? (
            <p className={styles.tableEmpty}>{copy.noCases}</p>
          ) : (
            <ul className={cx(styles.juryAssignList, styles.juryAssignCases)}>
              {cases.map((submission) => {
                const isAssigned = assignedOf(submission.process)[juror.type].includes(juror.id)
                return (
                  <li key={submission.id}>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={isAssigned}
                        disabled={submission.process.jury === 'abgeschlossen'}
                        onChange={(event) => void runCommand({ type: 'jury.setMember', submissionId: submission.id, jurorId: juror.id, assigned: event.target.checked })}
                      />
                      <span>
                        <strong>{submissionCompany(submission)}</strong>
                        <span className={styles.juryCaseMeta}>
                          {submission.reference} · {JURY_LABEL[submission.process.jury]}
                        </span>
                      </span>
                    </label>
                    <span className={styles.juryAssignValue}>{isAssigned ? caseStatus(submission, juror) : copy.columns.notAssigned}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  )
}
