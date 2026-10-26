/**
 * Ausbaustufen: Das Portal geht in Teilen live – erst die Anmeldung, dann die Bewerbung, dann Jury und Ergebnis.
 *
 *   a       Phase A    Konto, Stammdaten, Anmeldung einreichen, Prüfung durch die Verwaltung
 *   ab      + Phase B  Rechnung & Zahlung, Fragebögen der drei Preise, Bewerbungsunterlagen
 *   abc     + Phase C  Jury 1 und Jury 2, Jury-Dashboard, Ergebnis und Einladung
 *   gesamt  + danach   Gewinnerunterlagen & Medienstatus
 *
 * Runde, Exporte sowie Rechte & Benutzer gibt es in jeder Stufe – jeweils mit dem, was zur Stufe gehört.
 *
 * Eine Stelle für Oberfläche und Backend: Die Oberfläche blendet aus, was nicht zur Stufe gehört (`hasFeature`), und
 * `executeCommand` lehnt Befehle außerhalb der Stufe ab (`COMMAND_SPEC[…].feature`, Kontext `stage`). Eingestellt wird die
 * Stufe mit `NEXT_PUBLIC_PORTAL_STAGE` (a | ab | abc | gesamt, Standard gesamt) – im Prototyp zusätzlich über die
 * Demo-Steuerung. Neue Funktion einer Stufe: Eintrag in `Feature` und `FEATURE_STAGE`, dann mit `hasFeature` abfragen.
 */

import type { RoundStatus } from '@/portal/domain/types'

export type Stage = 'a' | 'ab' | 'abc' | 'gesamt'

/** Fachliche Bausteine, die eine Stufe freischaltet. */
export type Feature = 'anmeldung' | 'bewerbung' | 'jury' | 'gewinnerunterlagen'

export const STAGES: Array<{ id: Stage; label: string; short: string; includes: string }> = [
  { id: 'a', label: 'Phase A · Anmeldung', short: 'A', includes: 'Konto, Stammdaten, Anmeldung, Prüfung' },
  { id: 'ab', label: 'Phase A + B · Bewerbung', short: 'A + B', includes: '+ Rechnung, Fragebögen der Preise, Unterlagen' },
  { id: 'abc', label: 'Phase A + B + C · Jury und Ergebnis', short: 'A + B + C', includes: '+ Jury 1/2, Jury-Dashboard, Ergebnis, Einladung' },
  { id: 'gesamt', label: 'Gesamt', short: 'Gesamt', includes: '+ Gewinnerunterlagen' },
]

const ORDER: Stage[] = STAGES.map((stage) => stage.id)

/** Ab welcher Stufe ein Baustein dabei ist. */
export const FEATURE_STAGE: Record<Feature, Stage> = {
  anmeldung: 'a',
  bewerbung: 'ab',
  jury: 'abc',
  gewinnerunterlagen: 'gesamt',
}

export const DEFAULT_STAGE: Stage = 'gesamt'

export const hasFeature = (stage: Stage, feature: Feature) => ORDER.indexOf(stage) >= ORDER.indexOf(FEATURE_STAGE[feature])

/** Wert aus der Umgebung (z. B. `NEXT_PUBLIC_PORTAL_STAGE`) – Unbekanntes ergibt die Gesamtversion. */
export const parseStage = (value: string | null | undefined): Stage => (ORDER.includes(value as Stage) ? (value as Stage) : DEFAULT_STAGE)

export const stageLabel = (stage: Stage) => STAGES.find((item) => item.id === stage)!.label

/** Welcher Baustein eine Hauptphase trägt: 01 Anmeldung (A), 02 Bewerbung (B), 03 Jury und 04 Gala (C). */
export const PHASE_FEATURE: Record<1 | 2 | 3 | 4, Feature> = { 1: 'anmeldung', 2: 'bewerbung', 3: 'jury', 4: 'jury' }

/** Rundenstatus je Baustein – die Rundenverwaltung bietet nur die Status der Stufe an. */
export const ROUND_FEATURE: Record<RoundStatus, Feature> = {
  vorbereitung: 'anmeldung',
  anmeldung_offen: 'anmeldung',
  anmeldung_geschlossen: 'anmeldung',
  fragebogenphase: 'bewerbung',
  juryphase: 'jury',
  abgeschlossen: 'jury',
}
