'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Info, Lock, Save, Send } from 'lucide-react'

import { FieldShell, FootLabel, PrivacyNote, SelectField, TextAreaField, TextField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { applicationProgress } from '@/portal/domain/application'
import { applicantView, applicationLockReason } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { currentSnapshot, runCommand, useProcessContext } from '@/portal/data/portalClient'
import { submissionCompany } from '@/portal/domain/selectors'
import type { Account, PrizeId, QuestionField, QuestionSection, QuestionnaireAnswers, QuestionnaireDefinition, Submission } from '@/portal/domain/types'
import { CONFIRM_KEY, guidanceNote, isFilled, prizeById, requiredFields, validateSection } from '@/portal/domain/questionnaire'
import { summaryGroups } from '@/portal/ui/ApplicationView'
import { Page, Steps, type PageHandle } from '@/portal/ui/Page'
import { ReviewList, formatDateTime } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

const GUIDANCE_LETTERS = 'abcdefgh'

/** Eingaben auf das Antwortformat beschränken (z. B. nur Ziffern, Dezimalkomma). */
function normalize(field: QuestionField, value: string) {
  switch (field.type) {
    case 'zip':
      return value.replace(/\D/g, '').slice(0, 5)
    case 'year':
      return value.replace(/\D/g, '').slice(0, 4)
    case 'integer':
      return value.replace(/\D/g, '').slice(0, 6)
    case 'money': {
      // Nur ein eindeutiger Dezimalpunkt („12.5“) wird zum Komma. Alles andere bleibt sichtbar stehen und wird geprüft –
      // kein stilles Umdeuten von Tausenderpunkten oder Abschneiden von Stellen.
      const cleaned = value.replace(/[^\d.,]/g, '')
      return /^\d+\.\d?$/.test(cleaned) ? cleaned.replace('.', ',') : cleaned
    }
    default:
      return value
  }
}

/** Vorbelegung aus Anmeldung und Stammdaten – nur für leere Felder, die es im Fragebogen gibt. */
function prefill(submission: Submission, account: Account | null, sections: readonly QuestionSection[], answers: QuestionnaireAnswers): QuestionnaireAnswers {
  const isNomination = submission.type === 'fremdvorschlag'
  const source: QuestionnaireAnswers = isNomination
    ? { company_name: submission.nomination.companyName, city: submission.nomination.city, website: submission.nomination.website }
    : {
        company_name: submission.self.companyName,
        legal_form: submission.self.legalForm,
        street: submission.self.street,
        zip: submission.self.zip,
        city: submission.self.city,
        website: submission.self.website,
        founded: submission.self.foundedYear,
      }
  if (account && !isNomination) {
    const { profile } = account
    Object.assign(source, {
      contact_name: `${profile.firstName} ${profile.lastName}`.trim(),
      contact_role: profile.orgRole,
      contact_phone: profile.phone,
      contact_email: account.email,
    })
  }
  const ids = new Set(sections.flatMap((section) => section.fields.map((field) => field.id)))
  const merged = { ...answers }
  for (const [key, value] of Object.entries(source)) {
    if (ids.has(key) && value && !(merged[key] ?? '').trim()) merged[key] = value
  }
  return merged
}

/**
 * Fragebogen eines Preises (Phase 02). Je gewähltem Preis gibt es einen eigenen Fragebogen; Abschnitte und Fragen kommen
 * aus der `QuestionnaireDefinition`, die die Verwaltung bearbeitet und freischaltet. Mit Zwischenspeichern; nach dem
 * Einreichen nur lesbar. Die Preiswahl liegt auf einer eigenen Seite (`PrizeSheet`).
 */
export function QuestionnaireSheet({
  submission,
  account,
  prize,
  definition,
  demoHandover,
  urlStep = null,
  onStepChange,
  onChoosePrizes,
  onClose,
}: {
  submission: Submission
  account: Account | null
  prize: PrizeId
  definition: QuestionnaireDefinition | null
  demoHandover: boolean
  /** Abschnitt aus der URL (`?schritt=`), damit die Zurück-Taste des Browsers einen Abschnitt zurückgeht. */
  urlStep?: number | null
  onStepChange?: (step: number) => void
  onChoosePrizes: () => void
  onClose: () => void
}) {
  const copy = portalContent.questionnaire
  const sheetRef = useRef<PageHandle>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const ctx = useProcessContext()
  const company = submissionCompany(submission)
  const prizeTitle = prizeById(prize).title
  const view = applicantView(submission.process, submission.type, company, ctx)
  const entry = submission.process.questionnaires[prize]
  const sections = definition?.status === 'freigeschaltet' ? definition.sections : []
  const required = requiredFields(sections)
  const reviewStep = sections.length
  const stepLabels = [...sections.map((section) => section.step), copy.reviewStep]
  const chosen = submission.process.prizes.includes(prize)
  const access = view.applicationAccess === 'handover' && demoHandover ? 'open' : view.applicationAccess
  const submitted = entry?.status === 'eingereicht'
  const editable = access === 'open' && chosen && sections.length > 0 && !submitted
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => (editable ? prefill(submission, account, sections, entry?.answers ?? {}) : (entry?.answers ?? {})))
  const startStep = Math.min(entry?.step ?? 0, reviewStep)
  const [step, setStep] = useState(startStep)
  const [reachable, setReachable] = useState(startStep)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | undefined>(entry?.savedAt)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  // Nach „Ändern“ aus der Prüfung führt der Hauptbutton direkt zurück zur Prüfung.
  const [fromReview, setFromReview] = useState(false)
  const subtitle = `${company} · ${prizeTitle}`

  /** Jede Änderung wird sofort zwischengespeichert (Befehl questionnaire.save). */
  const save = (next: QuestionnaireAnswers, reached: number) => void runCommand({ type: 'questionnaire.save', submissionId: submission.id, prize, answers: next, step: reached })

  const update = (field: QuestionField | string, raw: string) => {
    const id = typeof field === 'string' ? field : field.id
    const value = typeof field === 'string' ? raw : normalize(field, raw)
    const next = { ...answers, [id]: value }
    setAnswers(next)
    setErrors((current) => {
      const copyErrors = { ...current }
      delete copyErrors[id]
      return copyErrors
    })
    save(next, Math.max(step, reachable))
    setSavedAt(new Date().toISOString())
  }

  // Browser-Zurück/Vor: Abschnitt aus der URL.
  useEffect(() => {
    if (!editable) return
    const target = urlStep ?? startStep
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
    save(answers, nextReachable)
    sheetRef.current?.scrollToTop()
  }

  const validateStep = (index: number) => {
    const found = index === reviewStep ? (answers[CONFIRM_KEY] === 'ja' ? {} : { [CONFIRM_KEY]: copy.errors.confirmed }) : validateSection(sections[index], answers)
    setErrors(found)
    if (Object.keys(found).length) {
      focusFirstInvalid(bodyRef.current)
      return false
    }
    return true
  }

  const next = () => {
    if (validateStep(step)) goTo(step + 1)
  }

  const jumpTo = (target: number) => {
    for (let index = step; index < target; index++) {
      if (!validateStep(index)) {
        if (index !== step) goTo(index)
        return
      }
    }
    goTo(target)
  }

  // Sichtbare und angesagte Bestätigung je Klick – auch mobil, wo nur das Symbol steht.
  const [justSaved, setJustSaved] = useState(false)
  const saveNow = () => {
    save(answers, Math.max(step, reachable))
    setSavedAt(new Date().toISOString())
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1800)
  }

  const submit = () => {
    if (submitting) return
    for (let index = 0; index <= reviewStep; index++) {
      if (!validateStep(index)) {
        if (index !== step) goTo(index)
        return
      }
    }
    setSubmitting(true)
    window.setTimeout(async () => {
      const ok = await runCommand({ type: 'questionnaire.submit', submissionId: submission.id, prize, answers })
      setSubmitting(false)
      if (!ok) return
      setDone(true)
      sheetRef.current?.scrollToTop()
    }, 900)
  }

  const answeredCount = required.filter((field) => isFilled(answers, field)).length
  const savedLabel = savedAt ? copy.savedAt(new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })) : ''
  const backToVorgang = (
    <button type="button" className={cx(styles.btn, styles.btnSecondary)} onClick={() => sheetRef.current?.close()}>
      <ArrowLeft size={16} aria-hidden="true" />
      {copy.backToVorgang}
    </button>
  )

  /* ── Eingereicht (gerade eben) ── */
  if (done) {
    // Den Stand direkt nach dem Befehl lesen: Ist die Bewerbung damit vollständig?
    const latest = currentSnapshot()?.submissions.find((item) => item.id === submission.id) ?? submission
    const progress = applicationProgress(latest.process, ctx.released)
    const missingDocs = progress.docs.total - progress.docs.uploaded
    const remaining = [
      ...[...progress.open, ...progress.waiting].map((id) => `${copy.title} ${prizeById(id).title}`),
      ...(missingDocs ? [`${missingDocs} ${missingDocs === 1 ? 'Unterlage' : 'Unterlagen'}`] : []),
    ]
    return (
      <Page
        ref={sheetRef}
        title={copy.title}
        subtitle={subtitle}
        onClose={onClose}
        backLabel={portalContent.sheet.backTo.vorgang}
        footer={
          <>
            <span />
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={() => sheetRef.current?.close()}>
              {copy.backToVorgang}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </>
        }
      >
        <div className={styles.done} role="status">
          <span className={styles.doneMarkLight} aria-hidden="true">
            <Check size={28} strokeWidth={2.5} />
          </span>
          <h3 className={styles.stepHeading}>{copy.submittedTitle}</h3>
          <p className={styles.stepIntro} style={{ marginBottom: 0 }}>
            {copy.submittedText(prizeTitle)} {latest.process.application === 'eingereicht' ? copy.applicationDone : remaining.length ? copy.remaining(remaining.join(', ')) : ''}
          </p>
          <p className={styles.noticeWarn}>
            <Info size={16} aria-hidden="true" />
            {copy.simulated}
          </p>
        </div>
      </Page>
    )
  }

  /* ── Nur lesen (eingereicht) ── */
  if (submitted && definition) {
    return (
      <Page ref={sheetRef} title={copy.title} subtitle={`${subtitle} · ${copy.readonlySubtitle} ${formatDateTime(entry.submittedAt)}`} onClose={onClose} backLabel={portalContent.sheet.backTo.vorgang}>
        <p className={styles.notice} style={{ marginBottom: 20 }}>
          <Lock size={16} aria-hidden="true" />
          {copy.readonlyNote}
        </p>
        <ReviewList groups={summaryGroups(definition.sections, entry.answers)} />
      </Page>
    )
  }

  /* ── Gesperrt, nicht gewählt oder Fragebogen noch nicht freigeschaltet ── */
  if (!editable) {
    const [title, text, icon] =
      access === 'hidden'
        ? [copy.hiddenTitle, copy.hiddenText, <Lock key="i" size={26} />]
        : access === 'handover'
          ? [copy.handoverTitle, copy.handoverText, <Lock key="i" size={26} />]
          : access !== 'open'
            ? [copy.lockedTitle, applicationLockReason(submission.process, submission.type), <Lock key="i" size={26} />]
            : !chosen
              ? [copy.notChosenTitle, copy.notChosenText, <FileText key="i" size={26} />]
              : [copy.pendingTitle(prizeTitle), copy.pendingText, <FileText key="i" size={26} />]
    return (
      <Page ref={sheetRef} title={copy.title} subtitle={subtitle} onClose={onClose} backLabel={portalContent.sheet.backTo.vorgang}>
        <div className={styles.lockedState}>
          <span className={styles.lockedIcon} aria-hidden="true">
            {icon}
          </span>
          <h3 className={styles.stepHeading}>{title}</h3>
          <p className={styles.stepIntro}>{text}</p>
          <div className={styles.lockedActions}>
            {access === 'open' && (
              <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onChoosePrizes}>
                {copy.prize.change}
              </button>
            )}
            {backToVorgang}
          </div>
        </div>
      </Page>
    )
  }

  /* ── Bearbeiten ── */
  const section = step < reviewStep ? sections[step] : null
  return (
    <Page
      ref={sheetRef}
      title={copy.title}
      subtitle={subtitle}
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.vorgang}
      rail={<Steps labels={stepLabels} current={step} reachable={reachable} onSelect={jumpTo} />}
      meta={
        <div className={styles.progressRow}>
          <span className={styles.progressBar} aria-hidden="true">
            <span style={{ transform: `scaleX(${required.length ? answeredCount / required.length : 1})` }} />
          </span>
          <span className={styles.progressText}>
            <strong className={styles.progressStep}>{copy.sectionOf(step + 1, stepLabels.length, stepLabels[step])}</strong>
            {' · '}
            {copy.progress(answeredCount, required.length)}
          </span>
        </div>
      }
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
            <button type="button" className={cx(styles.textBtn, styles.saveBtn, justSaved && styles.saveBtnDone)} onClick={saveNow} aria-label={copy.save}>
              {justSaved ? <CheckCircle2 size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              <span className={styles.saveLabel} aria-hidden="true">
                {justSaved ? copy.savedNow : copy.save}
              </span>
            </button>
            {savedLabel && (
              <span className={styles.savedNote}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {savedLabel}
              </span>
            )}
            <span className={styles.srOnly} aria-live="polite">
              {justSaved ? copy.savedNow : ''}
            </span>
          </div>
          {step < reviewStep && fromReview ? (
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={() => jumpTo(reviewStep)}>
              <FootLabel long={copy.backToReview} short={copy.backToReviewShort} />
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : step < reviewStep ? (
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={next}>
              {portalContent.sheet.next}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={submit} disabled={submitting} aria-busy={submitting}>
              {submitting ? <span className={styles.spinner} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              {submitting ? copy.submitting : <FootLabel long={copy.submit} short={copy.submitShort} />}
            </button>
          )}
        </>
      }
    >
      <div ref={bodyRef}>
        {demoHandover && view.applicationAccess === 'handover' && (
          <p className={styles.noticeWarn} style={{ marginBottom: 16 }}>
            <Info size={16} aria-hidden="true" />
            {copy.handoverDemo}
          </p>
        )}

        {step === 0 && (
          <div className={styles.fbIntro}>
            <p>{copy.intro(prizeTitle)}</p>
            <p className={styles.hint}>
              {copy.formatNote} {copy.autosave}
            </p>
            <div className={styles.fbPrize}>
              <p>
                {copy.prize.chosen(submission.process.prizes.length)} <strong>{submission.process.prizes.map((id) => prizeById(id).title).join(', ')}</strong>
              </p>
              <button type="button" className={styles.textBtn} onClick={onChoosePrizes}>
                {copy.prize.change}
              </button>
            </div>
          </div>
        )}

        {section && <SectionForm section={section} answers={answers} errors={errors} onChange={update} prefilledNote={step === 0 && prize === 'bmp' ? copy.prefilled : undefined} />}

        {step === reviewStep && (
          <section aria-labelledby="fb-review">
            <h3 className={styles.stepHeading} id="fb-review">
              {copy.reviewHeading}
            </h3>
            <p className={styles.stepIntro}>{copy.reviewIntro}</p>
            <ReviewList
              groups={summaryGroups(sections, answers)}
              onEdit={(target) => {
                setFromReview(true)
                goTo(target)
              }}
            />
            <div className={cx(styles.consentBox, errors[CONFIRM_KEY] && styles.consentBoxInvalid)}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={answers[CONFIRM_KEY] === 'ja'}
                  onChange={(event) => update(CONFIRM_KEY, event.target.checked ? 'ja' : '')}
                  aria-invalid={errors[CONFIRM_KEY] ? true : undefined}
                  aria-describedby={errors[CONFIRM_KEY] ? 'fb-confirm-error' : undefined}
                />
                <span>{copy.confirm}</span>
              </label>
              {errors[CONFIRM_KEY] && (
                <p className={styles.error} id="fb-confirm-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors[CONFIRM_KEY]}
                </p>
              )}
            </div>
            <PrivacyNote>{portalContent.privacy.questionnaire}</PrivacyNote>
            <p className={styles.fbThanks}>{copy.thanks}</p>
          </section>
        )}
      </div>
    </Page>
  )
}

