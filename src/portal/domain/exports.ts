/**
 * Exporte der Verwaltung: Listen und Mailinglisten als CSV für Excel (Semikolon, UTF-8 mit BOM). Der Versand läuft laut
 * Konzept manuell über den Mailingserver, das Portal verschickt nichts.
 *
 * Reine Funktionen: Im Prototyp erzeugt der Browser die Datei (ui/download.ts), im echten System kann ein Route Handler
 * dieselben Funktionen nutzen und die Datei ausliefern.
 */

import { PARTY_LABEL, JURY_LABEL, PHASES, RESULT_LABEL, adminNext, applicantView, documentsProgress, juryTally, phaseOf } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { accountOf, submissionCompany, submittedSubmissions } from '@/portal/domain/selectors'
import type { PortalData, Submission } from '@/portal/domain/types'
import { prizeTitles, prizesOf } from '@/portal/domain/questionnaire'

export type ExportKind =
  | 'mail_alle'
  | 'mail_phase1'
  | 'mail_rechnung'
  | 'mail_fragebogen'
  | 'mail_eingeladen'
  | 'mail_keine'
  | 'mail_unterlagen'
  | 'mail_vorschlag'
  | 'jury'

type Column = [header: string, value: (submission: Submission) => string]

const cell = (value: string) => (/[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

export function toCsv(headers: string[], rows: string[][]) {
  return `﻿${[headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`
}

const date = (value?: string) => (value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('de-DE') : '')
const typeLabel = (submission: Submission) =>
  submission.type === 'fremdvorschlag' ? portalContent.submission.type.nomination.title : portalContent.submission.type.self.title

/** Empfänger: das Konto, das den Vorgang angelegt hat (bei Fremdnominierung die vorschlagende Person). */
function recipientColumns(state: PortalData): Column[] {
  const owner = (submission: Submission) => accountOf(state, submission.accountId)
  return [
    ['Anrede', (s) => owner(s)?.profile.salutation ?? ''],
    ['Vorname', (s) => owner(s)?.profile.firstName ?? ''],
    ['Nachname', (s) => owner(s)?.profile.lastName ?? ''],
    ['E-Mail', (s) => owner(s)?.email ?? ''],
    ['Unternehmen', (s) => submissionCompany(s)],
    ['Eingangsnummer', (s) => s.reference ?? ''],
    ['Art', (s) => typeLabel(s)],
    ['Phase', (s) => `Phase 0${phaseOf(s.process)} · ${PHASES[phaseOf(s.process) - 1].title}`],
    ['Status (Bewerbersicht)', (s) => applicantView(s.process, s.type, submissionCompany(s)).status.label],
  ]
}

/** Firmenbezogene Mailings gehen an Eigenbewerbungen (bei Fremdnominierungen hat das Unternehmen im Prototyp kein Konto). */
const selfOnly = (submission: Submission) => submission.type === 'eigenbewerbung'

export const EXPORTS: Array<{ kind: ExportKind; title: string; desc: string; filter: (submission: Submission) => boolean; extra?: Column[] }> = [
  { kind: 'mail_alle', title: 'Alle Teilnehmenden', desc: 'Alle Konten mit eingereichter Anmeldung oder Fremdnominierung.', filter: () => true },
  { kind: 'mail_phase1', title: 'Phase 01 · erst angemeldet', desc: 'Anmeldungen, die noch geprüft werden.', filter: (s) => phaseOf(s.process) === 1 },
  {
    kind: 'mail_rechnung',
    title: 'Zahlungserinnerung',
    desc: 'Eigenbewerbungen mit offener Rechnung.',
    filter: (s) => selfOnly(s) && s.process.payment === 'rechnung_offen' && s.process.questionnaire === 'gesperrt',
  },
  {
    kind: 'mail_fragebogen',
    title: 'Erinnerung Fragebogen',
    desc: 'Freigegebene, noch nicht eingereichte Fragebögen – mit Frist.',
    filter: (s) => selfOnly(s) && (s.process.questionnaire === 'verfuegbar' || s.process.questionnaire === 'in_bearbeitung'),
    extra: [['Frist', (s) => date(s.process.deadline)]],
  },
  { kind: 'mail_eingeladen', title: 'Eingeladene (Gala)', desc: 'Freigegebene Einladungen zur Gala.', filter: (s) => s.process.result === 'einladung' },
  { kind: 'mail_keine', title: 'Ohne Einladung', desc: 'Abgeschlossene Vorgänge ohne Einladung.', filter: (s) => s.process.result === 'keine_einladung' },
  {
    kind: 'mail_unterlagen',
    title: 'Fehlende Gewinnerunterlagen',
    desc: 'Angeforderte Unterlagen, die noch offen sind oder nachgebessert werden müssen.',
    filter: (s) => documentsProgress(s.process).requested && documentsProgress(s.process).open > 0,
    extra: [['Offene Unterlagen', (s) => String(documentsProgress(s.process).open)]],
  },
  { kind: 'mail_vorschlag', title: 'Vorschlagende Personen', desc: 'Konten, die ein anderes Unternehmen vorgeschlagen haben.', filter: (s) => s.type === 'fremdvorschlag' },
  {
    kind: 'jury',
    title: 'Jury-Auswertung',
    desc: 'Stimmen der Jury 1, Punkte der Jury 2 und Ergebnis je Fragebogen.',
    filter: (s) => s.process.questionnaire === 'eingereicht',
  },
]

const JURY_COLUMNS: Column[] = [
  ['Unternehmen', (s) => submissionCompany(s)],
  ['Eingangsnummer', (s) => s.reference ?? ''],
  ['Preise', (s) => prizeTitles(prizesOf(s.process.answers))],
  ['Jurystufe', (s) => JURY_LABEL[s.process.jury]],
  ['Jury 1 Ja', (s) => String(juryTally(s.process).ja)],
  ['Jury 1 Vielleicht', (s) => String(juryTally(s.process).vielleicht)],
  ['Jury 1 Nein', (s) => String(juryTally(s.process).nein)],
  ['Jury 2 Ø Punkte', (s) => (juryTally(s.process).average ?? '').toLocaleString('de-DE')],
  ['Ergebnis', (s) => RESULT_LABEL[s.process.result]],
]

const stamp = () => new Date().toISOString().slice(0, 10)

/** Eine der festen Listen als CSV. */
export function buildExport(state: PortalData, kind: ExportKind) {
  const definition = EXPORTS.find((item) => item.kind === kind)!
  const rows = submittedSubmissions(state).filter(definition.filter)
  const columns = kind === 'jury' ? JURY_COLUMNS : [...recipientColumns(state), ...(definition.extra ?? [])]
  return {
    filename: `bmp-2027_${kind.replace('mail_', 'mailing_')}_${stamp()}.csv`,
    csv: toCsv(
      columns.map(([header]) => header),
      rows.map((submission) => columns.map(([, value]) => value(submission))),
    ),
    count: rows.length,
  }
}

/** Die gerade sichtbare Liste der Verwaltung (Bereich, Filter, Suche) als CSV. */
export function buildListExport(state: PortalData, rows: Submission[], area: string) {
  const columns: Column[] = [
    ['Unternehmen', (s) => submissionCompany(s)],
    ['Eingangsnummer', (s) => s.reference ?? ''],
    ['Art', (s) => typeLabel(s)],
    ['Eingang', (s) => date(s.submittedAt)],
    ['Phase', (s) => `Phase 0${phaseOf(s.process)} · ${PHASES[phaseOf(s.process) - 1].title}`],
    ['Status (Bewerbersicht)', (s) => applicantView(s.process, s.type, submissionCompany(s)).status.label],
    ['Nächster Schritt', (s) => `${PARTY_LABEL[adminNext(s.process, s.type).party]}: ${adminNext(s.process, s.type).label}`],
    ['Preise', (s) => prizeTitles(prizesOf(s.process.answers))],
    ['Kontakt E-Mail', (s) => accountOf(state, s.accountId)?.email ?? ''],
  ]
  return {
    filename: `bmp-2027_liste-${area}_${stamp()}.csv`,
    csv: toCsv(
      columns.map(([header]) => header),
      rows.map((submission) => columns.map(([, value]) => value(submission))),
    ),
    count: rows.length,
  }
}
