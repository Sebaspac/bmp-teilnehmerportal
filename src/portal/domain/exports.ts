/**
 * Exporte der Verwaltung: Listen und Mailinglisten als CSV für Excel (Semikolon, UTF-8 mit BOM). Der Versand läuft laut
 * Konzept manuell über den Mailingserver, das Portal verschickt nichts.
 *
 * Reine Funktionen: Im Prototyp erzeugt der Browser die Datei (ui/download.ts), im echten System kann ein Route Handler
 * dieselben Funktionen nutzen und die Datei ausliefern.
 */

import { APPLICATION_DOCS, applicationOpen, applicationProgress } from '@/portal/domain/application'
import { PARTY_LABEL, JURY_LABEL, PHASES, RESULT_LABEL, adminNext, applicantView, documentsProgress, juryTally, phaseOf, type ProcessContext } from '@/portal/domain/process'
import { portalContent } from '@/portal/content/portalContent'
import { accountOf, submissionCompany, submittedSubmissions } from '@/portal/domain/selectors'
import type { PortalData, Submission } from '@/portal/domain/types'
import { prizeById, prizeTitles, releasedPrizes } from '@/portal/domain/questionnaire'
import type { Feature } from '@/portal/domain/release'

export type ExportKind =
  | 'mail_alle'
  | 'mail_phase1'
  | 'mail_rechnung'
  | 'mail_bewerbung'
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
function recipientColumns(state: PortalData, ctx: ProcessContext): Column[] {
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
    ['Status (Bewerbersicht)', (s) => applicantView(s.process, s.type, submissionCompany(s), ctx).status.label],
  ]
}

/** Firmenbezogene Mailings gehen an Eigenbewerbungen (bei Fremdnominierungen hat das Unternehmen im Prototyp kein Konto). */
const selfOnly = (submission: Submission) => submission.type === 'eigenbewerbung'

/** Offene Teile einer Bewerbung als Text, z. B. „Fragebogen Roland Berger; 2 Unterlagen“. */
function missingParts(state: PortalData, submission: Submission) {
  const progress = applicationProgress(submission.process, releasedPrizes(state))
  const missingDocs = progress.docs.total - progress.docs.uploaded
  return [
    ...(progress.chosen === 0 ? ['Preiswahl'] : []),
    ...[...progress.open, ...progress.waiting].map((prize) => `Fragebogen ${prizeById(prize).short}`),
    ...(missingDocs ? [`${missingDocs} ${missingDocs === 1 ? 'Unterlage' : 'Unterlagen'}`] : []),
  ].join('; ')
}

