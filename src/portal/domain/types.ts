/**
 * Datenmodell des Teilnehmerportals – alle Entitäten und Statuswerte an einem Ort.
 *
 * Reines TypeScript ohne React und ohne Browser-APIs: Dieselben Typen gelten im Prototyp (Mock im Browser) und im
 * echten Backend (z. B. Payload-Collections und Route Handler im selben Next.js-Projekt). Statuswerte sind bewusst
 * deutsche Schlüssel; sie stehen so auch in Exporten und im Verlauf.
 *
 * Übersicht und Beziehungen: docs/teilnehmerportal-backend.md, Abschnitt „Datenmodell“.
 */

/* ── Konten ──────────────────────────────────────────────────────────────── */

/** Nutzergruppe aus den Stammdaten. */
export type PortalGroup = 'unternehmer' | 'institution' | 'privatperson'

export type Profile = {
  salutation: string
  firstName: string
  lastName: string
  phone: string
  group: PortalGroup | ''
  orgName: string
  orgRole: string
  orgCity: string
  orgWebsite: string
  /** Gesetzt, sobald die Pflichtangaben vollständig sind (siehe `isProfileComplete`). */
  completedAt?: string
}

/** Interne Rollen der Geschäftsstelle. Bewerber haben keine Rolle. */
export type StaffRole = 'verwaltung' | 'sachbearbeitung'

export type Account = {
  id: string
  /** Immer klein geschrieben und ohne Leerzeichen (`normalizeEmail`). Eindeutig über alle Konten. */
  email: string
  createdAt: string
  profile: Profile
  /** Ohne Rolle: Bewerber bzw. vorschlagende Person. Mit Rolle: Verwaltung, Sachbearbeitung oder Jury. */
  role?: StaffRole | 'jury'
  /** `false` = deaktiviert, Anmeldung wird abgelehnt. Fehlt das Feld, ist der Zugang aktiv. */
  active?: boolean
  /** Nur bei Jury-Konten: das zugehörige Jurymitglied. */
  jurorId?: string
  /** Nur Prototyp: Hash des selbst gewählten Passworts. Im echten System verwaltet die Authentifizierung die Zugangsdaten. */
  passwordHash: string
  /** Nur Prototyp: Testzugang mit festem bzw. erzeugtem Passwort im Klartext. Im echten System: Einladungslink statt Passwort. */
  demoPassword?: string
  /** Nur Prototyp: Beispielkonto der Demo. */
  demo?: boolean
}

/* ── Jury ────────────────────────────────────────────────────────────────── */

/** Jury 1 gibt eine Ersteinschätzung (Ja/Vielleicht/Nein), Jury 2 vergibt Punkte. Ein Mitglied gehört zu genau einer Art. */
export type JuryType = 'jury1' | 'jury2'
export type JuryVote = 'ja' | 'vielleicht' | 'nein'

/** Jurymitglied mit fester Jury-Art und eigenem Konto (Zugang wird in der Verwaltung angelegt). */
export type Juror = {
  id: string
  name: string
  email: string
  type: JuryType
  /** Konto, mit dem sich das Mitglied anmeldet (`Account.role === 'jury'`). */
  accountId: string
  createdAt: string
}

/* ── Wettbewerbsrunde ────────────────────────────────────────────────────── */

export type RoundStatus = 'vorbereitung' | 'anmeldung_offen' | 'anmeldung_geschlossen' | 'fragebogenphase' | 'juryphase' | 'abgeschlossen'

export type RoundSettings = {
  /** Anmeldeschluss (YYYY-MM-DD), wird Bewerbern angezeigt. */
  registrationDeadline: string
  /** Standardfrist für die Bewerbung (YYYY-MM-DD), Vorschlag beim Freigeben. */
  questionnaireDeadline: string
}

/* ── Anmeldung (Vorgang) ─────────────────────────────────────────────────── */

export type SubmissionType = 'eigenbewerbung' | 'fremdvorschlag'
export type YesNo = '' | 'ja' | 'nein'

