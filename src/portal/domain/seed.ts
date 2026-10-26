/**
 * Nur Prototyp: Demo-Daten, Testzugänge und die NEWEDGE-Szenarien der Demo-Steuerung.
 *
 * Das echte Backend braucht diese Datei nicht – höchstens als Vorlage für einen Seed der Entwicklungsdatenbank.
 * Die Testzugänge stehen in der Testanleitung und auf der Login-Seite.
 */

import { APPLICATION_DOCS } from '@/portal/domain/application'
import { CONFIRM_KEY, SEED_QUESTIONNAIRES, demoAnswers, seedDefinitions, sortPrizes } from '@/portal/domain/questionnaire'
import type { Feature } from '@/portal/domain/release'
import { submissionCompany } from '@/portal/domain/selectors'
import {
  defaultRoundSettings,
  emptyNominationData,
  emptyProfile,
  emptySelfData,
  initialProcess,
  juryAccount,
  type Account,
  type JuryType,
  type AppDocKey,
  type NominationData,
  type PortalData,
  type PrizeId,
  type ProcessState,
  type SelfData,
  type Submission,
  type SubmissionType,
  type Juror,
} from '@/portal/domain/types'

/** Gemeinsames Passwort aller Testzugänge. */
export const DEMO_PASSWORD = 'demo2026'

export const NEWEDGE_REFERENCE = 'BMP-L26GTL'

const DEMO_ACCOUNT_ID = 'demo-newedge'
export const SAMPLE_ACCOUNT_ID = 'demo-beispiele'
const NOMINATOR_ACCOUNT_ID = 'demo-vorschlag'

/** Beispieldateien der sechs Unterlagen – Namen und Größen sind erfunden, im Prototyp gibt es keine Dateien. */
const DEMO_FILES: Record<AppDocKey, { fileName: string; size: number }> = {
  praesentation: { fileName: 'Unternehmenspraesentation_Demo.pptx', size: 4_820_000 },
  jahresabschluss: { fileName: 'Jahresabschluesse_2023-2025_Demo.pdf', size: 2_310_000 },
  kennzahlen: { fileName: 'Kennzahlen_Demo.xlsx', size: 86_000 },
  handelsregister: { fileName: 'Handelsregisterauszug_Demo.pdf', size: 412_000 },
  organigramm: { fileName: 'Organigramm_Demo.pdf', size: 655_000 },
  referenzen: { fileName: 'Referenzschreiben_Demo.docx', size: 128_000 },
}

/**
 * Bewerbung für Demo-Daten: gewählte Preise, ausgefüllte Fragebögen und die ersten `docs` Unterlagen. `upTo` füllt den
 * ersten Fragebogen nur bis zu diesem Abschnitt (in Bearbeitung); ohne `upTo` sind alle Fragebögen eingereicht.
 */
export function demoApplication(company: string, city: string, at: string, { prizes = ['bmp'], upTo, docs = APPLICATION_DOCS.length }: { prizes?: PrizeId[]; upTo?: number; docs?: number } = {}): Partial<ProcessState> {
  const complete = upTo === undefined
  const questionnaires = Object.fromEntries(
    sortPrizes(prizes).map((prize, index) => {
      const sections = SEED_QUESTIONNAIRES[prize]
      if (complete) return [prize, { status: 'eingereicht' as const, answers: { ...demoAnswers(sections, company, city), [CONFIRM_KEY]: 'ja' }, step: sections.length, savedAt: at, submittedAt: at }]
      // In Bearbeitung: der erste Preis teilweise ausgefüllt, die übrigen noch nicht begonnen.
      return index === 0 ? [prize, { status: 'in_bearbeitung' as const, answers: demoAnswers(sections, company, city, upTo), step: upTo, savedAt: at }] : [prize, undefined]
    }).filter(([, value]) => value),
  )
  const applicationDocs = Object.fromEntries(APPLICATION_DOCS.slice(0, docs).map((doc) => [doc.key, { ...DEMO_FILES[doc.key], uploadedAt: at }]))
  const done = complete && docs === APPLICATION_DOCS.length
  return {
    application: done ? 'eingereicht' : 'in_bearbeitung',
    prizes: sortPrizes(prizes),
    questionnaires,
    applicationDocs,
    ...(done ? { applicationCompletedAt: at } : {}),
  }
}

