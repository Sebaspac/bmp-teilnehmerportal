'use client'

/**
 * Anbindung der Oberfläche an die Datenhaltung – die einzige Stelle, die entscheidet, welches Backend läuft.
 *
 * Komponenten lesen mit `usePortalSnapshot()` und schreiben mit `runCommand()` bzw. `sendCommand()`. Sie importieren
 * nie den Mock oder `fetch` direkt. Für das echte Backend `NEXT_PUBLIC_PORTAL_BACKEND=http` setzen; dann entfällt
 * auch die Demo-Steuerung.
 */

import { useSyncExternalStore } from 'react'

import type { CommandError, PortalCommand } from '@/portal/domain/commands'
import type { ProcessContext } from '@/portal/domain/process'
import { releasedPrizes } from '@/portal/domain/questionnaire'
import { parseStage, type Stage } from '@/portal/domain/release'
import type { PortalSnapshot } from '@/portal/domain/types'
import type { DemoControls, PortalBackend } from '@/portal/data/backend'
import { createHttpBackend } from '@/portal/data/httpBackend'
import { createMockBackend } from '@/portal/data/mockBackend'

/** Ausbaustufe des Deployments: `NEXT_PUBLIC_PORTAL_STAGE` = a | ab | abc | gesamt (Standard gesamt), siehe domain/release.ts. */
export const configuredStage: Stage = parseStage(process.env.NEXT_PUBLIC_PORTAL_STAGE)

const mock = process.env.NEXT_PUBLIC_PORTAL_BACKEND === 'http' ? null : createMockBackend(configuredStage)

export const portalBackend: PortalBackend = mock ?? createHttpBackend()

/** Nur im Prototyp vorhanden; sonst `null` – dann gibt es keine Demo-Steuerung. */
export const portalDemo: DemoControls | null = mock?.demo ?? null

/** Aktueller Stand für die Oberfläche. `null` beim Server-Rendering und solange noch nichts geladen ist. */
export function usePortalSnapshot(): PortalSnapshot | null {
  return useSyncExternalStore(portalBackend.subscribe, portalBackend.getSnapshot, () => null)
}

const noSubscription = () => () => {}

/** Gültige Ausbaustufe: die Einstellung – im Prototyp ggf. von der Demo-Steuerung überschrieben. */
export function useStage(): Stage {
  return useSyncExternalStore(portalDemo?.subscribeStage ?? noSubscription, () => portalDemo?.stage() ?? configuredStage, () => configuredStage)
}

/**
 * Rahmen für Status und nächste Schritte (`applicantView`, `adminNext`): Ausbaustufe und freigeschaltete Fragebögen.
 * Jede Ansicht nutzt denselben Rahmen, damit Bewerber, Verwaltung und Exporte dasselbe zeigen.
 */
export function useProcessContext(): Required<ProcessContext> {
  const stage = useStage()
  const snapshot = usePortalSnapshot()
  return { stage, released: releasedPrizes(snapshot) }
}

export const login = (email: string, password: string) => portalBackend.login(email, password)
export const register = (email: string, password: string) => portalBackend.register(email, password)
export const logout = () => portalBackend.logout()

/* ── Fehler aus Befehlen ─────────────────────────────────────────────────── */

let lastError: CommandError | null = null
const errorListeners = new Set<() => void>()

/** Fehler als Hinweis oben im Portal zeigen (`null` blendet ihn aus). */
export function reportCommandError(error: CommandError | null) {
  lastError = error
  errorListeners.forEach((listener) => listener())
}

const subscribeErrors = (listener: () => void) => {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

export const useCommandError = () => useSyncExternalStore(subscribeErrors, () => lastError, () => null)

/**
 * Befehl ausführen und Ergebnis bzw. Fehler selbst behandeln – für Befehle mit Rückgabewert (`draft.submit`,
 * `juror.create`, `staff.create`) oder um einen Fehler direkt am Feld zu zeigen („E-Mail bereits vergeben“).
 */
export async function sendCommand<C extends PortalCommand>(command: C) {
  const response = await portalBackend.execute(command)
  if (response.ok && lastError) reportCommandError(null)
  return response
}

/** Befehl ausführen; ein Fehler erscheint als Hinweis oben im Portal. `true` = ausgeführt. */
export async function runCommand(command: PortalCommand): Promise<boolean> {
  const response = await sendCommand(command)
  if (!response.ok) reportCommandError(response.error)
  return response.ok
}

/** Stand außerhalb von React lesen, z. B. direkt nach einem Befehl in einem Timeout. */
export const currentSnapshot = () => portalBackend.getSnapshot()

/** Neue ID im Client (UUID) – für Entwürfe, deren ID ab dem Öffnen in der URL steht (Idempotenzschlüssel). */
export const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
