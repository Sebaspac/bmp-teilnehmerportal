'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Info, Lock, Save, Send } from 'lucide-react'

import { FieldShell, FootLabel, MultiChoiceField, PrivacyNote, SelectField, TextAreaField, TextField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { PhaseTimeline } from '@/portal/ui/PhaseTimeline'
import { applicantView, questionnaireLockReason } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand } from '@/portal/data/portalClient'
import { submissionCompany } from '@/portal/domain/selectors'
import type { Account, QuestionnaireAnswers, Submission } from '@/portal/domain/types'
import {
  CONFIRM_KEY,
  PRIZES,
  PRIZE_KEY,
  QUESTIONNAIRE,
  REQUIRED_FIELDS,
  displayValue,
  guidanceNote,
  encodePrizes,
  isFilled,
  prizeTitles,
  prizesOf,
  validateSection,
  type PrizeId,
  type QuestionField,
  type QuestionSection,
} from '@/portal/domain/questionnaire'
import { Sheet, SheetSteps, type SheetHandle } from '@/portal/ui/Sheet'
import { ReviewList, formatDateTime, type ReviewGroup } from '@/portal/ui/SubmissionSheet'
import styles from '@/portal/ui/portal.module.css'

const REVIEW_STEP = QUESTIONNAIRE.length
const STEP_LABELS = [...QUESTIONNAIRE.map((section) => section.step), portalContent.questionnaire.reviewStep]
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

/** Vorbelegung aus Anmeldung und Stammdaten – nur für leere Felder. */
function prefill(submission: Submission, account: Account | null, answers: QuestionnaireAnswers): QuestionnaireAnswers {
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
  const merged = { ...answers }
  for (const [key, value] of Object.entries(source)) {
    if (value && !(merged[key] ?? '').trim()) merged[key] = value
  }
  return merged
}

/** Zusammenfassung für Prüfen, Lesen und Jury. Die Preiswahl steht vorn (step −1 = zurück zur Preiswahl). */
export function summaryGroups(answers: QuestionnaireAnswers): ReviewGroup[] {
  const copy = portalContent.questionnaire.prize
  return [
    { title: copy.reviewGroup, step: -1, rows: [[copy.reviewLabel, prizeTitles(prizesOf(answers)) || '–']] },
    ...QUESTIONNAIRE.map((section, index) => ({
      title: section.heading,
      step: index,
      // Freiwillige Referenzen nur zeigen, wenn angegeben.
      rows: section.fields
        .filter((field) => !field.id.startsWith('ref') || isFilled(answers, field))
        .map((field) => [field.label, displayValue(field, answers[field.id])] as [string, string]),
    })),
  ]
}

/**
 * Bewerbungsfragebogen (Phase 02) – Fragen aus dem BMP-Fragebogen mit festen Antwortformaten. Gesperrt, bis die
 * Verwaltung ihn freigibt; danach zuerst Preiswahl, dann der Fragebogen des Preises mit Zwischenspeichern; nach der
 * (simulierten) Einreichung nur lesbar.
 */
