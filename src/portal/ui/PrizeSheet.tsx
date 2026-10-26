'use client'

import React, { useRef, useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'

import { FootLabel, MultiChoiceField, cx } from '@/portal/ui/fields'
import { applicationOpen } from '@/portal/domain/application'
import { PRIZES, prizeById, sortPrizes } from '@/portal/domain/questionnaire'
import { portalContent } from '@/portal/content/portalContent'
import { currentSnapshot, runCommand, useProcessContext } from '@/portal/data/portalClient'
import { submissionCompany } from '@/portal/domain/selectors'
import type { PrizeId, Submission } from '@/portal/domain/types'
import { Page, type PageHandle } from '@/portal/ui/Page'
import styles from '@/portal/ui/portal.module.css'

/**
 * Preiswahl der Bewerbung: einer oder mehrere Preise, je Preis ein eigener Fragebogen. Danach geht es direkt in den
 * ersten offenen Fragebogen – oder zurück zum Vorgang, wenn keiner auszufüllen ist.
 */
export function PrizeSheet({
  submission,
  demoHandover,
  onClose,
  onContinue,
}: {
  submission: Submission
  demoHandover: boolean
  onClose: () => void
  /** Nach dem Speichern: in den Fragebogen dieses Preises (oder `null` = zurück zum Vorgang). */
  onContinue: (prize: PrizeId | null) => void
}) {
  const copy = portalContent.questionnaire.prize
  const sheetRef = useRef<PageHandle>(null)
  const ctx = useProcessContext()
  const p = submission.process
  const [draft, setDraft] = useState<PrizeId[]>(p.prizes)
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const submitted = p.prizes.filter((prize) => p.questionnaires[prize]?.status === 'eingereicht')

  const save = async () => {
    if (saving) return
    if (!draft.length) return setError(copy.error)
    const removed = submitted.find((prize) => !draft.includes(prize))
    if (removed) return setError(copy.lockedError(prizeById(removed).title))
    setSaving(true)
    const ok = await runCommand({ type: 'application.setPrizes', submissionId: submission.id, prizes: sortPrizes(draft) })
    setSaving(false)
    if (!ok) return
    // Erster gewählter Preis mit freigeschaltetem, noch nicht eingereichtem Fragebogen.
    const latest = currentSnapshot()?.submissions.find((item) => item.id === submission.id)?.process ?? p
    onContinue(latest.prizes.find((prize) => ctx.released.includes(prize) && latest.questionnaires[prize]?.status !== 'eingereicht') ?? null)
  }

  return (
    <Page
      ref={sheetRef}
      title={copy.title}
      subtitle={submissionCompany(submission)}
      onClose={onClose}
      backLabel={portalContent.sheet.backTo.vorgang}
      footer={
        applicationOpen(p) ? (
          <>
            <button type="button" className={cx(styles.btn, styles.btnSecondary, styles.footClose)} onClick={() => sheetRef.current?.close()}>
              {portalContent.sheet.close}
            </button>
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={save} disabled={saving} aria-busy={saving}>
              <FootLabel long={copy.save} short={copy.saveShort} />
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </>
        ) : undefined
      }
    >
      <section aria-labelledby="preise-heading">
        {demoHandover && (
          <p className={styles.noticeWarn} style={{ marginBottom: 16 }}>
            <Info size={16} aria-hidden="true" />
            {portalContent.vorgang.application.handoverDemo}
          </p>
        )}
        <h2 className={styles.stepHeading} id="preise-heading">
          {copy.heading}
        </h2>
        <p className={styles.stepIntro}>{copy.intro}</p>
        <MultiChoiceField<PrizeId>
          id="preise-auswahl"
          legend={copy.legend}
          legendClassName={styles.srOnly}
          name={`preise-${submission.id}`}
          value={draft}
          onValueChange={(value) => {
            setDraft(value)
            setError(undefined)
          }}
          options={PRIZES.map((prize) => ({
            value: prize.id,
            label: prize.title,
            desc: prize.desc,
            tag: submitted.includes(prize.id) ? copy.submitted : ctx.released.includes(prize.id) ? undefined : copy.pending,
          }))}
          error={error}
        />
      </section>
    </Page>
  )
}