/** Standardbesetzung der Demo: A–C in Jury 1, D und E in Jury 2. */
export const DEMO_JURY_ASSIGNMENT = (): ProcessState['assigned'] => ({ jury1: ['a', 'b', 'c'], jury2: ['d', 'e'] })

function sampleSubmission(
  id: string,
  type: SubmissionType,
  company: string,
  city: string,
  date: string,
  reference: string,
  process: Partial<ProcessState>,
  accountId = SAMPLE_ACCOUNT_ID,
): Submission {
  const self: SelfData =
    type === 'eigenbewerbung'
      ? {
          ...emptySelfData(),
          companyName: company,
          industry: 'Beispielbranche (Demo)',
          street: 'Musterstraße 1',
          zip: '80331',
          city,
          seatInBavaria: 'ja',
          foundedYear: '2008',
          employees: '51-200',
          ownerManaged: 'ja',
          portrait: 'Beispieltext (Demo): Kurzporträt des Unternehmens aus der Anmeldung.',
        }
      : emptySelfData()
  const nomination: NominationData =
    type === 'fremdvorschlag'
      ? { ...emptyNominationData(), companyName: company, city, reason: 'Beispieltext (Demo): Begründung der Fremdnominierung.' }
      : emptyNominationData()
  return {
    id,
    accountId,
    type,
    status: 'eingereicht',
    step: 2,
    self,
    nomination,
    createdAt: date,
    updatedAt: date,
    submittedAt: date,
    reference,
    process: { ...initialProcess(), ...process },
    sample: true,
  }
}

/** Demo-Jury: A–C stimmen in Jury 1 (Ja/Vielleicht/Nein), D und E vergeben in Jury 2 Punkte. */
function demoJurors(): Juror[] {
  const juror = (id: string, letter: string, email: string, type: JuryType, accountId: string): Juror => ({
    id,
    name: `Jurymitglied ${letter}`,
    email,
    type,
    accountId,
    createdAt: '2026-10-01T08:00:00.000Z',
  })
  return [
    juror('a', 'A', 'jury1@demo.bmp', 'jury1', 'demo-jury'),
    juror('b', 'B', 'jury.b@demo.bmp', 'jury1', 'demo-jury-b'),
    juror('c', 'C', 'jury.c@demo.bmp', 'jury1', 'demo-jury-c'),
    juror('d', 'D', 'jury2@demo.bmp', 'jury2', 'demo-jury-d'),
    juror('e', 'E', 'jury.e@demo.bmp', 'jury2', 'demo-jury-e'),
  ]
}

function demoAccounts(): Account[] {
  return [
    {
      id: DEMO_ACCOUNT_ID,
      email: 'unternehmer@demo.bmp',
      passwordHash: '',
      demoPassword: DEMO_PASSWORD,
      createdAt: '2026-10-24T09:58:00.000Z',
      demo: true,
      profile: {
        ...emptyProfile(),
        firstName: 'Alex',
        lastName: 'Muster',
        group: 'unternehmer',
        orgName: 'NEWEDGE',
        orgRole: 'Geschäftsführung (Demo)',
        completedAt: '2026-10-24T10:02:00.000Z',
      },
    },
    {
      id: SAMPLE_ACCOUNT_ID,
      email: 'beispiele@bmp.example',
      passwordHash: '',
      createdAt: '2026-10-01T08:00:00.000Z',
      demo: true,
      profile: { ...emptyProfile(), firstName: 'Sammelkonto', lastName: 'Beispieldaten', group: 'unternehmer', orgName: 'Beispieldaten (Demo)' },
    },
    {
      id: NOMINATOR_ACCOUNT_ID,
      email: 'vorschlag@demo.bmp',
      passwordHash: '',
      demoPassword: DEMO_PASSWORD,
      createdAt: '2026-10-17T16:00:00.000Z',
      demo: true,
      profile: { ...emptyProfile(), firstName: 'Paula', lastName: 'Beispiel', group: 'privatperson', completedAt: '2026-10-17T16:05:00.000Z' },
    },
    {
      id: 'demo-sachbearbeitung',
      email: 'sachbearbeitung@demo.bmp',
      passwordHash: '',
      demoPassword: DEMO_PASSWORD,
      role: 'sachbearbeitung',
      createdAt: '2026-10-01T08:00:00.000Z',
      demo: true,
      profile: { ...emptyProfile(), firstName: 'Sachbearbeitung', lastName: '(Demo)', group: 'institution', orgName: 'Bayerischer Mittelstandspreis' },
    },
    {
      id: 'demo-verwaltung',
      email: 'verwaltung@demo.bmp',
      passwordHash: '',
      demoPassword: DEMO_PASSWORD,
      role: 'verwaltung',
      createdAt: '2026-10-01T08:00:00.000Z',
      demo: true,
      profile: { ...emptyProfile(), firstName: 'Geschäftsstelle', lastName: '(Demo)', group: 'institution', orgName: 'Bayerischer Mittelstandspreis' },
    },
    ...demoJurors().map((juror) => juryAccount(juror, DEMO_PASSWORD)),
  ]
}

