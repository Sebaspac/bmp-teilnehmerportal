'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Info, Send, Users } from 'lucide-react'

import { PRIVACY_POLICY_PATH } from '@/shared/formSubmission'
import Image from '@/shared/UnoptimizedImage'
import { FootLabel, PrivacyNote, SelectField, TextAreaField, TextField, YesNoField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { portalContent } from '@/portal/content/portalContent'
import { currentSnapshot, newClientId, runCommand } from '@/portal/data/portalClient'
import type { DraftInput } from '@/portal/domain/commands'
import {
  emptyNominationData,
  emptySelfData,
  type Account,
  type NominationData,
  type SelfData,
  type Submission,
  type SubmissionType,
} from '@/portal/domain/types'
import { PhaseTimeline } from '@/portal/ui/PhaseTimeline'
import { applicantView } from '@/portal/domain/process'
import {
  LIMITS,
  NOMINATION_REQUIRED,
  SELF_REQUIRED,
  validateNomination,
  validateSelf,
  type FieldErrors,
} from '@/portal/domain/registration'
import { Page, Steps, type PageHandle } from '@/portal/ui/Page'
import styles from '@/portal/ui/portal.module.css'

const isYoungCompany = (foundedYear: string) =>
  /^\d{4}$/.test(foundedYear) && new Date().getFullYear() - Number(foundedYear) < 3

const employeeLabel = (value: string) => portalContent.employeeOptions.find((option) => option.value === value)?.label || value

const yesNoLabel = (value: string) => (value === 'ja' ? portalContent.labels.yes : value === 'nein' ? portalContent.labels.no : '')

export const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

export const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

/* ── Zusammenfassung (Prüfen, Detailansicht) ─────────────────────────────── */

export type ReviewGroup = { title: string; step?: number; rows: Array<[string, string]> }

function personLines(account: Account) {
  const { profile } = account
  const salutation = portalContent.salutations.find((item) => item.value === profile.salutation && item.value)?.label
  const name = [salutation, profile.firstName, profile.lastName].filter(Boolean).join(' ')
  const org = [profile.orgRole, profile.orgName].filter(Boolean).join(', ')
  return { name, org, email: account.email, phone: profile.phone }
}

export function reviewGroups(type: SubmissionType, self: SelfData, nomination: NominationData, account: Account): ReviewGroup[] {
  const labels = portalContent.labels
  const copy = portalContent.submission
  const empty = copy.review.empty
  const value = (text: string) => text.trim() || empty
  const person = personLines(account)
  const personValue = [person.name, person.org, person.email, person.phone].filter(Boolean).join('\n')

  if (type === 'eigenbewerbung') {
    return [
      {
        title: copy.self.groups.company,
        step: 1,
        rows: [
          [labels.companyName, value(self.companyName)],
          [labels.legalForm, value(self.legalForm)],
          [labels.industry, value(self.industry)],
          [labels.website, value(self.website)],
        ],
      },
      {
        title: copy.self.groups.seat,
        step: 1,
        rows: [
          [labels.street, value(self.street)],
          [`${labels.zip} / ${labels.city}`, value(`${self.zip} ${self.city}`)],
          [labels.seatInBavaria, value(yesNoLabel(self.seatInBavaria))],
        ],
      },
      {
        title: copy.self.groups.facts,
        step: 1,
        rows: [
          [labels.foundedYear, value(self.foundedYear)],
          [labels.employees, value(employeeLabel(self.employees))],
          [labels.ownerManaged, value(yesNoLabel(self.ownerManaged))],
        ],
      },
      { title: copy.self.groups.portrait, step: 1, rows: [[copy.self.portraitLabel, value(self.portrait)]] },
      { title: copy.self.groups.contact, rows: [[copy.review.personLabel, personValue]] },
    ]
  }

  return [
    {
      title: copy.nomination.groups.company,
      step: 1,
      rows: [
        [labels.companyName, value(nomination.companyName)],
        [labels.nominationCity, value(nomination.city)],
        [labels.industry, value(nomination.industry)],
        [labels.website, value(nomination.website)],
      ],
    },
    {
      title: copy.nomination.groups.reason,
      step: 1,
      rows: [
        [copy.nomination.reasonLabel, value(nomination.reason)],
        [copy.nomination.relationLabel, value(nomination.relationship)],
      ],
    },
    { title: copy.nomination.groups.proposer, rows: [[copy.review.personLabel, personValue]] },
  ]
}

export function ReviewList({ groups, onEdit }: { groups: ReviewGroup[]; onEdit?: (step: number) => void }) {
  return (
    <div className={styles.review}>
      {groups.map((group) => (
        <section key={group.title} className={styles.reviewGroup} aria-label={group.title}>
          <div className={styles.reviewHead}>
            <h4 className={styles.reviewTitle}>{group.title}</h4>
            {onEdit && group.step !== undefined && (
              <button type="button" className={styles.textBtn} onClick={() => onEdit(group.step as number)}>
                {portalContent.submission.review.edit}
                <span className={styles.srOnly}>: {group.title}</span>
              </button>
            )}
          </div>
          <dl className={styles.reviewList}>
            {group.rows.map(([label, value]) =>
              group.rows.length === 1 && label === group.title ? (
                <div key={label} className={styles.reviewRow} style={{ gridTemplateColumns: '1fr' }}>
                  <dt className={styles.srOnly}>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ) : (
                <div key={label} className={styles.reviewRow}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ),
            )}
          </dl>
        </section>
      ))}
    </div>
  )
}

function PersonCard({ account, onEditProfile }: { account: Account; onEditProfile: () => void }) {
  const person = personLines(account)
  return (
    <div className={styles.field}>
      <div className={styles.personCard}>
        <span className={styles.personName}>{person.name}</span>
        {person.org && <span className={styles.personMeta}>{person.org}</span>}
        <span className={styles.personMeta}>
          {person.email}
          {person.phone ? ` · ${person.phone}` : ''}
        </span>
      </div>
      <p className={styles.hint} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {portalContent.submission.contactFromProfile}
        <button type="button" className={styles.textBtn} style={{ minHeight: 32 }} onClick={onEditProfile}>
          {portalContent.submission.editProfile}
        </button>
      </p>
    </div>
  )
}

/* ── Einreichen ──────────────────────────────────────────────────────────── */

export function SubmissionSheet({
  account,
  draft,
  presetType,
  onClose,
  onBeforeSubmit,
  onDone,
  onEditProfile,
  urlStep = null,
  onStepChange,
  draftKey,
  resumeAtSaved = false,
  registrationClosed = false,
}: {
  account: Account
  draft?: Submission
  presetType?: SubmissionType
  /** Schritt aus der URL (`?schritt=`), damit die Zurück-Taste des Browsers einen Schritt zurückgeht. */
  urlStep?: number | null
  onStepChange?: (step: number) => void
  /** Schlüssel aus der URL: Der Entwurf entsteht mit der ersten Eingabe unter genau dieser ID. */
  draftKey?: string
  /** „Weiter bearbeiten“: ohne Schritt in der URL beim gespeicherten Schritt fortsetzen (sonst beim ersten). */
  resumeAtSaved?: boolean
  /** Rundenverwaltung: Anmeldung geschlossen – Entwürfe bleiben erhalten, Einreichen ist gesperrt. */
  registrationClosed?: boolean
  onClose: () => void
  onBeforeSubmit: (id: string) => void
  onDone: (id: string) => void
  onEditProfile: (draftId: string) => void
}) {
  const copy = portalContent.submission
  const labels = portalContent.labels
  const placeholders = portalContent.placeholders
  const sheetRef = useRef<PageHandle>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const prefillSelf = (): SelfData => {
    const base = emptySelfData()
    const { profile } = account
    if (profile.group !== 'unternehmer' || !profile.orgName) return base
    return { ...base, companyName: profile.orgName, city: profile.orgCity, website: profile.orgWebsite }
  }

  const initialType = draft?.type ?? presetType ?? null
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null)
  const [type, setType] = useState<SubmissionType | null>(initialType)
  const [self, setSelf] = useState<SelfData>(() => {
    if (draft && draft.type === 'eigenbewerbung') return draft.self
    return initialType === 'eigenbewerbung' ? prefillSelf() : draft?.self ?? emptySelfData()
  })
  const [nomination, setNomination] = useState<NominationData>(draft?.nomination ?? emptyNominationData())
  // Eine URL ohne `?schritt=` meint den Einstieg: Schritt 1 (bzw. 2 mit vorgewählter Art) – oder beim Fortsetzen den
  // gespeicherten Schritt. Mit `?schritt=` gilt dieser, soweit er schon erreicht war.
  const baseStep = presetType ? 1 : 0
  const savedReach = draft ? Math.max(draft.step, baseStep) : baseStep
  const initialStep = resumeAtSaved ? savedReach : baseStep
  const [step, setStep] = useState(urlStep !== null ? Math.min(urlStep, savedReach) : initialStep)
  const [reachable, setReachable] = useState(savedReach)
  const [prefilled, setPrefilled] = useState(() => !draft && initialType === 'eigenbewerbung' && Boolean(account.profile.orgName) && account.profile.group === 'unternehmer')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [typeError, setTypeError] = useState('')
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<Submission | null>(null)
  const [savedVisible, setSavedVisible] = useState(Boolean(draft))

  /** Jede Änderung landet sofort im Entwurf; der erste Eintrag legt ihn an (ID aus der URL, sonst neu). */
  const persist = (patch: DraftInput) => {
    if (draftId) {
      void runCommand({ type: 'draft.update', submissionId: draftId, patch })
    } else {
      const id = draftKey ?? newClientId()
      void runCommand({ type: 'draft.create', draft: { id, type, self, nomination, step, ...patch } })
      setDraftId(id)
    }
    setSavedVisible(true)
  }

  const ensureDraftId = () => {
    if (draftId) return draftId
    const id = draftKey ?? newClientId()
    void runCommand({ type: 'draft.create', draft: { id, type, self, nomination, step } })
    setDraftId(id)
    return id
  }

  const updateSelf = <K extends keyof SelfData>(key: K, value: SelfData[K]) => {
    const next = { ...self, [key]: value }
    setSelf(next)
    setErrors((current) => ({ ...current, [key]: undefined }))
    persist({ self: next })
  }

  const updateNomination = <K extends keyof NominationData>(key: K, value: NominationData[K]) => {
    const next = { ...nomination, [key]: value }
    setNomination(next)
    setErrors((current) => ({ ...current, [key]: undefined }))
    persist({ nomination: next })
  }

  const chooseType = (next: SubmissionType) => {
    setType(next)
    setTypeError('')
    setErrors({})
    let nextSelf = self
    if (next === 'eigenbewerbung' && !self.companyName && !self.city) {
      nextSelf = prefillSelf()
      setSelf(nextSelf)
      setPrefilled(nextSelf.companyName !== '')
    }
    // Ein Entwurf entsteht erst mit der ersten eigenen Eingabe – Auswählen und Schließen hinterlässt nichts.
    if (draftId) persist({ type: next, self: nextSelf })
  }

  // Browser-Zurück/Vor: Schritt aus der URL übernehmen (nur erreichbare Schritte).
  useEffect(() => {
    const target = urlStep ?? initialStep
    if (target !== step && target <= reachable) {
      setStep(target)
      sheetRef.current?.scrollToTop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStep])

  const goTo = (target: number) => {
    if (target !== step) onStepChange?.(target)
    setStep(target)
    const nextReachable = Math.max(reachable, target)
    setReachable(nextReachable)
    if (draftId) persist({ step: nextReachable })
    sheetRef.current?.scrollToTop()
  }

  const validateStep = (index: number) => {
    if (index === 0) {
      if (!type) {
        setTypeError(copy.type.error)
        focusFirstInvalid(bodyRef.current)
        return false
      }
      return true
    }
    if (index === 1) {
      const found = type === 'eigenbewerbung' ? validateSelf(self) : validateNomination(nomination)
      setErrors(found)
      if (Object.keys(found).length) {
        focusFirstInvalid(bodyRef.current)
        return false
      }
    }
    return true
  }

  const next = () => {
    if (validateStep(step)) goTo(step + 1)
  }

  const jumpTo = (target: number) => {
    // Vorwärts nur über gültige Schritte.
    for (let index = step; index < target; index++) {
      if (!validateStep(index)) {
        if (index !== step) goTo(index)
        return
      }
    }
    goTo(target)
  }

  const submit = () => {
    if (submitting || !type || registrationClosed) return
    if (!validateStep(1)) {
      goTo(1)
      return
    }
    if (!consent) {
      setConsentError(copy.review.consentRequired)
      focusFirstInvalid(bodyRef.current)
      return
    }
    setSubmitting(true)
    const id = ensureDraftId()
    void runCommand({ type: 'draft.update', submissionId: id, patch: { type, self, nomination, step: 2 } })
    // Vorher anheften, damit die Bestätigung stehen bleibt, sobald der Entwurf als eingereicht gilt.
    onBeforeSubmit(id)
    // Kurze Pause wie bei einer echten Übertragung – nur Darstellung.
    window.setTimeout(async () => {
      const sent = await runCommand({ type: 'draft.submit', submissionId: id })
      setSubmitting(false)
      const result = sent ? currentSnapshot()?.submissions.find((item) => item.id === id) : undefined
      if (result) {
        setSubmitted(result)
        sheetRef.current?.scrollToTop()
      }
    }, 900)
  }

  /* ── Bestätigung ── */
  if (submitted) {
    const isSelf = submitted.type === 'eigenbewerbung'
    const company = isSelf ? submitted.self.companyName : submitted.nomination.companyName
    return (
      <Page
        ref={sheetRef}
        title={isSelf ? copy.detail.titleSelf : copy.detail.titleNomination}
        subtitle={company}
        onClose={() => onDone(submitted.id)}
        backLabel={portalContent.sheet.backTo.overview}
        footer={
          <>
            <span />
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={() => sheetRef.current?.close()}>
              {copy.done.backToPortal}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </>
        }
      >
        <div className={styles.done} role="status">
          <div className={cx(styles.doneHero, styles.onNavy)}>
            <Image src="/images/goldene-bavaria.png" alt="" className={styles.doneArt} width={402} height={600} />
            <span className={styles.doneMark} aria-hidden="true">
              <Check size={30} strokeWidth={2.5} />
            </span>
            <h3 className={styles.doneTitle}>{isSelf ? copy.done.selfHeading : copy.done.nominationHeading}</h3>
            <p className={styles.doneMeta}>
              <span>{company}</span>
              <span>
                {copy.done.reference} <span className={styles.reference}>{submitted.reference}</span>
              </span>
              <span>{formatDateTime(submitted.submittedAt)}</span>
            </p>
          </div>
          <div className={styles.doneNext}>
            <span className={styles.doneNextTitle}>{copy.done.nextHeading}</span>
            <p>{isSelf ? copy.done.selfNext : copy.done.nominationNext}</p>
            <PhaseTimeline view={applicantView(submitted.process, submitted.type, company)} compact />
          </div>
          <p className={styles.hint}>{portalContent.prototype.noMail}</p>
        </div>
      </Page>
    )
  }

  /* ── Schritte ── */
  const isSelf = type === 'eigenbewerbung'
  const companyForTitle = (isSelf ? self.companyName : type === 'fremdvorschlag' ? nomination.companyName : '').trim()
  const titleSuffix = type ? (isSelf ? copy.type.self.title : copy.type.nomination.title) : ''

  return (
    <Page
      ref={sheetRef}
      title={copy.newTitle}
      subtitle={[titleSuffix, companyForTitle].filter(Boolean).join(' · ') || copy.stepOf(step + 1, copy.steps.length)}
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.overview}
      rail={<Steps labels={copy.steps} current={step} reachable={reachable} onSelect={jumpTo} />}
      footer={
        <>
          <div className={styles.sheetFootStart}>
            {step > 0 ? (
              <button type="button" className={cx(styles.btn, styles.btnSecondary)} onClick={() => goTo(step - 1)} aria-label={portalContent.sheet.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                <span className={styles.footLabel}>{portalContent.sheet.back}</span>
              </button>
            ) : (
              <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.footClose)} onClick={() => sheetRef.current?.close()}>
                {portalContent.sheet.close}
              </button>
            )}
            {savedVisible && (
              <span className={styles.savedNote} aria-live="polite">
                <CheckCircle2 size={14} aria-hidden="true" />
                {portalContent.sheet.draftSaved}
              </span>
            )}
          </div>
          {step < 2 ? (
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={next}>
              {portalContent.sheet.next}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={submit} disabled={submitting || registrationClosed} aria-busy={submitting}>
              {submitting ? <span className={styles.spinner} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              {submitting ? copy.review.submitting : <FootLabel long={copy.review.submit} short={portalContent.questionnaire.submitShort} />}
            </button>
          )}
        </>
      }
    >
      <div ref={bodyRef}>
        {registrationClosed && (
          <p className={styles.noticeWarn} style={{ marginBottom: 18 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            {copy.registrationClosed}
          </p>
        )}
        {/* ── 1: Bewerbungsart ── */}
        {step === 0 && (
          <section aria-labelledby="portal-type-heading">
            <h3 className={styles.stepHeading} id="portal-type-heading">
              {copy.type.heading}
            </h3>
            <p className={styles.stepIntro}>{copy.type.intro}</p>
            <div
              className={styles.paths}
              role="radiogroup"
              aria-labelledby="portal-type-heading"
              aria-invalid={typeError ? true : undefined}
              aria-describedby={typeError ? 'portal-type-error' : undefined}
            >
              <PathOption
                checked={type === 'eigenbewerbung'}
                onSelect={() => chooseType('eigenbewerbung')}
                icon={<Building2 size={22} aria-hidden="true" />}
                title={copy.type.self.title}
                subtitle={copy.type.self.subtitle}
                desc={copy.type.self.desc}
                required={SELF_REQUIRED.length}
                extra={account.profile.group === 'unternehmer' && account.profile.orgName ? copy.type.self.prefill : undefined}
              />
              <PathOption
                checked={type === 'fremdvorschlag'}
                onSelect={() => chooseType('fremdvorschlag')}
                icon={<Users size={22} aria-hidden="true" />}
                title={copy.type.nomination.title}
                subtitle={copy.type.nomination.subtitle}
                desc={copy.type.nomination.desc}
                required={NOMINATION_REQUIRED.length}
              />
            </div>
            {typeError && (
              <p className={styles.error} id="portal-type-error" role="alert" style={{ marginTop: 12 }}>
                <AlertCircle size={14} aria-hidden="true" />
                {typeError}
              </p>
            )}
            {type && (
              <p className={styles.notice} style={{ marginTop: 16 }}>
                <Info size={16} aria-hidden="true" />
                {type === 'eigenbewerbung' ? copy.review.costSelf : copy.review.costNomination}
              </p>
            )}
          </section>
        )}

        {/* ── 2a: Eigenbewerbung ── */}
        {step === 1 && isSelf && (
          <section aria-labelledby="portal-self-heading">
            <h3 className={styles.stepHeading} id="portal-self-heading">
              {copy.self.heading}
            </h3>
            <p className={styles.stepIntro}>{copy.requiredNote}</p>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.self.groups.company}</legend>
              {prefilled && (
                <p className={styles.notice}>
                  <Info size={16} aria-hidden="true" />
                  {copy.self.prefilled}
                </p>
              )}
              <div className={styles.grid2}>
                <TextField
                  className={styles.span2}
                  label={labels.companyName}
                  autoComplete="organization"
                  placeholder={placeholders.companyName}
                  value={self.companyName}
                  onValueChange={(value) => updateSelf('companyName', value)}
                  error={errors.companyName}
                  maxLength={200}
                />
                <SelectField
                  label={labels.legalForm}
                  optional
                  value={self.legalForm}
                  onValueChange={(value) => updateSelf('legalForm', value)}
                  options={portalContent.legalForms.map((form) => ({ value: form, label: form }))}
                />
                <TextField
                  label={labels.industry}
                  placeholder={placeholders.industry}
                  value={self.industry}
                  onValueChange={(value) => updateSelf('industry', value)}
                  error={errors.industry}
                  maxLength={200}
                />
                <TextField
                  className={styles.span2}
                  label={labels.website}
                  type="url"
                  inputMode="url"
                  optional
                  placeholder={placeholders.website}
                  value={self.website}
                  onValueChange={(value) => updateSelf('website', value)}
                  error={errors.website}
                  maxLength={200}
                />
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.self.groups.seat}</legend>
              <TextField
                label={labels.street}
                autoComplete="address-line1"
                placeholder={placeholders.street}
                value={self.street}
                onValueChange={(value) => updateSelf('street', value)}
                error={errors.street}
                maxLength={200}
              />
              <div className={styles.gridZip}>
                <TextField
                  label={labels.zip}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={self.zip}
                  onValueChange={(value) => updateSelf('zip', value.replace(/[^\d]/g, '').slice(0, 5))}
                  error={errors.zip}
                />
                <TextField
                  label={labels.city}
                  autoComplete="address-level2"
                  placeholder={placeholders.city}
                  value={self.city}
                  onValueChange={(value) => updateSelf('city', value)}
                  error={errors.city}
                  maxLength={120}
                />
              </div>
              <YesNoField
                name="portal-seat"
                label={labels.seatInBavaria}
                value={self.seatInBavaria}
                onValueChange={(value) => updateSelf('seatInBavaria', value)}
                error={errors.seatInBavaria}
              />
              {self.seatInBavaria === 'nein' && (
                <p className={styles.noticeWarn} role="status">
                  <AlertTriangle size={16} aria-hidden="true" />
                  {copy.self.bavariaHint}
                </p>
              )}
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.self.groups.facts}</legend>
              <div className={styles.grid2}>
                <TextField
                  label={labels.foundedYear}
                  inputMode="numeric"
                  placeholder={placeholders.year}
                  value={self.foundedYear}
                  onValueChange={(value) => updateSelf('foundedYear', value.replace(/[^\d]/g, '').slice(0, 4))}
                  error={errors.foundedYear}
                />
                <SelectField
                  label={labels.employees}
                  value={self.employees}
                  onValueChange={(value) => updateSelf('employees', value)}
                  options={portalContent.employeeOptions}
                  error={errors.employees}
                />
              </div>
              {isYoungCompany(self.foundedYear) && (
                <p className={styles.noticeWarn} role="status">
                  <AlertTriangle size={16} aria-hidden="true" />
                  {copy.self.marketHint}
                </p>
              )}
              <YesNoField
                name="portal-owner"
                label={labels.ownerManaged}
                value={self.ownerManaged}
                onValueChange={(value) => updateSelf('ownerManaged', value)}
                error={errors.ownerManaged}
              />
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.self.groups.portrait}</legend>
              <TextAreaField
                label={copy.self.portraitLabel}
                hint={copy.self.portraitHint}
                rows={7}
                maxLength={LIMITS.portrait}
                value={self.portrait}
                onValueChange={(value) => updateSelf('portrait', value)}
                error={errors.portrait}
              />
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.self.groups.contact}</legend>
              <PersonCard account={account} onEditProfile={() => onEditProfile(ensureDraftId())} />
            </fieldset>
          </section>
        )}

        {/* ── 2b: Fremdvorschlag ── */}
        {step === 1 && type === 'fremdvorschlag' && (
          <section aria-labelledby="portal-nomination-heading">
            <h3 className={styles.stepHeading} id="portal-nomination-heading">
              {copy.nomination.heading}
            </h3>
            <p className={styles.stepIntro}>{copy.nomination.intro}</p>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.nomination.groups.company}</legend>
              <div className={styles.grid2}>
                <TextField
                  label={labels.companyName}
                  placeholder={placeholders.companyName}
                  value={nomination.companyName}
                  onValueChange={(value) => updateNomination('companyName', value)}
                  error={errors.companyName}
                  maxLength={200}
                />
                <TextField
                  label={labels.nominationCity}
                  placeholder={placeholders.city}
                  value={nomination.city}
                  onValueChange={(value) => updateNomination('city', value)}
                  error={errors.city}
                  maxLength={120}
                />
                <TextField
                  label={labels.industry}
                  optional
                  placeholder={placeholders.industry}
                  value={nomination.industry}
                  onValueChange={(value) => updateNomination('industry', value)}
                  maxLength={200}
                />
                <TextField
                  label={labels.website}
                  type="url"
                  inputMode="url"
                  optional
                  placeholder={placeholders.website}
                  value={nomination.website}
                  onValueChange={(value) => updateNomination('website', value)}
                  error={errors.website}
                  maxLength={200}
                />
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.nomination.groups.reason}</legend>
              <TextAreaField
                label={copy.nomination.reasonLabel}
                hint={copy.nomination.reasonHint}
                rows={5}
                maxLength={LIMITS.reason}
                value={nomination.reason}
                onValueChange={(value) => updateNomination('reason', value)}
                error={errors.reason}
              />
              <SelectField
                label={copy.nomination.relationLabel}
                optional
                value={nomination.relationship}
                onValueChange={(value) => updateNomination('relationship', value)}
                options={portalContent.relationships.map((item) => ({ value: item, label: item }))}
              />
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{copy.nomination.groups.proposer}</legend>
              <PersonCard account={account} onEditProfile={() => onEditProfile(ensureDraftId())} />
              <PrivacyNote>{portalContent.privacy.nomination}</PrivacyNote>
            </fieldset>
          </section>
        )}

        {/* ── 3: Prüfen & einreichen ── */}
        {step === 2 && type && (
          <section aria-labelledby="portal-review-heading">
            <h3 className={styles.stepHeading} id="portal-review-heading">
              {copy.review.heading}
            </h3>
            <p className={styles.stepIntro}>{copy.review.intro}</p>

            <ReviewList
              groups={[
                { title: copy.review.typeLabel, step: 0, rows: [[copy.review.typeLabel, isSelf ? `${copy.type.self.title} – ${copy.type.self.subtitle}` : `${copy.type.nomination.title} – ${copy.type.nomination.subtitle}`]] },
                ...reviewGroups(type, self, nomination, account),
              ]}
              onEdit={goTo}
            />

            <p className={styles.notice} style={{ marginTop: 16 }}>
              <Info size={16} aria-hidden="true" />
              {isSelf ? copy.review.costSelf : copy.review.costNomination}
            </p>

            <div className={cx(styles.consentBox, consentError && styles.consentBoxInvalid)}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked)
                    setConsentError('')
                  }}
                  aria-invalid={consentError ? true : undefined}
                  aria-describedby={consentError ? 'portal-submission-consent-error' : undefined}
                />
                <span>
                  {copy.review.consent}{' '}
                  <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer">
                    {copy.review.consentLink}
                  </a>
                </span>
              </label>
              {consentError && (
                <p className={styles.error} id="portal-submission-consent-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {consentError}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </Page>
  )
}

function PathOption({
  checked,
  onSelect,
  icon,
  title,
  subtitle,
  desc,
  required,
  extra,
}: {
  checked: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  desc: string
  required: number
  extra?: string
}) {
  return (
    <label className={styles.path}>
      <input type="radio" name="portal-submission-type" checked={checked} onChange={onSelect} />
      <span className={styles.pathTop}>
        <span className={styles.pathIcon}>{icon}</span>
        <span className={styles.radioMark} aria-hidden="true" />
      </span>
      <span>
        <span className={styles.pathTitle} style={{ display: 'block' }}>
          {title}
        </span>
        <span className={styles.pathSubtitle}>{subtitle}</span>
      </span>
      <span className={styles.pathDesc}>{desc}</span>
      <span className={styles.pathEffort}>
        <span className={styles.pathEffortStrong}>{portalContent.submission.type.requiredCount(required)}</span>
        <span className={styles.pathEffortBar} aria-hidden="true">
          {Array.from({ length: required }, (_, index) => (
            <span key={index} />
          ))}
        </span>
        {extra && <span>{extra}</span>}
      </span>
    </label>
  )
}
