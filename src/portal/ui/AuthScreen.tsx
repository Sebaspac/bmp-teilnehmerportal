'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Info } from 'lucide-react'

import { PRIVACY_POLICY_PATH, isValidSubmissionEmail } from '@/shared/formSubmission'
import Image from '@/shared/UnoptimizedImage'
import { PasswordField, TextField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { portalContent } from '@/portal/content/portalContent'
import { login, portalDemo, register, useStage } from '@/portal/data/portalClient'
import { hasFeature } from '@/portal/domain/release'
import { DEMO_PASSWORD } from '@/portal/domain/seed'
import styles from '@/portal/ui/portal.module.css'

type Mode = 'login' | 'register'
type Errors = Partial<Record<'email' | 'password' | 'consent' | 'form', string>>

const MIN_PASSWORD = 8

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter()
  const copy = portalContent.auth
  const stage = useStage()
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  // Nach Pfeiltasten-Wechsel den Fokus auf den neuen Tab setzen, sobald die Route umgeschaltet hat.
  const tabFocus = useRef(false)
  useEffect(() => {
    if (!tabFocus.current) return
    tabFocus.current = false
    document.getElementById(`portal-tab-${mode}`)?.focus()
  }, [mode])

  const switchMode = (next: Mode) => {
    setErrors({})
    setForgotOpen(false)
    router.replace(next === 'login' ? '/portal/anmelden' : '/portal/registrieren')
  }

  const validate = (): Errors => {
    const next: Errors = {}
    if (!email.trim()) next.email = copy.errors.emailRequired
    else if (!isValidSubmissionEmail(email)) next.email = copy.errors.emailInvalid
    if (!password) next.password = copy.errors.passwordRequired
    else if (mode === 'register' && password.length < MIN_PASSWORD) next.password = copy.errors.passwordShort
    if (mode === 'register' && !consent) next.consent = copy.errors.consentRequired
    return next
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      focusFirstInvalid(formRef.current)
      return
    }

    setBusy(true)
    if (mode === 'register') {
      const result = await register(email, password)
      if (!result.ok) {
        setBusy(false)
        setErrors({ email: copy.errors.emailTaken })
        focusFirstInvalid(formRef.current)
      }
      // Erfolgreich: PortalApp leitet weiter (Stammdaten).
      return
    }

    const result = await login(email, password)
    if (result !== 'ok') {
      setBusy(false)
      setErrors({ form: result === 'inactive' ? copy.errors.inactive : copy.errors.wrongCredentials })
    }
  }

  const formCopy = mode === 'login' ? copy.login : copy.register

  return (
    <main className={styles.auth} id="inhalt">
      <section className={cx(styles.authIntro, styles.onNavy)} aria-labelledby="portal-auth-title">
        <div className={styles.authIntroInner}>
          <h1 className={styles.authTitle} id="portal-auth-title">
            {copy.title}
          </h1>
          <div className={styles.authRule} aria-hidden="true" />
          <p className={styles.authLead}>{copy.lead}</p>
          <p className={styles.authNote}>{copy.separationNote}</p>
        </div>
      </section>

      <section className={cx(styles.authStepsWrap, styles.onNavy)} aria-labelledby="portal-auth-steps">
        <div className={cx(styles.authIntroInner, styles.authSteps)}>
          <h2 className={styles.authStepsHeading} id="portal-auth-steps">
            {copy.stepsHeading}
          </h2>
          <ol>
            {copy.steps.map((step, index) => (
              <li key={step.title} className={styles.authStep}>
                <span className={styles.authStepNum} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.authStepTitle}>{step.title}</span>
                <span className={styles.authStepDesc}>{step.desc}</span>
              </li>
            ))}
          </ol>
        </div>
        <Image src="/images/goldene-bavaria.png" alt="" className={styles.authArt} width={402} height={600} />
      </section>

      <section className={styles.authFormWrap} aria-label={formCopy.heading}>
        <div className={styles.authForm}>
          <div className={styles.tabs} role="tablist" aria-label={copy.title}>
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`portal-tab-${tab}`}
                aria-selected={mode === tab}
                aria-controls="portal-auth-panel"
                tabIndex={mode === tab ? 0 : -1}
                className={styles.tab}
                onClick={() => switchMode(tab)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    const next = tab === 'login' ? 'register' : 'login'
                    tabFocus.current = true
                    switchMode(next)
                  }
                }}
              >
                {copy.tabs[tab]}
              </button>
            ))}
          </div>

          <form
            ref={formRef}
            id="portal-auth-panel"
            role="tabpanel"
            aria-labelledby={`portal-tab-${mode}`}
            onSubmit={onSubmit}
            noValidate
          >
            <h2 className={styles.formHeading}>{formCopy.heading}</h2>
            {mode === 'register' && <p className={styles.formIntro}>{copy.register.intro}</p>}

            <div className={styles.formStack}>
              {errors.form && (
                <p className={styles.formAlert} role="alert">
                  <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  {errors.form}
                </p>
              )}

              <TextField
                label={copy.fields.email}
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder={portalContent.placeholders.email}
                value={email}
                onValueChange={(value) => {
                  setEmail(value)
                  setErrors((current) => ({ ...current, email: undefined, form: undefined }))
                }}
                onBlur={() => {
                  if (email.trim() && !isValidSubmissionEmail(email)) setErrors((current) => ({ ...current, email: copy.errors.emailInvalid }))
                }}
                error={errors.email}
              />

              <PasswordField
                label={copy.fields.password}
                hint={mode === 'register' ? copy.fields.passwordHint : undefined}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onValueChange={(value) => {
                  setPassword(value)
                  setErrors((current) => ({ ...current, password: undefined, form: undefined }))
                }}
                error={errors.password}
                labelAside={
                  mode === 'login' ? (
                    <button
                      type="button"
                      className={cx(styles.textBtn, styles.textBtnSmall)}
                      onClick={() => setForgotOpen((open) => !open)}
                      aria-expanded={forgotOpen}
                      aria-controls="portal-forgot-info"
                    >
                      {copy.login.forgot}
                    </button>
                  ) : undefined
                }
              />

              {mode === 'login' && forgotOpen && (
                <p className={styles.formInfo} id="portal-forgot-info">
                  <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  {portalContent.prototype.forgotPassword}
                </p>
              )}

              {mode === 'register' && (
                <div className={styles.field}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => {
                        setConsent(event.target.checked)
                        setErrors((current) => ({ ...current, consent: undefined }))
                      }}
                      aria-invalid={errors.consent ? true : undefined}
                      aria-describedby={errors.consent ? 'portal-consent-error' : undefined}
                    />
                    <span>
                      {copy.register.consent}{' '}
                      <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer">
                        {portalContent.submission.review.consentLink}
                      </a>
                    </span>
                  </label>
                  {errors.consent && (
                    <p className={styles.error} id="portal-consent-error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      {errors.consent}
                    </p>
                  )}
                </div>
              )}

              <button type="submit" className={cx(styles.btn, styles.btnPrimary)} disabled={busy} aria-busy={busy} style={{ width: '100%' }}>
                {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                {formCopy.submit}
                {!busy && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </div>

            {/* Nur Prototyp: Hinweis und Testzugänge entfallen ohne Demo-Backend. */}
            {portalDemo && (
              <p className={styles.formInfo} style={{ marginTop: 20 }}>
                <Info size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                {copy.demoHint}
              </p>
            )}

            {mode === 'login' && portalDemo && (
              <section className={styles.demoLogins} aria-labelledby="portal-demo-logins">
                <h2 className={styles.demoLoginsTitle} id="portal-demo-logins">
                  {copy.demoLogins.title}
                </h2>
                <p className={styles.hint}>{copy.demoLogins.intro(DEMO_PASSWORD)}</p>
                <ul className={styles.demoLoginList}>
                  {copy.demoLogins.accounts.filter((item) => !item.feature || hasFeature(stage, item.feature)).map((item) => (
                    <li key={item.email}>
                      <span className={styles.demoLoginText}>
                        <strong>{item.role}</strong>
                        <span className={styles.demoLoginEmail}>{item.email}</span>
                      </span>
                      <button
                        type="button"
                        className={styles.textBtn}
                        onClick={() => {
                          setEmail(item.email)
                          setPassword(DEMO_PASSWORD)
                          setErrors({})
                        }}
                      >
                        {copy.demoLogins.fill}
                        <span className={styles.srOnly}>: {item.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className={styles.switchLine}>
              {formCopy.switchPrompt}
              <button type="button" className={styles.textBtn} onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                {formCopy.switchAction}
              </button>
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