function sampleSubmissions(includeNewedge: boolean): Submission[] {
  const list: Submission[] = [
    sampleSubmission('demo-huber', 'fremdvorschlag', 'Huber Holzbau KG', 'Rosenheim', '2026-10-18T14:20:00.000Z', 'BMP-H7Q2KD', { review: 'in_pruefung' }, NOMINATOR_ACCOUNT_ID),
    sampleSubmission('demo-lechtal', 'eigenbewerbung', 'Lechtal Logistik GmbH & Co. KG', 'Augsburg', '2026-10-09T09:05:00.000Z', 'BMP-LX4T9M', {
      review: 'geprueft',
      payment: 'rechnung_offen',
    }),
    sampleSubmission('demo-donau', 'eigenbewerbung', 'Donau Werkzeugbau AG', 'Ingolstadt', '2026-10-06T11:40:00.000Z', 'BMP-D3W8RN', {
      review: 'geprueft',
      payment: 'zahlung_eingegangen',
      deadline: '2027-02-15',
      ...demoApplication('Donau Werkzeugbau AG', 'Ingolstadt', '2026-10-20T09:00:00.000Z', { upTo: 1, docs: 2 }),
    }),
    sampleSubmission('demo-franken', 'eigenbewerbung', 'Frankenkeramik Manufaktur GmbH', 'Bamberg', '2026-10-03T16:10:00.000Z', 'BMP-F6K2PZ', {
      review: 'geprueft',
      payment: 'zahlung_eingegangen',
      jury: 'jury1',
      assigned: DEMO_JURY_ASSIGNMENT(),
      jury1: { b: 'ja', c: 'vielleicht' },
      ...demoApplication('Frankenkeramik Manufaktur GmbH', 'Bamberg', '2026-10-12T15:00:00.000Z', { prizes: ['bmp', 'roland_berger'] }),
    }),
    sampleSubmission(
      'demo-alpen',
      'eigenbewerbung',
      'Alpenländische Feinkost- und Spezialitäten-Vertriebsgesellschaft mbH & Co. KG',
      'Garmisch-Partenkirchen',
      '2026-10-01T10:30:00.000Z',
      'BMP-A9V5LC',
      {
        review: 'geprueft',
        payment: 'zahlung_eingegangen',
        jury: 'abgeschlossen',
        assigned: DEMO_JURY_ASSIGNMENT(),
        jury1: { a: 'ja', b: 'ja', c: 'ja' },
        jury2: { d: 9, e: 8 },
        result: 'einladung',
        ...demoApplication('Alpenländische Feinkost- und Spezialitäten-Vertriebsgesellschaft mbH & Co. KG', 'Garmisch-Partenkirchen', '2026-10-08T10:00:00.000Z'),
      },
    ),
  ]
  if (includeNewedge) {
    list.unshift({
      ...sampleSubmission('demo-newedge-vorgang', 'eigenbewerbung', 'NEWEDGE', 'München', '2026-10-24T10:12:00.000Z', NEWEDGE_REFERENCE, {}, DEMO_ACCOUNT_ID),
      sample: false,
    })
  }
  return list
}

const isNewedge = (submission: Submission) =>
  submission.status === 'eingereicht' && (submission.reference === NEWEDGE_REFERENCE || submissionCompany(submission).toUpperCase() === 'NEWEDGE')

/** Der NEWEDGE-Vorgang, an dem die Demo-Steuerung die Szenarien zeigt. */
export const newedgeSubmission = (data: PortalData | null) => data?.submissions.find(isNewedge) ?? null