export function QuestionnaireSheet({
  submission,
  account,
  demoHandover,
  openPrizes = false,
  urlStep = null,
  onStepChange,
  onPrizeEntry,
  onClose,
}: {
  submission: Submission
  account: Account | null
  demoHandover: boolean
  /** Direkt mit der Preiswahl öffnen (z. B. „Preisauswahl ändern“). */
  openPrizes?: boolean
  /** Abschnitt aus der URL (`?schritt=`), damit die Zurück-Taste des Browsers einen Abschnitt zurückgeht. */
  urlStep?: number | null
  onStepChange?: (step: number) => void
  /** Preiswahl als Einstieg in der URL markieren (`?preise=1`), damit Vor/Zurück sie wiederfinden. */
  onPrizeEntry?: () => void
  onClose: () => void
}) {
  const copy = portalContent.questionnaire
  const sheetRef = useRef<SheetHandle>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const company = submissionCompany(submission)
  const view = applicantView(submission.process, submission.type, company)
  const editable = view.questionnaireAccess === 'open' || (view.questionnaireAccess === 'handover' && demoHandover)
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() =>
    editable ? prefill(submission, account, submission.process.answers) : submission.process.answers,
  )
  const startStep = Math.min(submission.process.questionnaireStep, REVIEW_STEP)
  const [step, setStep] = useState(startStep)
  const [reachable, setReachable] = useState(startStep)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | undefined>(submission.process.questionnaireSavedAt)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  // Nach „Ändern“ aus der Prüfung führt der Hauptbutton direkt zurück zur Prüfung.
  const [fromReview, setFromReview] = useState(false)
  const [choosingPrize, setChoosingPrize] = useState(() => editable && (openPrizes || !prizesOf(submission.process.answers).length))
  const [prizeDraft, setPrizeDraft] = useState<PrizeId[]>(() => prizesOf(submission.process.answers).map((prize) => prize.id))
  const prizes = prizesOf(answers)
  // Der vorhandene Fragebogen gehört zum Bayerischen Mittelstandspreis; für die übrigen Preise folgt er.
  const activePrize = prizes.find((prize) => prize.hasQuestionnaire)
  const pendingTitles = prizes.filter((prize) => !prize.hasQuestionnaire).map((prize) => prize.title)
  const subtitle = activePrize ? `${company} · ${activePrize.title}` : company

  /** Jede Änderung wird sofort zwischengespeichert (Befehl questionnaire.save). */
  const save = (next: QuestionnaireAnswers, reached: number) =>
    void runCommand({ type: 'questionnaire.save', submissionId: submission.id, answers: next, step: reached })

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

  // Browser-Zurück/Vor: Abschnitt aus der URL; ohne Abschnitt (und ohne frühere Preiswahl) ist die Preiswahl der Schritt davor.
  const [startedWithoutPrizes] = useState(() => !prizesOf(submission.process.answers).length)
  useEffect(() => {
    if (editable && startedWithoutPrizes && urlStep === null && !openPrizes) onPrizeEntry?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!editable) return
    if (urlStep === null && (openPrizes || startedWithoutPrizes)) {
      setChoosingPrize(true)
      return
    }
    if (urlStep !== null && choosingPrize && prizesOf(answers).length) setChoosingPrize(false)
    const target = urlStep ?? startStep
    if (target !== step && target <= reachable) {
      setStep(target)
      sheetRef.current?.scrollToTop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStep, openPrizes])

  const goTo = (target: number) => {
    if (target !== step) onStepChange?.(target)
    setStep(target)
    const nextReachable = Math.max(reachable, target)
    setReachable(nextReachable)
    save(answers, nextReachable)
    sheetRef.current?.scrollToTop()
  }

  const validateStep = (index: number) => {
    const found =
      index === REVIEW_STEP
        ? answers[CONFIRM_KEY] === 'ja'
          ? {}
          : { [CONFIRM_KEY]: copy.errors.confirmed }
        : validateSection(QUESTIONNAIRE[index], answers)
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
    for (let index = 0; index <= REVIEW_STEP; index++) {
      if (!validateStep(index)) {
        if (index !== step) goTo(index)
        return
      }
    }
    setSubmitting(true)
    window.setTimeout(async () => {
      const submitted = await runCommand({ type: 'questionnaire.submit', submissionId: submission.id, answers })
      setSubmitting(false)
      if (!submitted) return
      setDone(true)
      sheetRef.current?.scrollToTop()
    }, 900)
  }

  const openPrizeChoice = () => {
    setPrizeDraft(prizes.map((prize) => prize.id))
    setErrors({})
    setChoosingPrize(true)
    sheetRef.current?.scrollToTop()
  }

  const confirmPrize = () => {
    if (!prizeDraft.length) {
      setErrors({ [PRIZE_KEY]: copy.prize.error })
      window.requestAnimationFrame(() => document.getElementById('fb-prize-choice')?.focus())
      return
    }
    const encoded = encodePrizes(prizeDraft)
    if (encoded !== answers[PRIZE_KEY]) update(PRIZE_KEY, encoded)
    // Verlaufseintrag: Zurück aus Abschnitt 1 führt wieder zur Preiswahl – nur wenn sie der Einstieg war.
    if (urlStep === null && (startedWithoutPrizes || openPrizes)) onStepChange?.(step)
    setErrors({})
    setChoosingPrize(false)
    sheetRef.current?.scrollToTop()
  }

  const answeredCount = REQUIRED_FIELDS.filter((field) => isFilled(answers, field)).length
  const savedLabel = savedAt ? copy.savedAt(new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })) : ''

  /* ── Eingereicht (gerade eben) ── */
  if (done) {
    const after = applicantView(submission.process, submission.type, company)
    return (
      <Sheet
        ref={sheetRef}
        title={copy.title}
        subtitle={company}
        onClose={onClose}
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
            {copy.submittedText}
          </p>
          {pendingTitles.length > 0 && (
            <p className={styles.notice}>
              <Info size={16} aria-hidden="true" />
              {copy.prize.pendingNote(pendingTitles)}
            </p>
          )}
          <p className={styles.noticeWarn}>
            <Info size={16} aria-hidden="true" />
            {copy.simulated}
          </p>
          <PhaseTimeline view={after} compact />
        </div>
      </Sheet>
    )
  }

  /* ── Gesperrt ── */
  if (!editable && view.questionnaireAccess !== 'readonly') {
    return (
      <Sheet ref={sheetRef} title={copy.title} subtitle={company} onClose={onClose}>
        <div className={styles.lockedState}>
          <span className={styles.lockedIcon} aria-hidden="true">
            <Lock size={26} />
          </span>
          <h3 className={styles.stepHeading}>
            {view.questionnaireAccess === 'hidden' ? copy.hiddenTitle : view.questionnaireAccess === 'handover' ? copy.handoverTitle : copy.lockedTitle}
          </h3>
          <p className={styles.stepIntro}>
            {view.questionnaireAccess === 'hidden'
              ? copy.hiddenText
              : view.questionnaireAccess === 'handover'
                ? copy.handoverText
                : questionnaireLockReason(submission.process, submission.type)}
          </p>
          <PhaseTimeline view={view} compact />
          <button type="button" className={cx(styles.btn, styles.btnSecondary)} onClick={() => sheetRef.current?.close()}>
            <ArrowLeft size={16} aria-hidden="true" />
            {copy.backToVorgang}
          </button>
        </div>
      </Sheet>
    )
  }

  /* ── Nur lesen (eingereicht) ── */
  if (!editable) {
    return (
      <Sheet ref={sheetRef} title={copy.title} subtitle={`${subtitle} · ${copy.readonlySubtitle} ${formatDateTime(submission.process.questionnaireSubmittedAt)}`} onClose={onClose}>
        <p className={styles.notice} style={{ marginBottom: 20 }}>
          <Lock size={16} aria-hidden="true" />
          {copy.readonlyNote}
        </p>
        <ReviewList groups={summaryGroups(answers)} />
      </Sheet>
    )
  }

  /* ── Preiswahl: führt zum Fragebogen des gewählten Preises ── */
  if (choosingPrize || !prizes.length) {
    return (
      <Sheet
        ref={sheetRef}
        title={copy.title}
        subtitle={company}
        onClose={onClose}
        footer={
          <>
            <button
              type="button"
              className={cx(styles.btn, styles.btnSecondary, !prizes.length && styles.footClose)}
              onClick={() => (prizes.length ? setChoosingPrize(false) : sheetRef.current?.close())}
            >
              {prizes.length ? copy.prize.cancel : portalContent.sheet.close}
            </button>
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={confirmPrize}>
              <FootLabel long={copy.prize.continue} short={portalContent.sheet.next} />
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </>
        }
      >
        <section aria-labelledby="fb-prize">
          {demoHandover && view.questionnaireAccess === 'handover' && (
            <p className={styles.noticeWarn} style={{ marginBottom: 16 }}>
              <Info size={16} aria-hidden="true" />
              {copy.handoverDemo}
            </p>
          )}
          <h3 className={styles.stepHeading} id="fb-prize">
            {copy.prize.heading}
          </h3>
          <p className={styles.stepIntro}>{copy.prize.intro}</p>
          <MultiChoiceField<PrizeId>
            id="fb-prize-choice"
            legend={copy.prize.legend}
            legendClassName={styles.srOnly}
            name={`prize-${submission.id}`}
            value={prizeDraft}
            onValueChange={(value) => {
              setPrizeDraft(value)
              setErrors({})
            }}
            options={PRIZES.map((option) => ({
              value: option.id,
              label: option.title,
              desc: option.desc,
              tag: option.hasQuestionnaire ? undefined : copy.prize.pending,
            }))}
            error={errors[PRIZE_KEY]}
          />
        </section>
      </Sheet>
    )
  }

  /* ── Nur Preise ohne Fragebogen gewählt (vorerst leer) ── */
  if (!activePrize) {
    return (
      <Sheet
        ref={sheetRef}
        title={copy.title}
        subtitle={`${company} · ${pendingTitles.join(', ')}`}
        onClose={onClose}
        footer={
          <>
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.footClose)} onClick={() => sheetRef.current?.close()}>
              {portalContent.sheet.close}
            </button>
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={openPrizeChoice}>
              <ArrowLeft size={16} aria-hidden="true" />
              {copy.prize.other}
            </button>
          </>
        }
      >
        <div className={styles.lockedState}>
          <span className={styles.lockedIcon} aria-hidden="true">
            <FileText size={26} />
          </span>
          <h3 className={styles.stepHeading}>{copy.prize.emptyTitle(pendingTitles)}</h3>
          <p className={styles.stepIntro}>{copy.prize.emptyText}</p>
        </div>
      </Sheet>
    )
  }

  /* ── Bearbeiten ── */
  const section = step < REVIEW_STEP ? QUESTIONNAIRE[step] : null
  return (
    <Sheet
      ref={sheetRef}
      title={copy.title}
      subtitle={subtitle}
      onClose={onClose}
      steps={
        <>
          <SheetSteps labels={STEP_LABELS} current={step} reachable={reachable} onSelect={jumpTo} />
          <div className={styles.progressRow}>
            <span className={styles.progressBar} aria-hidden="true">
              <span style={{ transform: `scaleX(${answeredCount / REQUIRED_FIELDS.length})` }} />
            </span>
            <span className={styles.progressText}>
              <strong className={styles.progressStep}>{copy.sectionOf(step + 1, STEP_LABELS.length, STEP_LABELS[step])}</strong>
              {' · '}
              {copy.progress(answeredCount, REQUIRED_FIELDS.length)}
            </span>
          </div>
        </>
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
          {step < REVIEW_STEP && fromReview ? (
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={() => jumpTo(REVIEW_STEP)}>
              <FootLabel long={copy.backToReview} short={copy.backToReviewShort} />
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : step < REVIEW_STEP ? (
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
        {demoHandover && view.questionnaireAccess === 'handover' && (
          <p className={styles.noticeWarn} style={{ marginBottom: 16 }}>
            <Info size={16} aria-hidden="true" />
            {copy.handoverDemo}
          </p>
        )}

        {step === 0 && (
          <div className={styles.fbIntro}>
            <p>{copy.intro}</p>
            <p className={styles.hint}>
              {copy.formatNote} {copy.autosave}
            </p>
            <div className={styles.fbPrize}>
              <p>
                {copy.prize.chosen(prizes.length)} <strong>{prizeTitles(prizes)}</strong>
              </p>
              {pendingTitles.length > 0 && <p className={styles.hint}>{copy.prize.pendingNote(pendingTitles)}</p>}
              <button type="button" className={styles.textBtn} onClick={openPrizeChoice}>
                {copy.prize.change}
              </button>
            </div>
          </div>
        )}

        {section && <SectionForm section={section} answers={answers} errors={errors} onChange={update} prefilledNote={step === 0 ? copy.prefilled : undefined} />}

        {step === REVIEW_STEP && (
          <section aria-labelledby="fb-review">
            <h3 className={styles.stepHeading} id="fb-review">
              {copy.reviewHeading}
            </h3>
            <p className={styles.stepIntro}>{copy.reviewIntro}</p>
            <ReviewList
              groups={summaryGroups(answers)}
              onEdit={(target) => {
                if (target < 0) return openPrizeChoice()
                setFromReview(true)
                goTo(target)
              }}
            />
            {pendingTitles.length > 0 && (
              <p className={styles.notice} style={{ marginTop: 16 }}>
                <Info size={16} aria-hidden="true" />
                {copy.prize.pendingNote(pendingTitles)}
              </p>
            )}
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
    </Sheet>
  )
}

/** Ein Abschnitt: bei Kriterien mit Leitfrage, Erläuterung und Orientierungsfragen a), b), … */
function SectionForm({
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
