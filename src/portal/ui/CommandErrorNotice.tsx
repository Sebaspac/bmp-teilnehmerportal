'use client'

import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

import { portalContent } from '@/portal/content/portalContent'
import { reportCommandError, useCommandError } from '@/portal/data/portalClient'
import styles from '@/portal/ui/portal.module.css'

/**
 * Zeigt, warum eine Aktion nicht ausgeführt wurde – fehlendes Recht, nicht erfüllte Voraussetzung oder (später) eine
 * gestörte Verbindung. Im Prototyp selten sichtbar, weil die Oberfläche solche Aktionen schon sperrt.
 */
export function CommandErrorNotice() {
  const error = useCommandError()
  if (!error) return null
  const copy = portalContent.commandError
  return (
    <div className={styles.commandError} role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <p className={styles.commandErrorText}>
        <strong>{copy.title}</strong>
        <span>{error.message}</span>
      </p>
      <button type="button" className={styles.commandErrorClose} onClick={() => reportCommandError(null)} aria-label={copy.close}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
