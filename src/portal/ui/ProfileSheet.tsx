'use client'

import React, { useRef, useState } from 'react'
import { Info } from 'lucide-react'

import { ChoiceField, FootLabel, PrivacyNote, SelectField, TextField, cx, focusFirstInvalid } from '@/portal/ui/fields'
import { portalContent } from '@/portal/content/portalContent'
import { runCommand } from '@/portal/data/portalClient'
import { isProfileComplete } from '@/portal/domain/selectors'
import type { Account, PortalGroup, Profile } from '@/portal/domain/types'
import { Page, type PageHandle } from '@/portal/ui/Page'
import styles from '@/portal/ui/portal.module.css'

type Errors = Partial<Record<'firstName' | 'lastName' | 'group' | 'orgName', string>>

export type ProfileIntent = 'welcome' | 'beforeSubmission' | 'edit'

export function ProfileSheet({
  account,
  intent,
  onClose,
  onSaved,
}: {
  account: Account
  intent: ProfileIntent
  onClose: () => void
  onSaved: () => void
}) {
  const copy = portalContent.profile
  const labels = portalContent.labels
  const sheetRef = useRef<PageHandle>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [profile, setProfile] = useState<Profile>(account.profile)
  const [errors, setErrors] = useState<Errors>({})

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const hasOrganization = profile.group === 'unternehmer' || profile.group === 'institution'
  const orgKey = profile.group === 'institution' ? 'institution' : 'unternehmer'

  const validate = (): Errors => {
    const required = portalContent.submission.errors.requiredBy
    const next: Errors = {}
    if (!profile.firstName.trim()) next.firstName = required.firstName
    if (!profile.lastName.trim()) next.lastName = required.lastName
    if (!profile.group) next.group = required.group
    if (hasOrganization && !profile.orgName.trim()) next.orgName = required.orgName
    return next
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      focusFirstInvalid(formRef.current)
      return
    }
    // Privatpersonen haben keine Organisation; nichts Verstecktes mitspeichern.
    const cleaned: Profile = hasOrganization ? profile : { ...profile, orgName: '', orgRole: '', orgCity: '', orgWebsite: '' }
    if (await runCommand({ type: 'profile.save', profile: cleaned })) onSaved()
  }

  const title = intent === 'welcome' ? copy.welcomeTitle : copy.title
  const intro = intent === 'welcome' ? copy.welcomeIntro : intent === 'beforeSubmission' ? copy.beforeSubmissionIntro : copy.intro
  const wasComplete = isProfileComplete(account.profile)

  return (
    <Page
      ref={sheetRef}
      title={title}
      subtitle={intro}
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.overview}
      footer={
        <>
          <div className={styles.sheetFootStart}>
            <button type="button" className={cx(styles.btn, styles.btnSecondary, wasComplete && styles.footClose)} onClick={() => sheetRef.current?.close()}>
              {wasComplete ? portalContent.sheet.close : copy.later}
            </button>
          </div>
          <button type="submit" form="portal-profile-form" className={cx(styles.btn, styles.btnPrimary)}>
            <FootLabel long={intent === 'beforeSubmission' ? copy.saveAndContinue : copy.save} short={portalContent.profile.saveShort} />
          </button>
        </>
      }
    >
      <form id="portal-profile-form" ref={formRef} onSubmit={onSubmit} noValidate>
        <p className={styles.hint} style={{ marginBottom: 24 }}>
          {portalContent.submission.requiredNote}
        </p>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{copy.person}</legend>
          <div className={styles.grid2}>
            <SelectField
              label={labels.salutation}
              optional
              value={profile.salutation}
              onValueChange={(value) => set('salutation', value)}
              options={portalContent.salutations}
            />
            <div aria-hidden="true" />
            <TextField
              label={labels.firstName}
              autoComplete="given-name"
              value={profile.firstName}
              onValueChange={(value) => set('firstName', value)}
              error={errors.firstName}
              maxLength={100}
            />
            <TextField
              label={labels.lastName}
              autoComplete="family-name"
              value={profile.lastName}
              onValueChange={(value) => set('lastName', value)}
              error={errors.lastName}
              maxLength={100}
            />
            <TextField
              label={labels.email}
              type="email"
              value={account.email}
              onValueChange={() => undefined}
              readOnly
              hint={labels.emailLocked}
              hintBelow
            />
            <TextField
              label={labels.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              optional
              placeholder={portalContent.placeholders.phone}
              value={profile.phone}
              onValueChange={(value) => set('phone', value)}
              maxLength={50}
            />
          </div>
        </fieldset>

        <div className={styles.fieldset}>
          <ChoiceField<PortalGroup>
            legend={copy.group}
            legendClassName={styles.legend}
            hint={copy.groupHint}
            name="portal-group"
            value={profile.group}
            onValueChange={(value) => set('group', value)}
            options={portalContent.groups}
            error={errors.group}
          />
        </div>

        {hasOrganization && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{copy.organization[orgKey]}</legend>
            <p className={styles.notice}>
              <Info size={16} aria-hidden="true" />
              {copy.organizationHint[orgKey]}
            </p>
            <div className={styles.grid2}>
              <TextField
                className={styles.span2}
                label={labels.orgName[orgKey]}
                autoComplete="organization"
                value={profile.orgName}
                onValueChange={(value) => set('orgName', value)}
                error={errors.orgName}
                maxLength={200}
              />
              <TextField
                label={labels.orgRole}
                autoComplete="organization-title"
                optional
                placeholder={portalContent.placeholders.orgRole}
                value={profile.orgRole}
                onValueChange={(value) => set('orgRole', value)}
                maxLength={120}
              />
              <TextField
                label={labels.orgCity}
                autoComplete="address-level2"
                optional
                value={profile.orgCity}
                onValueChange={(value) => set('orgCity', value)}
                maxLength={120}
              />
              <TextField
                className={styles.span2}
                label={labels.website}
                type="url"
                inputMode="url"
                autoComplete="url"
                optional
                placeholder={portalContent.placeholders.website}
                value={profile.orgWebsite}
                onValueChange={(value) => set('orgWebsite', value)}
                maxLength={200}
              />
            </div>
          </fieldset>
        )}
        <PrivacyNote>{portalContent.privacy.profile}</PrivacyNote>
      </form>
    </Page>
  )
}