/** Angaben einer Eigenbewerbung (Anmeldeformular). Pflichtfelder: `domain/registration.ts`. */
export type SelfData = {
  companyName: string
  legalForm: string
  industry: string
  website: string
  street: string
  zip: string
  city: string
  seatInBavaria: YesNo
  foundedYear: string
  employees: string
  ownerManaged: YesNo
  portrait: string
}

/** Angaben einer Fremdnominierung (eine Person schlägt ein anderes Unternehmen vor). */
export type NominationData = {
  companyName: string
  city: string
  website: string
  industry: string
  reason: string
  relationship: string
}

/* ── Preise und ihre Fragebögen ──────────────────────────────────────────── */

/** Die drei Auszeichnungen. Bezeichnungen und Beschreibung: `PRIZES` in `domain/questionnaire.ts`. */
export type PrizeId = 'bmp' | 'roland_berger' | 'future_award'

export type FieldType = 'text' | 'textarea' | 'select' | 'integer' | 'year' | 'zip' | 'email' | 'tel' | 'url' | 'money'

/** Eine Frage. `id` ist innerhalb eines Fragebogens eindeutig und bleibt nach dem Freischalten unverändert. */
export type QuestionField = {
  id: string
  label: string
  type: FieldType
  required?: boolean
  /** Verbindliches Antwortformat, am Feld angezeigt. */
  format?: string
  options?: ReadonlyArray<{ value: string; label: string }>
  maxLength?: number
  placeholder?: string
  /** Breite im Raster: ganze Zeile oder halbe Zeile. */
  span?: 'full' | 'half'
  /** Zwischenüberschrift vor diesem Feld. */
  group?: string
  /** Gemeinsame Formatvorgabe unter der Zwischenüberschrift (gilt für die ganze Gruppe). */
  groupNote?: string
}

/** Bewertungskriterium mit Leitfrage, Erläuterung und Orientierungsfragen (Abschnitte des BMP-Fragebogens). */
export type Criterion = {
  number: number
  title: string
  lead: string
  description: string
  guidance: string[]
}

/** Ein Abschnitt = ein Schritt im Fragebogen. */
export type QuestionSection = {
  id: string
  /** Kurzname in der Schrittleiste. */
  step: string
  heading: string
  intro?: string
  criterion?: Criterion
  fields: QuestionField[]
}

/** `entwurf`: nur die Verwaltung sieht und bearbeitet ihn. `freigeschaltet`: Bewerber können ihn ausfüllen. */
export type DefinitionStatus = 'entwurf' | 'freigeschaltet'

/**
 * Der Fragebogen eines Preises – von der Verwaltung bearbeitet und freigeschaltet (Befehle `questionnaireDef.*`).
 * Nach dem Freischalten bleiben Abschnitte, Felder, Antwortformate und Pflichtangaben fest, damit gespeicherte Antworten
 * zu den Fragen passen; Texte lassen sich weiter korrigieren.
 */
export type QuestionnaireDefinition = {
  prize: PrizeId
  status: DefinitionStatus
  sections: QuestionSection[]
  updatedAt: string
  releasedAt?: string
}

/** Antworten eines Fragebogens: Feld-ID → Wert. Felder und Formate stehen in der `QuestionnaireDefinition`. */
export type QuestionnaireAnswers = Record<string, string>

/**
 * Ein Vorgang: zuerst Entwurf, nach dem Einreichen mit Eingangsnummer und Prozesszustand. Bei einer Fremdnominierung
 * gehört der Vorgang der vorschlagenden Person (`accountId`).
 */
export type Submission = {
  id: string
  accountId: string
  type: SubmissionType | null
  status: 'entwurf' | 'eingereicht'
  /** Zuletzt bearbeiteter Schritt des Anmeldeassistenten (nur für „Weiter bearbeiten“). */
  step: number
  self: SelfData
  nomination: NominationData
  createdAt: string
  updatedAt: string
  submittedAt?: string
  /** Eingangsnummer, z. B. „BMP-A9V5LC“ – entsteht beim Einreichen. */
  reference?: string
  process: ProcessState
  /** Nur Prototyp: Beispieldatensatz der Demo. */
  sample?: boolean
}

