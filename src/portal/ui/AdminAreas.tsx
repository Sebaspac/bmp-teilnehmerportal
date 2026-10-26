'use client'

import React, { useState } from 'react'
import { Check, Download, Eye, EyeOff, Minus, Plus, RefreshCw } from 'lucide-react'

import { isValidSubmissionEmail } from '@/shared/formSubmission'
import { buildExport, EXPORTS, type ExportKind } from '@/portal/domain/exports'
import { downloadCsv } from '@/portal/ui/download'
import { SelectField, TextField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { DOC_META, DOC_STATUS_LABEL, JURY_TYPE_LABEL, ROUND_LABEL, documentsProgress } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { reportCommandError, runCommand, sendCommand, useProcessContext, useStage } from '@/portal/data/portalClient'
import { PERMISSIONS, PERMISSION_FEATURE, ROLES, ROLE_FEATURE, can, type Role } from '@/portal/domain/permissions'
import { ROUND_FEATURE, hasFeature } from '@/portal/domain/release'
import { jurorById, registrationOpen, staffAccounts, submittedSubmissions } from '@/portal/domain/selectors'
import { DOC_KEYS, type Account, type PortalSnapshot, type ProcessState, type RoundStatus, type StaffRole } from '@/portal/domain/types'
import styles from '@/portal/ui/portal.module.css'

/* ── Rundenverwaltung ────────────────────────────────────────────────────── */

const ROUND_ORDER: RoundStatus[] = ['vorbereitung', 'anmeldung_offen', 'anmeldung_geschlossen', 'fragebogenphase', 'juryphase', 'abgeschlossen']

export function RoundAdmin({ state }: { state: PortalSnapshot }) {
  const copy = portalContent.admin.roundAdmin
  const stage = useStage()
  // Nur die Status der Ausbaustufe (der aktuelle bleibt sichtbar, auch wenn er zu einer späteren Stufe gehört).
  const order = ROUND_ORDER.filter((status) => hasFeature(stage, ROUND_FEATURE[status]) || status === state.round)
  const index = order.indexOf(state.round)
  const next = order[index + 1]
  const open = registrationOpen(state)
  const submitted = submittedSubmissions(state).length
  const drafts = state.submissions.filter((submission) => submission.status === 'entwurf').length

  const move = (target: RoundStatus) => {
    const question = copy.confirm[target as keyof typeof copy.confirm]
    if (question && !window.confirm(question)) return
    void runCommand({ type: 'round.setStatus', status: target })
  }

  return (
    <div className={styles.roundAdmin}>
      <section className={styles.panel} aria-labelledby="round-status">
        <h3 className={styles.panelTitle} id="round-status">
          {copy.statusTitle}
        </h3>
        <ol className={styles.roundSteps}>
          {order.map((status, position) => (
            <li
              key={status}
              className={cx(styles.roundStep, position < index && styles.roundStepDone, position === index && styles.roundStepCurrent)}
              aria-current={position === index ? 'step' : undefined}
            >
              <span className={styles.roundStepMark} aria-hidden="true">
                {position < index ? <Check size={13} strokeWidth={3} /> : position + 1}
              </span>
              <span>{ROUND_LABEL[status]}</span>
            </li>
          ))}
        </ol>
        <div className={styles.controlActions}>
          {next && (
            <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall)} onClick={() => move(next)}>
              {copy.actions[state.round as keyof typeof copy.actions]}
            </button>
          )}
          {state.round === 'anmeldung_geschlossen' && (
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => move('anmeldung_offen')}>
              {copy.reopen}
            </button>
          )}
          <label className={styles.roundDirect}>
            <span>{copy.direct}</span>
            <select className={styles.select} value={state.round} onChange={(event) => void runCommand({ type: 'round.setStatus', status: event.target.value as RoundStatus })}>
              {order.map((status) => (
                <option key={status} value={status}>
                  {ROUND_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="round-effects">
        <h3 className={styles.panelTitle} id="round-effects">
          {copy.effectsTitle}
        </h3>
        <dl className={styles.reviewList}>
          <div className={styles.reviewRow}>
            <dt>{copy.registration}</dt>
            <dd>
              <span className={cx(styles.roundFlag, open ? styles.roundFlagOpen : styles.roundFlagClosed)}>{open ? copy.registrationOpen : copy.registrationClosed}</span>
              <span className={styles.hint}> {open ? copy.registrationOpenHint : copy.registrationClosedHint}</span>
            </dd>
          </div>
          <div className={styles.reviewRow}>
            <dt>{copy.inRound}</dt>
            <dd>{copy.counts(submitted, drafts)}</dd>
          </div>
        </dl>
        <div className={styles.grid2} style={{ marginTop: 16 }}>
          <TextField
            label={copy.registrationDeadline}
            hint={copy.registrationDeadlineHint}
            type="date"
            value={state.roundSettings.registrationDeadline}
            onValueChange={(value) => void runCommand({ type: 'round.setSettings', patch: { registrationDeadline: value } })}
          />
          {hasFeature(stage, 'bewerbung') && (
            <TextField
              label={copy.questionnaireDeadline}
              hint={copy.questionnaireDeadlineHint}
              type="date"
              value={state.roundSettings.questionnaireDeadline}
              onValueChange={(value) => void runCommand({ type: 'round.setSettings', patch: { questionnaireDeadline: value } })}
            />
          )}
        </div>
      </section>
    </div>
  )
}

/* ── Gewinnerunterlagen: Stand je Vorgang (Liste) ────────────────────────── */

export function documentsSummary(process: ProcessState) {
  const copy = portalContent.admin.docs
  const docs = documentsProgress(process)
  if (!docs.requested) return copy.notRequested
  return copy.summary(docs.approved, docs.total, docs.submitted, docs.open)
}

export function DocumentsCell({ process }: { process: ProcessState }) {
  if (!process.documents) return <span>–</span>
  return (
    <ul className={styles.docMini}>
      {DOC_KEYS.map((key) => (
        <li key={key}>
          <span>{DOC_META[key].label}</span>
          <span className={cx(styles.docState, styles[`docState_${process.documents!.items[key].status}`])}>{DOC_STATUS_LABEL[process.documents!.items[key].status]}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── Exporte & Rechte ────────────────────────────────────────────────────── */

/** Exporte als Liste: je Zeile eine Datei mit Inhalt, Anzahl und Download. */
export function ExportsSection({ state }: { state: PortalSnapshot }) {
  const copy = portalContent.admin.exportsRights
  const ctx = useProcessContext()
  const [last, setLast] = useState<{ filename: string; count: number } | null>(null)

  const run = (kind: ExportKind) => {
    const result = buildExport(state, kind, ctx)
    downloadCsv(result.filename, result.csv)
    setLast({ filename: result.filename, count: result.count })
  }

  return (
    <section aria-label={copy.exportsTitle}>
      <ul className={styles.exportList}>
        {EXPORTS.filter((item) => hasFeature(ctx.stage, item.feature)).map((item) => {
          const count = submittedSubmissions(state).filter(item.filter).length
          return (
            <li key={item.kind} className={styles.exportRow}>
              <span className={styles.exportText}>
                <span className={styles.exportTitle}>{item.title}</span>
                <span className={styles.hint}>{item.desc}</span>
              </span>
              <span className={styles.exportCount}>{copy.rows(count)}</span>
              <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.btnSmall)} onClick={() => run(item.kind)}>
                <Download size={15} aria-hidden="true" />
                {copy.download}
                <span className={styles.srOnly}>: {item.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className={styles.hint} aria-live="polite" style={{ marginTop: 12 }}>
        {last ? copy.done(last.filename, last.count) : copy.note}
      </p>
    </section>
  )
}


export function RightsSection({ state, sessionAccountId }: { state: PortalSnapshot; sessionAccountId: string | null }) {
  const copy = portalContent.admin.exportsRights
  const stage = useStage()
  // Rechte, Rollen und Zugänge der Ausbaustufe – Jury erst ab A + B + C.
  const permissions = PERMISSIONS.filter((permission) => hasFeature(stage, PERMISSION_FEATURE[permission]))
  const roles = ROLES.filter((role) => hasFeature(stage, ROLE_FEATURE[role]))
  const users = staffAccounts(state).filter((account) => account.role !== 'jury' || hasFeature(stage, 'jury'))
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole | ''>('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string }>({})
  const [created, setCreated] = useState<string | null>(null)
  const formRef = React.useRef<HTMLDivElement>(null)

  const roleOf = (account: Account): Role => {
    if (account.role === 'jury') return jurorById(state, account.jurorId)?.type === 'jury2' ? 'jury2' : 'jury1'
    return account.role === 'sachbearbeitung' ? 'sachbearbeitung' : 'verwaltung'
  }

  const create = async () => {
    const found: typeof errors = {}
    if (!name.trim()) found.name = copy.errors.name
    if (!isValidSubmissionEmail(email)) found.email = copy.errors.email
    if (!role) found.role = copy.errors.role
    if (!found.name && !found.email && role) {
      const response = await sendCommand({ type: 'staff.create', name, email, role })
      if (!response.ok && response.error.code !== 'conflict') return void reportCommandError(response.error)
      if (response.ok) {
        const accountId = response.result.accountId
        setCreated(accountId)
        setShown((current) => ({ ...current, [accountId]: true }))
        setName('')
        setEmail('')
        setRole('')
        setErrors({})
        return
      }
      found.email = copy.errors.taken
    }
    setErrors(found)
    focusFirstInvalid(formRef.current)
  }

  return (
    <section aria-label={copy.rightsTitle} className={styles.rightsSection}>
      <h2 className={styles.sectionHeading} id="rechte-matrix">
        {copy.matrixTitle}
      </h2>
      {/* Auf schmalen Bildschirmen scrollt die Matrix seitlich – per Tastatur erreichbar. */}
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-labelledby="rechte-matrix">
        <table className={cx(styles.table, styles.matrix)}>
          <thead>
            <tr>
              <th scope="col">{copy.permission}</th>
              {roles.map((item) => (
                <th key={item} scope="col">
                  {copy.roles[item]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission}>
                <th scope="row">{copy.permissions[permission]}</th>
                {roles.map((item) => (
                  <td key={item} data-label={copy.roles[item]}>
                    {can(item, permission) ? (
                      <span className={styles.matrixYes}>
                        <Check size={15} strokeWidth={3} aria-hidden="true" />
                        <span className={styles.srOnly}>{copy.yes}</span>
                      </span>
                    ) : (
                      <span className={styles.matrixNo}>
                        <Minus size={15} aria-hidden="true" />
                        <span className={styles.srOnly}>{copy.no}</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={styles.sectionHeading}>{copy.usersTitle}</h2>
      <div className={styles.panel} ref={formRef}>
        <p className={styles.panelTitle}>{copy.createTitle}</p>
        <div className={styles.userForm}>
          <TextField label={copy.name} value={name} onValueChange={setName} error={errors.name} maxLength={120} autoComplete="off" />
          <TextField label={copy.email} type="email" value={email} onValueChange={setEmail} error={errors.email} maxLength={200} autoComplete="off" />
          <SelectField
            label={copy.role}
            value={role}
            onValueChange={(value) => setRole(value as StaffRole)}
            options={[
              { value: 'verwaltung', label: copy.roles.verwaltung },
              { value: 'sachbearbeitung', label: copy.roles.sachbearbeitung },
            ]}
            error={errors.role}
          />
          <button type="button" className={cx(styles.btn, styles.btnPrimary, styles.btnSmall, styles.userFormBtn)} onClick={create}>
            <Plus size={15} aria-hidden="true" />
            {copy.create}
          </button>
        </div>
        <p className={styles.hint}>{hasFeature(stage, 'jury') ? copy.createNote : copy.createNoteNoJury}</p>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{copy.user}</th>
              <th scope="col">{copy.role}</th>
              <th scope="col">{copy.access}</th>
              <th scope="col">{copy.status}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((account) => {
              const userRole = roleOf(account)
              const self = account.id === sessionAccountId
              const active = account.active !== false
              const fullName = `${account.profile.firstName} ${account.profile.lastName}`.trim()
              return (
                <tr key={account.id} className={cx(!active && styles.rowInactive)}>
                  <td className={styles.tableCompanyCell}>
                    <div>
                      <span className={styles.tableCompany}>
                        {fullName}
                        {created === account.id && <span className={styles.demoTag}>{copy.new}</span>}
                      </span>
                      <span className={styles.tableSub}>{account.email}</span>
                    </div>
                  </td>
                  <td data-label={copy.role}>
                    {userRole === 'jury1' || userRole === 'jury2' ? (
                      <span className={styles.tableStack}>
                        <span>{JURY_TYPE_LABEL[userRole]}</span>
                        <span className={styles.tableSubText}>{copy.juryManaged}</span>
                      </span>
                    ) : (
                      <select
                        className={styles.select}
                        aria-label={`${copy.role}: ${fullName}`}
                        value={userRole}
                        disabled={self}
                        onChange={(event) => void runCommand({ type: 'staff.setRole', accountId: account.id, role: event.target.value as StaffRole })}
                      >
                        <option value="verwaltung">{copy.roles.verwaltung}</option>
                        <option value="sachbearbeitung">{copy.roles.sachbearbeitung}</option>
                      </select>
                    )}
                  </td>
                  <td data-label={copy.access}>
                    <span className={styles.juryPassword}>
                      <code>{shown[account.id] ? account.demoPassword : '••••••••'}</code>
                      <button
                        type="button"
                        className={styles.textBtn}
                        aria-pressed={Boolean(shown[account.id])}
                        onClick={() => setShown((current) => ({ ...current, [account.id]: !current[account.id] }))}
                      >
                        {shown[account.id] ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                        {shown[account.id] ? copy.hide : copy.show}
                        <span className={styles.srOnly}>: {fullName}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.textBtn}
                        onClick={() => {
                          void runCommand({ type: 'account.resetAccess', accountId: account.id })
                          setShown((current) => ({ ...current, [account.id]: true }))
                        }}
                      >
                        <RefreshCw size={15} aria-hidden="true" />
                        {copy.regenerate}
                        <span className={styles.srOnly}>: {fullName}</span>
                      </button>
                    </span>
                  </td>
                  <td data-label={copy.status}>
                    <label className={styles.check}>
                      <input type="checkbox" checked={active} disabled={self} onChange={(event) => void runCommand({ type: 'staff.setActive', accountId: account.id, active: event.target.checked })} />
                      <span>{active ? copy.active : copy.inactive}</span>
                    </label>
                    {self && <span className={styles.tableSubText}>{copy.self}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
