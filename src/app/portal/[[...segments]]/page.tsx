import type { Metadata } from 'next'
import React, { Suspense } from 'react'

import PortalApp from '@/portal/ui/PortalApp'
import { portalContent } from '@/portal/content/portalContent'

// Teilnehmerportal – klickbarer Prototyp (Daten im Browser, siehe README.md und src/portal/data/mockBackend.ts).
// Eigene Route ohne Kopf-/Fußbereich der Website, nicht in Suchmaschinen.
export const metadata: Metadata = {
  title: `${portalContent.meta.title} – Bayerischer Mittelstandspreis`,
  description: portalContent.meta.description,
  robots: { index: false, follow: false },
}

export default function PortalPage() {
  return (
    <Suspense fallback={null}>
      <PortalApp />
    </Suspense>
  )
}