/* ── Prozesszustand eines eingereichten Vorgangs ─────────────────────────── */

export type ReviewStatus = 'neu' | 'in_pruefung' | 'rueckfrage' | 'geprueft'
export type PaymentStatus = 'keine_rechnung' | 'rechnung_offen' | 'zahlung_eingegangen'
/**
 * Stand der Bewerbung als Ganzes (Fragebögen aller gewählten Preise und Bewerbungsunterlagen): gesperrt bis zur Freigabe
 * durch die Verwaltung, dann `verfuegbar`, ab der ersten Angabe `in_bearbeitung`, `eingereicht`, sobald alles vollständig
 * ist (`applicationProgress` in `domain/application.ts`).
 */
export type ApplicationStatus = 'gesperrt' | 'verfuegbar' | 'in_bearbeitung' | 'eingereicht'

/** Fragebogen eines Preises innerhalb eines Vorgangs. Fehlt der Eintrag, ist für diesen Preis noch nichts gespeichert. */
export type PrizeQuestionnaire = {
  status: 'in_bearbeitung' | 'eingereicht'
  answers: QuestionnaireAnswers
  /** Zuletzt erreichter Abschnitt (nur für „Fortsetzen“). */
  step: number
  savedAt?: string
  submittedAt?: string
}

/** Die sechs festen Bewerbungsunterlagen. Bezeichnungen und erlaubte Formate: `APPLICATION_DOCS` in `domain/application.ts`. */
export type AppDocKey = 'praesentation' | 'jahresabschluss' | 'kennzahlen' | 'handelsregister' | 'organigramm' | 'referenzen'

/**
 * Eine hochgeladene Datei. Prototyp: nur Name und Größe – im echten System zusätzlich eine Referenz auf die gespeicherte
 * Datei (z. B. Payload-Media-ID), über die Jury und Verwaltung sie öffnen.
 */
export type UploadedFile = { fileName: string; size: number; uploadedAt: string }
export type JuryStage = 'nicht_zugewiesen' | 'zugewiesen' | 'jury1' | 'jury2' | 'abgeschlossen'
/** `vorbereitet` ist intern: Bewerber sehen bis zur Freigabe weiterhin „ausstehend“ (`domain/visibility.ts`). */
export type ResultStatus = 'ausstehend' | 'vorbereitet' | 'einladung' | 'keine_einladung'

export type DocKey = 'logo' | 'foto' | 'portraet' | 'pressekontakt'
export type DocStatus = 'offen' | 'eingereicht' | 'geprueft' | 'nachbesserung'
/** Eine Gewinnerunterlage. Prototyp: bei Dateien nur der Dateiname – im echten System eine Referenz auf die Datei. */
export type DocItem = { status: DocStatus; value?: string; fileName?: string; note?: string; updatedAt?: string }

/** Verlaufseintrag (nur Verwaltung). `by` = Konto, das die Aktion ausgelöst hat. */
export type LogEntry = { at: string; text: string; by?: string }

/**
 * Die Teilzustände eines Vorgangs. Welche Übergänge erlaubt sind, regelt `domain/commands.ts`; was Bewerber, Verwaltung
 * und Jury daraus sehen, `domain/process.ts`.
 */
export type ProcessState = {
  review: ReviewStatus
  payment: PaymentStatus
  application: ApplicationStatus
  /** Frist für die Bewerbung (YYYY-MM-DD), leer = keine Frist gesetzt. */
  deadline: string
  /** Gewählte Preise (einer oder mehrere), in der Reihenfolge von `PRIZES`. */
  prizes: PrizeId[]
  /** Fragebogen je Preis. Einträge abgewählter Preise bleiben als Entwurf erhalten, zählen aber nicht. */
  questionnaires: Partial<Record<PrizeId, PrizeQuestionnaire>>
  /** Bewerbungsunterlagen je Platz – austauschbar bis zur Zuweisung an die Jury. */
  applicationDocs: Partial<Record<AppDocKey, UploadedFile>>
  /** Zeitpunkt, zu dem die Bewerbung vollständig war (alle Fragebögen und Unterlagen). */
  applicationCompletedAt?: string
  jury: JuryStage
  /** Zugewiesene Jurymitglieder je Jury-Art (IDs). */
  assigned: { jury1: string[]; jury2: string[] }
  /** Stimmen der Jury 1 je Jurymitglied. Vertraulich. */
  jury1: Record<string, JuryVote>
  /** Punkte der Jury 2 (1–10) je Jurymitglied. Vertraulich. */
  jury2: Record<string, number>
  result: ResultStatus
  /** Gewinnerunterlagen & Medien – erst nach Anforderung durch die Verwaltung (nur bei Einladung). */
  documents?: { requestedAt: string; items: Record<DocKey, DocItem> }
  /** Interner Verlauf (nur Verwaltung). */
  log: LogEntry[]
}