/** Ein Abschnitt: bei Kriterien mit Leitfrage, Erläuterung und Orientierungsfragen a), b), … Auch für die Vorschau im Editor. */
export function SectionForm({
  section,
  answers,
  errors,
  onChange,
  prefilledNote,
}: {
  section: QuestionSection
  answers: QuestionnaireAnswers
  errors: Record<string, string>
  onChange: (field: QuestionField, value: string) => void
  prefilledNote?: string
}) {
  const copy = portalContent.questionnaire
  const headingId = `fb-${section.id}`
  return (
    <section aria-labelledby={headingId}>
      <h3 className={styles.stepHeading} id={headingId}>
        {section.heading}
      </h3>
      {section.intro && <p className={styles.stepIntro}>{section.intro}</p>}
      {prefilledNote && (
        <p className={styles.notice} style={{ marginBottom: 20 }}>
          <Info size={16} aria-hidden="true" />
          {prefilledNote}
        </p>
      )}

      {section.criterion && (
        <div className={styles.criterion}>
          <p className={styles.criterionLead}>{section.criterion.lead}</p>
          <p className={styles.criterionText}>{section.criterion.description}</p>
          <div className={styles.guidance}>
            <p className={styles.guidanceTitle}>{copy.guidanceTitle}</p>
            <p className={styles.hint}>{guidanceNote}</p>
            <ol className={styles.guidanceList}>
              {section.criterion.guidance.map((question, index) => (
                <li key={question}>
                  <span className={styles.guidanceLetter} aria-hidden="true">
                    {GUIDANCE_LETTERS[index]})
                  </span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className={styles.fbGrid}>
        {section.fields.map((field) => (
          <React.Fragment key={field.id}>
            {field.group && <h4 className={styles.fbGroup}>{field.group}</h4>}
            {field.groupNote && <p className={styles.fbGroupNote}>{field.groupNote}</p>}
            <QuestionInput field={field} value={answers[field.id] ?? ''} error={errors[field.id]} onChange={(value) => onChange(field, value)} />
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

function QuestionInput({ field, value, error, onChange }: { field: QuestionField; value: string; error?: string; onChange: (value: string) => void }) {
  const autoId = useId()
  const className = field.span === 'half' ? undefined : styles.span2
  const optional = !field.required

  if (field.type === 'textarea') {
    return (
      <TextAreaField
        className={className}
        label={field.label}
        hint={field.format}
        optional={optional}
        maxLength={field.maxLength ?? 1500}
        rows={field.id.startsWith('k') ? 14 : 7}
        value={value}
        onValueChange={onChange}
        error={error}
      />
    )
  }
  if (field.type === 'select') {
    return <SelectField className={className} label={field.label} hint={field.format} optional={optional} value={value} onValueChange={onChange} options={field.options ?? []} error={error} />
  }
  if (field.type === 'money') {
    return (
      <FieldShell id={autoId} label={field.label} hint={field.format} error={error} className={className}>
        <div className={styles.affixWrap}>
          <input
            id={autoId}
            className={cx(styles.input, styles.affixInput, error && styles.invalid)}
            inputMode="decimal"
            placeholder="0,0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-required="true"
            aria-describedby={[field.format ? `${autoId}-hint` : '', error ? `${autoId}-error` : ''].filter(Boolean).join(' ') || undefined}
          />
          <span className={styles.affix} aria-hidden="true">
            {portalContent.questionnaire.unit}
          </span>
        </div>
      </FieldShell>
    )
  }
  const inputType = field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'url' ? 'url' : 'text'
  const inputMode = field.type === 'zip' || field.type === 'year' || field.type === 'integer' ? 'numeric' : undefined
  return (
    <TextField
      className={className}
      label={field.label}
      hint={field.format}
      optional={optional}
      type={inputType}
      inputMode={inputMode}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      value={value}
      onValueChange={onChange}
      error={error}
    />
  )
}