/** Ergänzt fehlende Beispieldaten, ohne vorhandene Konten oder Vorgänge anzutasten. */
export function withSeed<T extends PortalData>(state: T): T {
  const hasNewedge = state.submissions.some(isNewedge)
  const knownIds = new Set(state.submissions.map((submission) => submission.id))
  const knownAccounts = new Set(state.accounts.map((account) => account.id))
  // Testzugänge immer mit aktuellen Zugangsdaten (auch bei Daten aus früheren Prototyp-Ständen).
  const demoById = new Map(demoAccounts().map((account) => [account.id, account]))
  const accounts = [
    ...state.accounts.map((account) => {
      const seed = demoById.get(account.id)
      // Bereits geänderte Jury-Zugänge (neues Passwort aus der Verwaltung) bleiben erhalten.
      if (!seed) return account
      return account.role === 'jury' && account.jurorId
        ? account
        : { ...account, email: seed.email, demoPassword: seed.demoPassword, role: seed.role, jurorId: seed.jurorId }
    }),
    ...demoAccounts().filter((account) => !knownAccounts.has(account.id)),
  ]
  const additions = sampleSubmissions(!hasNewedge).filter((submission) => !knownIds.has(submission.id))
  // Die Beispiel-Fremdnominierung gehört dem Testzugang „vorschlag@demo.bmp“.
  const submissions = [...state.submissions, ...additions].map((submission) => {
    const owned = submission.id === 'demo-huber' && submission.accountId === SAMPLE_ACCOUNT_ID ? { ...submission, accountId: NOMINATOR_ACCOUNT_ID } : submission
    // Daten aus früheren Ständen ohne Jury-Zuweisung: laufende Juryfälle bekommen die Standardbesetzung.
    if (owned.process.assigned) return owned
    const assigned = owned.process.jury === 'nicht_zugewiesen' ? { jury1: [], jury2: [] } : DEMO_JURY_ASSIGNMENT()
    return { ...owned, process: { ...owned.process, assigned } }
  })
  const knownJurors = new Set((state.jurors ?? []).map((juror) => juror.id))
  const jurors = [...(state.jurors ?? []), ...demoJurors().filter((juror) => !knownJurors.has(juror.id))]
  // Fragebögen der Preise: fehlende aus der Ausgangsfassung ergänzen, geänderte der Verwaltung behalten.
  const knownPrizes = new Set((state.questionnaires ?? []).map((definition) => definition.prize))
  const questionnaires = [...(state.questionnaires ?? []), ...seedDefinitions(SEED_AT).filter((definition) => !knownPrizes.has(definition.prize))]
  return { ...state, accounts, submissions, jurors, questionnaires, roundSettings: state.roundSettings ?? defaultRoundSettings() }
}

const SEED_AT = '2026-10-01T08:00:00.000Z'

/** Frischer Demo-Bestand. */
export const seedData = (): PortalData =>
  withSeed({ accounts: [], submissions: [], jurors: [], questionnaires: [], round: 'anmeldung_offen', roundSettings: defaultRoundSettings() })

/** Übrige Jurybewertungen der laufenden Stufe ergänzen (Demo: „Übrige Stimmen simulieren“). */
export function simulateRemainingVotes(process: ProcessState): Pick<ProcessState, 'jury1' | 'jury2'> {
  const assigned = process.assigned
  return {
    jury1: {
      ...process.jury1,
      ...Object.fromEntries(assigned.jury1.filter((juror) => !process.jury1[juror]).map((juror, index) => [juror, index % 3 === 2 ? 'vielleicht' : 'ja'])),
    },
    jury2:
      process.jury === 'jury2' || process.jury === 'abgeschlossen'
        ? { ...process.jury2, ...Object.fromEntries(assigned.jury2.filter((juror) => process.jury2[juror] === undefined).map((juror) => [juror, 8])) }
        : process.jury2,
  }
}

/* ── Demo-Szenarien (NEWEDGE) ────────────────────────────────────────────── */