/* ── Gesamtbestand ───────────────────────────────────────────────────────── */

/** Alle Datensätze des Portals. Die Geschäftsregeln (`domain/commands.ts`) arbeiten auf diesem Bestand. */
export type PortalData = {
  accounts: Account[]
  submissions: Submission[]
  jurors: Juror[]
  /** Je Preis ein Fragebogen (drei Einträge). */
  questionnaires: QuestionnaireDefinition[]
  round: RoundStatus
  roundSettings: RoundSettings
}

/**
 * Was die Oberfläche liest: der Bestand, den die angemeldete Person sehen darf, plus die Sitzung. Das echte Backend
 * liefert ihn bereits gefiltert (`visibleTo` in `domain/visibility.ts`).
 */
export type PortalSnapshot = PortalData & { sessionAccountId: string | null }

/* ── Anfangswerte ────────────────────────────────────────────────────────── */

export const DOC_KEYS: DocKey[] = ['logo', 'foto', 'portraet', 'pressekontakt']
export const JURY_TYPES: JuryType[] = ['jury1', 'jury2']

export const emptyProfile = (): Profile => ({
  salutation: '',
  firstName: '',
  lastName: '',
  phone: '',
  group: '',
  orgName: '',
  orgRole: '',
  orgCity: '',
  orgWebsite: '',
})

export const emptySelfData = (): SelfData => ({
  companyName: '',
  legalForm: '',
  industry: '',
  website: '',
  street: '',
  zip: '',
  city: '',
  seatInBavaria: '',
  foundedYear: '',
  employees: '',
  ownerManaged: '',
  portrait: '',
})

export const emptyNominationData = (): NominationData => ({
  companyName: '',
  city: '',
  website: '',
  industry: '',
  reason: '',
  relationship: '',
})

export const initialProcess = (): ProcessState => ({
  review: 'neu',
  payment: 'keine_rechnung',
  application: 'gesperrt',
  deadline: '',
  prizes: [],
  questionnaires: {},
  applicationDocs: {},
  jury: 'nicht_zugewiesen',
  assigned: { jury1: [], jury2: [] },
  jury1: {},
  jury2: {},
  result: 'ausstehend',
  log: [],
})

export const emptyDocuments = (at: string): NonNullable<ProcessState['documents']> => ({
  requestedAt: at,
  items: { logo: { status: 'offen' }, foto: { status: 'offen' }, portraet: { status: 'offen' }, pressekontakt: { status: 'offen' } },
})

export const defaultRoundSettings = (): RoundSettings => ({ registrationDeadline: '2027-01-31', questionnaireDeadline: '2027-02-15' })

/** Konto eines Jurymitglieds (Rolle `jury`, Name aus dem Mitglied). Mit `demoPassword` als Testzugang des Prototyps. */
export function juryAccount(juror: Juror, demoPassword?: string): Account {
  const [firstName, ...rest] = juror.name.split(' ')
  return {
    id: juror.accountId,
    email: juror.email,
    passwordHash: '',
    role: 'jury',
    jurorId: juror.id,
    createdAt: juror.createdAt,
    profile: { ...emptyProfile(), firstName, lastName: rest.join(' '), group: 'privatperson' },
    ...(demoPassword ? { demoPassword, demo: true } : {}),
  }
}
