'use client'

import React from 'react'

import { PageHeader } from '@/portal/ui/AppShell'
import { cx } from '@/portal/ui/fields'
import { phasesIn } from '@/portal/domain/process'
import { hasFeature } from '@/portal/domain/release'
import { portalContent } from '@/portal/content/portalContent'
import { useStage } from '@/portal/data/portalClient'
import styles from '@/portal/ui/portal.module.css'

/** Hilfe: Orientierung über die Phasen der Ausbaustufe, häufige Fragen, Kontakt. */
export function HelpView() {
  const copy = portalContent.help
  const stage = useStage()
  return (
    <div className={styles.view}>
      <PageHeader title={copy.title} lead={copy.lead} />

      <div className={styles.helpMain}>
        <section aria-labelledby="help-phases">
          <h2 className={styles.sectionTitle} id="help-phases" style={{ marginBottom: 16 }}>
            {copy.phasesHeading}
          </h2>
          <ol className={styles.helpPhases}>
            {phasesIn(stage).map((phase) => (
              <li key={phase.number} className={styles.helpPhase}>
                <span className={styles.helpPhaseNum} aria-hidden="true">
                  {String(phase.number).padStart(2, '0')}
                </span>
                <div>
                  <h3 className={styles.helpPhaseTitle}>
                    <span className={styles.srOnly}>Phase {phase.number}: </span>
                    {phase.title}
                  </h3>
                  <dl className={styles.helpPhaseFacts}>
                    <div>
                      <dt>{copy.happensLabel}</dt>
                      <dd>{copy.phases[phase.number - 1].happens}</dd>
                    </div>
                    <div>
                      <dt>{copy.youLabel}</dt>
                      <dd>{copy.phases[phase.number - 1].you}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="help-faq" style={{ marginTop: 48 }}>
          <h2 className={styles.sectionTitle} id="help-faq" style={{ marginBottom: 16 }}>
            {copy.faqHeading}
          </h2>
          <div className={styles.faqList}>
            {copy.faq.filter((item) => hasFeature(stage, item.feature)).map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>{item.q}</summary>
                <p className={styles.faqAnswer}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="help-contact" className={styles.panel} style={{ marginTop: 48 }}>
          <h2 className={styles.panelTitle} id="help-contact">
            {copy.contactHeading}
          </h2>
          <p className={styles.contact} style={{ marginTop: 8 }}>
            {copy.contactText} <a href={`mailto:${portalContent.overview.contact.email}`}>{portalContent.overview.contact.email}</a>
          </p>
        </section>
      </div>
    </div>
  )
}