/** Feste Exporte; `feature` ordnet sie einer Ausbaustufe zu (`domain/release.ts`). */
export const EXPORTS: Array<{
  kind: ExportKind
  title: string
  desc: string
  feature: Feature
  filter: (submission: Submission) => boolean
  extra?: (state: PortalData) => Column[]
}> = [
  { kind: 'mail_alle', title: 'Alle Teilnehmenden', desc: 'Alle Konten mit eingereichter Anmeldung oder Fremdnominierung.', feature: 'anmeldung', filter: () => true },
  { kind: 'mail_phase1', title: 'Phase 01 · erst angemeldet', desc: 'Anmeldungen, die noch geprüft werden.', feature: 'anmeldung', filter: (s) => phaseOf(s.process) === 1 },
  { kind: 'mail_vorschlag', title: 'Vorschlagende Personen', desc: 'Konten, die ein anderes Unternehmen vorgeschlagen haben.', feature: 'anmeldung', filter: (s) => s.type === 'fremdvorschlag' },
  {
    kind: 'mail_rechnung',
    title: 'Zahlungserinnerung',
    desc: 'Eigenbewerbungen mit offener Rechnung.',
    feature: 'bewerbung',
    filter: (s) => selfOnly(s) && s.process.payment === 'rechnung_offen' && s.process.application === 'gesperrt',
  },
  {
    kind: 'mail_bewerbung',
    title: 'Erinnerung Bewerbung',
    desc: 'Freigegebene, noch nicht vollständige Bewerbungen – mit Frist und offenen Teilen (Fragebögen, Unterlagen).',
    feature: 'bewerbung',
    filter: (s) => selfOnly(s) && applicationOpen(s.process),
    extra: (state) => [
      ['Frist', (s) => date(s.process.deadline)],
      ['Noch offen', (s) => missingParts(state, s)],
    ],
  },
  { kind: 'mail_eingeladen', title: 'Eingeladene (Gala)', desc: 'Freigegebene Einladungen zur Gala.', feature: 'jury', filter: (s) => s.process.result === 'einladung' },
  { kind: 'mail_keine', title: 'Ohne Einladung', desc: 'Abgeschlossene Vorgänge ohne Einladung.', feature: 'jury', filter: (s) => s.process.result === 'keine_einladung' },
  {
    kind: 'jury',
    title: 'Jury-Auswertung',
    desc: 'Stimmen der Jury 1, Punkte der Jury 2 und Ergebnis je Bewerbung.',
    feature: 'jury',
    filter: (s) => s.process.application === 'eingereicht',
  },
  {
    kind: 'mail_unterlagen',
    title: 'Fehlende Gewinnerunterlagen',
    desc: 'Angeforderte Unterlagen, die noch offen sind oder nachgebessert werden müssen.',
    feature: 'gewinnerunterlagen',
    filter: (s) => documentsProgress(s.process).requested && documentsProgress(s.process).open > 0,
    extra: () => [['Offene Unterlagen', (s) => String(documentsProgress(s.process).open)]],
  },
]

const JURY_COLUMNS: Column[] = [
  ['Unternehmen', (s) => submissionCompany(s)],
  ['Eingangsnummer', (s) => s.reference ?? ''],
  ['Preise', (s) => prizeTitles(s.process.prizes)],
  ['Unterlagen', (s) => `${APPLICATION_DOCS.filter((doc) => s.process.applicationDocs[doc.key]).length} von ${APPLICATION_DOCS.length}`],
  ['Jurystufe', (s) => JURY_LABEL[s.process.jury]],
  ['Jury 1 Ja', (s) => String(juryTally(s.process).ja)],
  ['Jury 1 Vielleicht', (s) => String(juryTally(s.process).vielleicht)],
  ['Jury 1 Nein', (s) => String(juryTally(s.process).nein)],
  ['Jury 2 Ø Punkte', (s) => (juryTally(s.process).average ?? '').toLocaleString('de-DE')],
  ['Ergebnis', (s) => RESULT_LABEL[s.process.result]],
]

const stamp = () => new Date().toISOString().slice(0, 10)

/** Eine der festen Listen als CSV. `ctx`: Ausbaustufe und freigeschaltete Fragebögen (für den Status in Bewerbersicht). */
export function buildExport(state: PortalData, kind: ExportKind, ctx: ProcessContext = {}) {
  const definition = EXPORTS.find((item) => item.kind === kind)!
  const rows = submittedSubmissions(state).filter(definition.filter)
  const columns = kind === 'jury' ? JURY_COLUMNS : [...recipientColumns(state, ctx), ...(definition.extra?.(state) ?? [])]
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
export function buildListExport(state: PortalData, rows: Submission[], area: string, ctx: ProcessContext = {}) {
  const columns: Column[] = [
    ['Unternehmen', (s) => submissionCompany(s)],
    ['Eingangsnummer', (s) => s.reference ?? ''],
    ['Art', (s) => typeLabel(s)],
    ['Eingang', (s) => date(s.submittedAt)],
    ['Phase', (s) => `Phase 0${phaseOf(s.process)} · ${PHASES[phaseOf(s.process) - 1].title}`],
    ['Status (Bewerbersicht)', (s) => applicantView(s.process, s.type, submissionCompany(s), ctx).status.label],
    ['Nächster Schritt', (s) => `${PARTY_LABEL[adminNext(s.process, s.type, ctx).party]}: ${adminNext(s.process, s.type, ctx).label}`],
    ['Preise', (s) => prizeTitles(s.process.prizes)],
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