export type ScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** Szenarien je Baustein – die Demo-Steuerung zeigt nur die der gewählten Ausbaustufe. */
export const SCENARIOS: Array<{ id: ScenarioId; title: string; hint: string; feature: Feature }> = [
  { id: 1, title: 'Neue Anmeldung', hint: 'Phase 01 · Neu eingegangen', feature: 'anmeldung' },
  { id: 2, title: 'Anmeldung in Prüfung', hint: 'Phase 01 · In Prüfung', feature: 'anmeldung' },
  { id: 3, title: 'Bewerbung freigeschaltet', hint: 'Phase 02 · Preise, Fragebögen, Unterlagen offen', feature: 'bewerbung' },
  { id: 4, title: 'Bewerbung in Bearbeitung', hint: 'Phase 02 · Fragebogen begonnen, 3 von 6 Unterlagen', feature: 'bewerbung' },
  { id: 5, title: 'Bewerbung eingereicht', hint: 'Phase 02 · Fragebogen und alle Unterlagen', feature: 'bewerbung' },
  { id: 6, title: 'Juryprüfung', hint: 'Phase 03 · In Juryprüfung', feature: 'jury' },
  { id: 7, title: 'Gala-Einladung', hint: 'Phase 04 · Einladung liegt vor', feature: 'jury' },
  { id: 8, title: 'Keine Einladung', hint: 'Phase 04 · Verfahren abgeschlossen', feature: 'jury' },
]

/** Setzt einen Vorgang in den Zustand eines Demo-Szenarios (nur Frontend). */
export function processForScenario(id: ScenarioId, base: ProcessState, at: string): ProcessState {
  const reset: ProcessState = { ...initialProcess(), log: base.log }
  const log = (text: string) => [...base.log, { at, text: `Demo-Szenario ${id}: ${text}` }]
  switch (id) {
    case 1:
      return { ...reset, log: log('Neue Anmeldung') }
    case 2:
      return { ...reset, review: 'in_pruefung', log: log('Anmeldung in Prüfung') }
    case 3:
      return { ...reset, review: 'geprueft', payment: 'zahlung_eingegangen', application: 'verfuegbar', deadline: '2027-02-15', log: log('Bewerbung freigeschaltet') }
    case 4:
      return {
        ...reset,
        review: 'geprueft',
        payment: 'zahlung_eingegangen',
        deadline: '2027-02-15',
        ...demoApplication('NEWEDGE', 'München', at, { upTo: 3, docs: 3 }),
        log: log('Bewerbung in Bearbeitung'),
      }
    case 5:
      return {
        ...reset,
        review: 'geprueft',
        payment: 'zahlung_eingegangen',
        deadline: '2027-02-15',
        ...demoApplication('NEWEDGE', 'München', at),
        log: log('Bewerbung eingereicht'),
      }
    case 6:
      return {
        ...processForScenario(5, base, at),
        jury: 'jury1',
        assigned: DEMO_JURY_ASSIGNMENT(),
        jury1: { b: 'ja', c: 'vielleicht' },
        log: log('Juryprüfung läuft'),
      }
    case 7:
      return {
        ...processForScenario(5, base, at),
        jury: 'abgeschlossen',
        assigned: DEMO_JURY_ASSIGNMENT(),
        jury1: { a: 'ja', b: 'ja', c: 'vielleicht' },
        jury2: { d: 9, e: 8 },
        result: 'einladung',
        log: log('Gala-Einladung freigegeben'),
      }
    case 8:
      return {
        ...processForScenario(5, base, at),
        jury: 'abgeschlossen',
        assigned: DEMO_JURY_ASSIGNMENT(),
        jury1: { a: 'vielleicht', b: 'nein', c: 'ja' },
        jury2: { d: 5, e: 4 },
        result: 'keine_einladung',
        log: log('Abschluss ohne Einladung'),
      }
  }
}

/** Welches Szenario genau dem Zustand entspricht – Zwischenzustände (z. B. Rückfrage, Rechnung offen) markieren keines. */
export function scenarioOf(process: ProcessState): ScenarioId | null {
  if (process.result === 'keine_einladung') return 8
  if (process.result === 'einladung') return 7
  if (process.jury === 'jury1') return 6
  if (process.jury !== 'nicht_zugewiesen') return null
  if (process.application === 'eingereicht') return 5
  if (process.application === 'in_bearbeitung') return 4
  if (process.application === 'verfuegbar') return 3
  if (process.review === 'in_pruefung') return 2
  if (process.review === 'neu') return 1
  return null
}
