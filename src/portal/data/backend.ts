/**
 * Vertrag zwischen Oberfläche und Datenhaltung.
 *
 * Die Oberfläche kennt nur dieses Interface. Heute steckt dahinter der Prototyp (`mockBackend.ts`, localStorage),
 * später das echte Backend (`httpBackend.ts` als Vorlage). Welche Implementierung läuft, entscheidet allein
 * `data/portalClient.ts` – an den Komponenten ändert sich beim Wechsel nichts.
 *
 * Lesen: ein Snapshot (`PortalSnapshot`) mit allem, was die angemeldete Person sehen darf.
 * Schreiben: benannte Befehle (`PortalCommand`), deren Regeln in `domain/commands.ts` stehen.
 */

import type { CommandError, CommandResult, PortalCommand } from '@/portal/domain/commands'
import type { ScenarioId } from '@/portal/domain/seed'
import type { PortalSnapshot } from '@/portal/domain/types'

export type LoginResult = 'ok' | 'invalid' | 'inactive'
export type RegisterResult = { ok: true } | { ok: false; reason: 'taken' }

export type CommandResponse<C extends PortalCommand> = { ok: true; result: CommandResult<C> } | { ok: false; error: CommandError }

export interface PortalBackend {
  /**
   * Letzter bekannter Stand, synchron (für React). `null`, solange noch nichts geladen ist – die Oberfläche zeigt dann
   * den Ladezustand. Das echte Backend liefert ihn bereits nach Rolle gefiltert (`domain/visibility.ts`).
   */
  getSnapshot(): PortalSnapshot | null
  /** Meldet jede Änderung des Stands: eigene Befehle, andere Tabs, später Server-Push oder Polling. */
  subscribe(listener: () => void): () => void
  register(email: string, password: string): Promise<RegisterResult>
  login(email: string, password: string): Promise<LoginResult>
  logout(): Promise<void>
  /** Führt einen Befehl aus. Nach `ok: true` ist der Snapshot bereits aktualisiert. */
  execute<C extends PortalCommand>(command: C): Promise<CommandResponse<C>>
}

/**
 * Nur Prototyp: Funktionen der Demo-Steuerung (Perspektivwechsel ohne Passwort, Szenarien, Zurücksetzen). Das echte
 * Backend implementiert sie nicht; ohne sie blendet die Oberfläche die Demo-Steuerung aus.
 */
export interface DemoControls {
  /** Als beliebiges Konto weiterarbeiten, z. B. „Bewerberansicht öffnen“ in der Verwaltung. */
  loginAs(accountId: string): void
  /** Den NEWEDGE-Vorgang in einen der Demo-Zustände setzen. */
  applyScenario(submissionId: string, scenario: ScenarioId): void
  /** Fehlende Jurybewertungen der laufenden Stufe ergänzen. */
  simulateVotes(submissionId: string): void
  /** Alle Demo-Daten auf den Ausgangsstand setzen. */
  reset(): void
}
