/**
 * Alle Schreibaktionen des Portals als benannte Befehle – mit Rechteprüfung, Voraussetzungen und Wirkung.
 *
 * Eine Quelle für Prototyp und echtes Backend:
 * - Prototyp: `data/mockBackend.ts` führt die Befehle im Browser auf dem localStorage-Bestand aus.
 * - Backend: Ein Route Handler lädt die betroffenen Datensätze, ruft `executeCommand` mit dem Akteur aus der
 *   Server-Sitzung auf und speichert, was in `changed` steht. Serverseitig gelten so exakt dieselben Regeln.
 *
 * Neue Aktion: Typ in `PortalCommand` ergänzen, in `COMMAND_SPEC` Zuständigkeit und Recht eintragen und in
 * `apply` Voraussetzungen und Wirkung beschreiben. Die Oberfläche ruft sie über `runCommand` (data/portalClient.ts)
 * auf. Die Erwartungen stehen als Tests in tests/int/portal-domain.int.spec.ts.
 */

import { isValidSubmissionEmail } from '@/shared/formSubmission'
import { DOC_META, JURY_LABEL, RESULT_LABEL, canRelease, juryProgress } from '@/portal/domain/process'
import { actorCan, type Actor, type Permission } from '@/portal/domain/permissions'
import { CONFIRM_KEY, QUESTIONNAIRE, prizesOf, validateSection } from '@/portal/domain/questionnaire'
import { validateRegistration } from '@/portal/domain/registration'
import { defaultAssignment, formatDay, isProfileComplete, normalizeEmail, registrationOpen } from '@/portal/domain/selectors'
import {
  emptyDocuments,
  emptyNominationData,
  emptyProfile,
  emptySelfData,
  initialProcess,
  juryAccount,
  type Account,
  type DocKey,
  type Juror,
  type JuryType,
  type JuryVote,
  type PortalData,
  type ProcessState,
  type Profile,
  type QuestionnaireAnswers,
  type ResultStatus,
  type ReviewStatus,
  type RoundSettings,
  type RoundStatus,
  type StaffRole,
  type Submission,
} from '@/portal/domain/types'

/* ── Befehle ─────────────────────────────────────────────────────────────── */

/** Was Bewerber an einem Entwurf setzen dürfen – Status, Eingangsnummer und Prozess bleiben dem System vorbehalten. */
export type DraftInput = Partial<Pick<Submission, 'type' | 'self' | 'nomination' | 'step'>>

export type PortalCommand =
  // Bewerber und vorschlagende Personen
  | { type: 'profile.save'; profile: Profile }
  /** `id` erzeugt der Client (UUID) – sie steht ab dem Öffnen in der URL und dient als Idempotenzschlüssel. */
  | { type: 'draft.create'; draft: DraftInput & { id: string } }
  | { type: 'draft.update'; submissionId: string; patch: DraftInput }
  | { type: 'draft.submit'; submissionId: string }
  | { type: 'draft.discard'; submissionId: string }
  | { type: 'questionnaire.save'; submissionId: string; answers: QuestionnaireAnswers; step: number }
  | { type: 'questionnaire.submit'; submissionId: string; answers: QuestionnaireAnswers }
  | { type: 'documents.submit'; submissionId: string; key: DocKey; value?: string; fileName?: string }
  // Verwaltung: Vorgang steuern
  | { type: 'review.set'; submissionId: string; status: Exclude<ReviewStatus, 'neu'> }
  | { type: 'payment.invoice'; submissionId: string }
  | { type: 'payment.confirm'; submissionId: string }
  | { type: 'questionnaire.setDeadline'; submissionId: string; deadline: string }
  | { type: 'questionnaire.release'; submissionId: string }
  | { type: 'jury.assign'; submissionId: string }
  | { type: 'jury.setMember'; submissionId: string; jurorId: string; assigned: boolean }
  | { type: 'jury.start'; submissionId: string; stage: JuryType }
  | { type: 'jury.finish'; submissionId: string }
  | { type: 'result.set'; submissionId: string; result: ResultStatus }
  | { type: 'documents.request'; submissionId: string }
  | { type: 'documents.review'; submissionId: string; key: DocKey; status: 'geprueft' | 'nachbesserung'; note?: string }
  // Jury
  | { type: 'jury.vote'; submissionId: string; jurorId: string; vote: JuryVote }
  | { type: 'jury.points'; submissionId: string; jurorId: string; points: number }
  // Verwaltung: Runde, Jury, Zugänge
  | { type: 'round.setStatus'; status: RoundStatus }
  | { type: 'round.setSettings'; patch: Partial<RoundSettings> }
  | { type: 'juror.create'; name: string; email: string; jurorType: JuryType }
  | { type: 'juror.update'; jurorId: string; name: string; email: string; jurorType: JuryType }
  | { type: 'staff.create'; name: string; email: string; role: StaffRole }
  | { type: 'staff.setRole'; accountId: string; role: StaffRole }
  | { type: 'staff.setActive'; accountId: string; active: boolean }
  | { type: 'account.resetAccess'; accountId: string }

export type CommandType = PortalCommand['type']

/** Wer einen Befehl auslösen darf: nur am eigenen Konto/Vorgang, als Jurymitglied für sich selbst oder mit Recht. */
export type CommandScope = 'self' | 'applicant' | 'jury' | 'staff'

/**
 * Zuständigkeit und Recht je Befehl – Grundlage für `authorize` und die Befehlstabelle in
 * docs/teilnehmerportal-backend.md.
 */
export const COMMAND_SPEC: Record<CommandType, { scope: CommandScope; permission?: Permission; summary: string }> = {
  'profile.save': { scope: 'self', summary: 'Eigene Stammdaten speichern' },
  'draft.create': { scope: 'applicant', summary: 'Entwurf einer Anmeldung anlegen (nur bei offener Anmeldung)' },
  'draft.update': { scope: 'applicant', summary: 'Eigenen Entwurf zwischenspeichern' },
  'draft.submit': { scope: 'applicant', summary: 'Eigene Anmeldung einreichen – vergibt die Eingangsnummer' },
  'draft.discard': { scope: 'applicant', summary: 'Eigenen Entwurf verwerfen' },
  'questionnaire.save': { scope: 'applicant', summary: 'Fragebogen zwischenspeichern' },
  'questionnaire.submit': { scope: 'applicant', summary: 'Fragebogen einreichen' },
  'documents.submit': { scope: 'applicant', summary: 'Gewinnerunterlage einreichen' },
  'review.set': { scope: 'staff', permission: 'review', summary: 'Anmeldung prüfen: in Prüfung, Rückfrage, geprüft' },
  'payment.invoice': { scope: 'staff', permission: 'payment', summary: 'Rechnung als gestellt markieren' },
  'payment.confirm': { scope: 'staff', permission: 'payment', summary: 'Zahlungseingang vermerken' },
  'questionnaire.setDeadline': { scope: 'staff', permission: 'release', summary: 'Frist für den Fragebogen setzen oder entfernen' },
  'questionnaire.release': { scope: 'staff', permission: 'release', summary: 'Fragebogen freigeben' },
  'jury.assign': { scope: 'staff', permission: 'jury', summary: 'Vorgang der Jury zuweisen (ohne Auswahl: Standardbesetzung)' },
  'jury.setMember': { scope: 'staff', permission: 'jury', summary: 'Jurymitglied einem Fragebogen zuweisen oder lösen' },
  'jury.start': { scope: 'staff', permission: 'jury', summary: 'Jury 1 bzw. Jury 2 starten' },
  'jury.finish': { scope: 'staff', permission: 'jury', summary: 'Juryprüfung abschließen' },
  'result.set': { scope: 'staff', permission: 'results', summary: 'Ergebnis festlegen (vorbereiten, Einladung, keine Einladung)' },
  'documents.request': { scope: 'staff', permission: 'documents', summary: 'Gewinnerunterlagen anfordern' },
  'documents.review': { scope: 'staff', permission: 'documents', summary: 'Gewinnerunterlage prüfen oder Nachbesserung erbitten' },
  'jury.vote': { scope: 'jury', permission: 'evaluate', summary: 'Ersteinschätzung abgeben (Jury 1)' },
  'jury.points': { scope: 'jury', permission: 'evaluate', summary: 'Punkte vergeben (Jury 2)' },
  'round.setStatus': { scope: 'staff', permission: 'round', summary: 'Status der Wettbewerbsrunde setzen' },
  'round.setSettings': { scope: 'staff', permission: 'round', summary: 'Anmeldeschluss und Standardfrist ändern' },
  'juror.create': { scope: 'staff', permission: 'jury', summary: 'Jurymitglied mit Zugang anlegen' },
  'juror.update': { scope: 'staff', permission: 'jury', summary: 'Jurymitglied ändern (Jury-Art nur ohne Zuweisungen)' },
  'staff.create': { scope: 'staff', permission: 'rights', summary: 'Internen Benutzer anlegen' },
  'staff.setRole': { scope: 'staff', permission: 'rights', summary: 'Rolle eines internen Benutzers ändern' },
  'staff.setActive': { scope: 'staff', permission: 'rights', summary: 'Internen Zugang aktivieren oder deaktivieren' },
  'account.resetAccess': { scope: 'staff', permission: 'rights', summary: 'Zugang neu ausstellen (bei Jury-Zugängen mit Recht „jury“)' },
}

/* ── Ergebnis ────────────────────────────────────────────────────────────── */

/** Rückgabewerte einzelner Befehle; alle anderen liefern nichts zurück. */
type ResultMap = {
  'draft.submit': { reference: string }
  'juror.create': { jurorId: string }
  'staff.create': { accountId: string }
}
export type CommandResult<C extends PortalCommand> = C['type'] extends keyof ResultMap ? ResultMap[C['type']] : undefined

/** Fehlerarten – das Backend bildet sie auf HTTP-Status ab (401, 403, 404, 409, 422). */
export type CommandErrorCode = 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid_state' | 'invalid_input' | 'conflict'
export type CommandError = { code: CommandErrorCode; message: string; field?: string }

/** Welche Datensätze sich geändert haben – das Backend speichert genau diese. */
export type Changes = { submissions: string[]; removedSubmissions: string[]; accounts: string[]; jurors: string[]; round: boolean }

export type CommandOutcome<C extends PortalCommand = PortalCommand> =
  | { ok: true; data: PortalData; changed: Changes; result: CommandResult<C> }
  | { ok: false; error: CommandError }

/** Erzeuger für Zeit, IDs und Nummern – der Server setzt hier seine eigenen ein (Tests feste Werte). */
export type CommandContext = {
  now: () => string
  newId: () => string
  newReference: () => string
  /** Nur Prototyp: Passwort für neue Testzugänge. Das echte Backend lässt es weg und verschickt Einladungslinks. */
  newPassword?: (kind: 'jury' | 'team') => string
}

const MSG = {
  unauthenticated: 'Bitte melden Sie sich an.',
  forbidden: 'Für diese Aktion fehlt Ihnen das Recht.',
  notFound: 'Der Vorgang wurde nicht gefunden.',
  accountNotFound: 'Der Zugang wurde nicht gefunden.',
  jurorNotFound: 'Das Jurymitglied wurde nicht gefunden.',
  notSubmitted: 'Der Vorgang ist noch nicht eingereicht.',
  alreadySubmitted: 'Die Anmeldung ist bereits eingereicht.',
  registrationClosed: 'Die Anmeldung zur Wettbewerbsrunde ist derzeit geschlossen.',
  emailTaken: 'Diese E-Mail-Adresse ist bereits vergeben.',
  email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  name: 'Bitte geben Sie einen Namen ein.',
  date: 'Bitte wählen Sie ein gültiges Datum.',
  self: 'Ihren eigenen Zugang können Sie hier nicht ändern.',
} as const

/* ── Rechteprüfung ───────────────────────────────────────────────────────── */

const isStaffRole = (role: Account['role']): role is StaffRole => role === 'verwaltung' || role === 'sachbearbeitung'

/** Darf der Akteur diesen Befehl auslösen? `null` = ja. Prüft nur das Wer – das Wann prüft `applyCommand`. */
export function authorize(data: PortalData, actor: Actor, command: PortalCommand): CommandError | null {
  const spec = COMMAND_SPEC[command.type]
  if (actor.kind === 'anonymous') return { code: 'unauthenticated', message: MSG.unauthenticated }
  const forbidden: CommandError = { code: 'forbidden', message: MSG.forbidden }

  if (spec.scope === 'self') return null

  if (spec.scope === 'applicant') {
    if (actor.kind !== 'applicant') return forbidden
    if (!('submissionId' in command)) return null
    const submission = data.submissions.find((item) => item.id === command.submissionId)
    if (!submission) return { code: 'not_found', message: MSG.notFound }
    return submission.accountId === actor.accountId ? null : forbidden
  }

  if (spec.scope === 'jury') {
    // Jurymitglieder bewerten nur in eigenem Namen.
    return actor.kind === 'jury' && 'jurorId' in command && command.jurorId === actor.jurorId ? null : forbidden
  }

  if (actor.kind !== 'staff') return forbidden
  let permission = spec.permission!
  if (command.type === 'account.resetAccess' && data.accounts.find((account) => account.id === command.accountId)?.role === 'jury') permission = 'jury'
  return actorCan(actor, permission) ? null : { code: 'forbidden', message: 'Für diese Aktion fehlt Ihrer Rolle das Recht.' }
}

/** Rechteprüfung und Ausführung in einem – so ruft das Backend die Befehle auf. */
export function executeCommand<C extends PortalCommand>(data: PortalData, actor: Actor, command: C, ctx: CommandContext): CommandOutcome<C> {
  const denied = authorize(data, actor, command)
  if (denied) return { ok: false, error: denied }
  return applyCommand(data, actor, command, ctx)
}

/** Voraussetzungen prüfen und den Befehl ausführen – ohne Rechteprüfung (die macht `authorize`). Ändert `data` nicht. */
export function applyCommand<C extends PortalCommand>(data: PortalData, actor: Actor, command: C, ctx: CommandContext): CommandOutcome<C> {
  return apply(data, actor, command, ctx) as CommandOutcome<C>
}

/* ── Hilfen ──────────────────────────────────────────────────────────────── */

type Outcome = CommandOutcome<PortalCommand>

const NO_CHANGES: Changes = { submissions: [], removedSubmissions: [], accounts: [], jurors: [], round: false }

const done = (data: PortalData, changed: Partial<Changes>, result?: unknown): Outcome => ({
  ok: true,
  data,
  changed: { ...NO_CHANGES, ...changed },
  result: result as undefined,
})

const failure = (code: CommandErrorCode, message: string, field?: string): Outcome => ({ ok: false, error: { code, message, ...(field ? { field } : {}) } })

const invalid = (message: string): CommandError => ({ code: 'invalid_state', message })
const badInput = (message: string, field?: string): CommandError => ({ code: 'invalid_input', message, ...(field ? { field } : {}) })

const actorAccountId = (actor: Actor) => (actor.kind === 'anonymous' ? undefined : actor.accountId)

const replaceSubmission = (data: PortalData, next: Submission): PortalData => ({
  ...data,
  submissions: data.submissions.map((submission) => (submission.id === next.id ? next : submission)),
})

const replaceAccount = (data: PortalData, next: Account): PortalData => ({
  ...data,
  accounts: data.accounts.map((account) => (account.id === next.id ? next : account)),
})

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))

const pickDraft = (input: DraftInput): DraftInput => {
  const picked: DraftInput = {}
  if (input.type !== undefined) picked.type = input.type
  if (input.self) picked.self = { ...emptySelfData(), ...input.self }
  if (input.nomination) picked.nomination = { ...emptyNominationData(), ...input.nomination }
  if (input.step !== undefined) picked.step = input.step
  return picked
}

const splitName = (name: string) => {
  const [firstName, ...rest] = name.trim().split(' ')
  return { firstName, lastName: rest.join(' ') }
}

const emailTaken = (data: PortalData, email: string, exceptAccountId?: string) =>
  data.accounts.some((account) => account.email === email && account.id !== exceptAccountId)

/** Ergebnis eines Prozessschritts: Änderung mit Verlaufstext – oder ein Grund, warum der Schritt nicht geht. */
type Step = { patch: Partial<ProcessState>; log?: string } | CommandError
const isError = (step: Step): step is CommandError => 'code' in step

/** Ändert den Prozess eines eingereichten Vorgangs und schreibt den Verlauf (mit auslösendem Konto). */
function changeProcess(data: PortalData, actor: Actor, ctx: CommandContext, submissionId: string, step: (process: ProcessState, at: string) => Step): Outcome {
  const submission = data.submissions.find((item) => item.id === submissionId)
  if (!submission) return failure('not_found', MSG.notFound)
  if (submission.status !== 'eingereicht') return failure('invalid_state', MSG.notSubmitted)
  const at = ctx.now()
  const outcome = step(submission.process, at)
  if (isError(outcome)) return { ok: false, error: outcome }
  const by = actorAccountId(actor)
  const log = outcome.log ? [...submission.process.log, { at, text: outcome.log, ...(by ? { by } : {}) }] : submission.process.log
  const next: Submission = { ...submission, updatedAt: at, process: { ...submission.process, ...outcome.patch, log } }
  return done(replaceSubmission(data, next), { submissions: [submissionId] })
}

/** Entwurf des Akteurs, der noch bearbeitet werden darf. */
function ownDraft(data: PortalData, submissionId: string): Submission | CommandError {
  const submission = data.submissions.find((item) => item.id === submissionId)
  if (!submission) return { code: 'not_found', message: MSG.notFound }
  if (submission.status !== 'entwurf') return invalid(MSG.alreadySubmitted)
  return submission
}

const decided = (process: ProcessState) => process.result === 'einladung' || process.result === 'keine_einladung'

const QUESTIONNAIRE_OPEN = (process: ProcessState) => process.questionnaire === 'verfuegbar' || process.questionnaire === 'in_bearbeitung'

/* ── Ausführung ──────────────────────────────────────────────────────────── */

function apply(data: PortalData, actor: Actor, command: PortalCommand, ctx: CommandContext): Outcome {
  switch (command.type) {
    /* Bewerber */

    case 'profile.save': {
      const account = data.accounts.find((item) => item.id === actorAccountId(actor))
      if (!account) return failure('not_found', MSG.accountNotFound)
      const profile: Profile = { ...emptyProfile(), ...command.profile, completedAt: isProfileComplete(command.profile) ? ctx.now() : undefined }
      return done(replaceAccount(data, { ...account, profile }), { accounts: [account.id] })
    }

    case 'draft.create': {
      const accountId = actorAccountId(actor)
      if (!accountId) return failure('unauthenticated', MSG.unauthenticated)
      if (!registrationOpen(data)) return failure('invalid_state', MSG.registrationClosed)
      if (!command.draft.id) return failure('invalid_input', 'Der Entwurf braucht eine ID.')
      if (data.submissions.some((item) => item.id === command.draft.id)) return failure('conflict', 'Diesen Entwurf gibt es bereits.')
      const at = ctx.now()
      const submission: Submission = {
        id: command.draft.id,
        accountId,
        type: null,
        status: 'entwurf',
        step: 0,
        self: emptySelfData(),
        nomination: emptyNominationData(),
        createdAt: at,
        updatedAt: at,
        process: initialProcess(),
        ...pickDraft(command.draft),
      }
      return done({ ...data, submissions: [...data.submissions, submission] }, { submissions: [submission.id] })
    }

    case 'draft.update': {
      const draft = ownDraft(data, command.submissionId)
      if ('code' in draft) return { ok: false, error: draft }
      return done(replaceSubmission(data, { ...draft, ...pickDraft(command.patch), updatedAt: ctx.now() }), { submissions: [draft.id] })
    }

    case 'draft.submit': {
      const draft = ownDraft(data, command.submissionId)
      if ('code' in draft) return { ok: false, error: draft }
      if (!registrationOpen(data)) return failure('invalid_state', MSG.registrationClosed)
      if (!draft.type) return failure('invalid_input', 'Bitte wählen Sie, ob Sie Ihr Unternehmen anmelden oder ein anderes vorschlagen.', 'type')
      const errors = validateRegistration(draft.type, draft.self, draft.nomination)
      const firstError = Object.keys(errors)[0]
      if (firstError) return failure('invalid_input', 'Die Anmeldung ist unvollständig. Bitte prüfen Sie die markierten Angaben.', firstError)
      const at = ctx.now()
      const reference = ctx.newReference()
      const submitted: Submission = {
        ...draft,
        status: 'eingereicht',
        submittedAt: at,
        updatedAt: at,
        reference,
        process: { ...initialProcess(), log: [{ at, text: 'Anmeldung eingegangen' }] },
      }
      return done(replaceSubmission(data, submitted), { submissions: [draft.id] }, { reference })
    }

    case 'draft.discard': {
      const draft = ownDraft(data, command.submissionId)
      if ('code' in draft) return { ok: false, error: draft }
      return done({ ...data, submissions: data.submissions.filter((item) => item.id !== draft.id) }, { removedSubmissions: [draft.id] })
    }

    case 'questionnaire.save':
      return changeProcess(data, actor, ctx, command.submissionId, (process, at) => {
        if (!QUESTIONNAIRE_OPEN(process)) return invalid('Der Fragebogen ist nicht zur Bearbeitung freigegeben.')
        if (!Number.isInteger(command.step) || command.step < 0) return badInput('Ungültiger Abschnitt.')
        return {
          patch: {
            answers: command.answers,
            questionnaireStep: command.step,
            questionnaireSavedAt: at,
            questionnaire: process.questionnaire === 'verfuegbar' ? 'in_bearbeitung' : process.questionnaire,
          },
        }
      })

    case 'questionnaire.submit':
      return changeProcess(data, actor, ctx, command.submissionId, (process, at) => {
        if (!QUESTIONNAIRE_OPEN(process)) return invalid('Der Fragebogen ist nicht zur Bearbeitung freigegeben.')
        if (prizesOf(command.answers).length === 0) return badInput('Bitte wählen Sie mindestens einen Preis.')
        for (const section of QUESTIONNAIRE) {
          const field = Object.keys(validateSection(section, command.answers))[0]
          if (field) return badInput('Der Fragebogen ist unvollständig. Bitte prüfen Sie die markierten Angaben.', field)
        }
        if (command.answers[CONFIRM_KEY] !== 'ja') return badInput('Bitte bestätigen Sie Ihre Angaben.', CONFIRM_KEY)
        return { patch: { answers: command.answers, questionnaire: 'eingereicht', questionnaireSubmittedAt: at }, log: 'Fragebogen eingereicht' }
      })

    case 'documents.submit':
      return changeProcess(data, actor, ctx, command.submissionId, (process, at) => {
        if (!process.documents) return invalid('Es wurden keine Unterlagen angefordert.')
        const item = process.documents.items[command.key]
        if (!item) return badInput('Unbekannte Unterlage.')
        if (item.status !== 'offen' && item.status !== 'nachbesserung') return invalid('Diese Unterlage ist bereits eingereicht.')
        const meta = DOC_META[command.key]
        const fileName = command.fileName?.trim()
        const value = command.value?.trim()
        if (meta.kind === 'file' && !fileName) return badInput('Bitte wählen Sie eine Datei aus.', command.key)
        if (meta.kind === 'text' && !value) return badInput('Bitte füllen Sie das Feld aus.', command.key)
        if (meta.kind === 'text' && meta.maxLength && value!.length > meta.maxLength) return badInput(`Höchstens ${meta.maxLength} Zeichen.`, command.key)
        const next = meta.kind === 'file' ? { fileName, status: 'eingereicht' as const, updatedAt: at } : { value, status: 'eingereicht' as const, updatedAt: at }
        return {
          patch: { documents: { ...process.documents, items: { ...process.documents.items, [command.key]: next } } },
          log: `Unterlage „${meta.label}“ eingereicht`,
        }
      })

    /* Verwaltung: Vorgang */

    case 'review.set':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.questionnaire !== 'gesperrt' || process.payment !== 'keine_rechnung')
          return invalid('Die Prüfung lässt sich nur ändern, solange noch keine Rechnung gestellt ist.')
        const log = { in_pruefung: 'Anmeldung in Prüfung gesetzt', rueckfrage: 'Rückfrage zur Anmeldung vermerkt', geprueft: 'Prüfung abgeschlossen, für nächsten Schritt vorgemerkt' }
        return { patch: { review: command.status }, log: log[command.status] }
      })

    case 'payment.invoice':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.review !== 'geprueft') return invalid('Die Anmeldung ist noch nicht geprüft.')
        if (process.questionnaire !== 'gesperrt' || process.payment !== 'keine_rechnung') return invalid('Die Rechnung ist bereits gestellt.')
        return { patch: { payment: 'rechnung_offen' }, log: 'Rechnung als gestellt markiert (Demo)' }
      })

    case 'payment.confirm':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.payment === 'keine_rechnung') return invalid('Es ist noch keine Rechnung gestellt.')
        if (process.questionnaire !== 'gesperrt') return invalid('Der Fragebogen ist bereits freigegeben.')
        return { patch: { payment: 'zahlung_eingegangen' }, log: 'Zahlungseingang manuell vermerkt (Demo)' }
      })

    case 'questionnaire.setDeadline':
      return changeProcess(data, actor, ctx, command.submissionId, () => {
        if (command.deadline && !isDate(command.deadline)) return badInput(MSG.date, 'deadline')
        return { patch: { deadline: command.deadline }, log: command.deadline ? `Frist gesetzt: ${formatDay(command.deadline)}` : 'Frist entfernt' }
      })

    case 'questionnaire.release':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.questionnaire !== 'gesperrt') return invalid('Der Fragebogen ist bereits freigegeben.')
        if (!canRelease(process)) return invalid('Die Freigabe ist erst nach Prüfung und Zahlungseingang möglich.')
        if (!process.deadline) return invalid('Bitte setzen Sie zuerst eine Frist.')
        return { patch: { questionnaire: 'verfuegbar' }, log: 'Fragebogen freigegeben' }
      })

    case 'jury.assign':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.questionnaire !== 'eingereicht') return invalid('Der Fragebogen ist noch nicht eingereicht.')
        if (decided(process) || process.jury !== 'nicht_zugewiesen') return invalid('Der Vorgang ist der Jury bereits zugewiesen.')
        // Ohne eigene Auswahl bekommt der Vorgang alle Jurymitglieder (je Art).
        const nobody = process.assigned.jury1.length + process.assigned.jury2.length === 0
        return nobody
          ? { patch: { jury: 'zugewiesen', assigned: defaultAssignment(data) }, log: `Jury: ${JURY_LABEL.zugewiesen} (Standardbesetzung)` }
          : { patch: { jury: 'zugewiesen' }, log: `Jury: ${JURY_LABEL.zugewiesen}` }
      })

    case 'jury.setMember': {
      const juror = data.jurors.find((item) => item.id === command.jurorId)
      if (!juror) return failure('not_found', MSG.jurorNotFound)
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.questionnaire !== 'eingereicht') return invalid('Der Fragebogen ist noch nicht eingereicht.')
        if (process.jury === 'abgeschlossen' || decided(process)) return invalid('Die Juryprüfung ist abgeschlossen.')
        const current = process.assigned[juror.type]
        const list = command.assigned ? Array.from(new Set([...current, juror.id])) : current.filter((id) => id !== juror.id)
        return { patch: { assigned: { ...process.assigned, [juror.type]: list } }, log: `${juror.name} ${command.assigned ? 'zugewiesen' : 'Zuweisung gelöst'}` }
      })
    }

    case 'jury.start':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.questionnaire !== 'eingereicht' || decided(process)) return invalid('Der Vorgang ist nicht in der Juryprüfung.')
        const progress = juryProgress(process)
        if (command.stage === 'jury1') {
          if (process.jury !== 'zugewiesen') return invalid('Jury 1 startet nach dem Zuweisen.')
          if (progress.jury1.assigned === 0) return invalid('Bitte weisen Sie zuerst Mitglieder der Jury 1 zu.')
        } else {
          if (process.jury !== 'jury1') return invalid('Jury 2 startet nach Jury 1.')
          if (progress.jury1.assigned === 0 || progress.jury1.done < progress.jury1.assigned) return invalid('Es fehlen noch Stimmen der Jury 1.')
        }
        return { patch: { jury: command.stage }, log: `Jury: ${JURY_LABEL[command.stage]}` }
      })

    case 'jury.finish':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.jury !== 'jury2' || decided(process)) return invalid('Die Juryprüfung lässt sich erst nach Jury 2 abschließen.')
        const progress = juryProgress(process)
        if (progress.jury2.assigned === 0 || progress.jury2.done < progress.jury2.assigned) return invalid('Es fehlen noch Punkte der Jury 2.')
        return { patch: { jury: 'abgeschlossen' }, log: `Jury: ${JURY_LABEL.abgeschlossen}` }
      })

    case 'result.set':
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (process.jury !== 'abgeschlossen') return invalid('Das Ergebnis lässt sich erst nach abgeschlossener Juryprüfung festlegen.')
        return { patch: { result: command.result }, log: `Ergebnis: ${RESULT_LABEL[command.result]}` }
      })

    case 'documents.request': {
      const submission = data.submissions.find((item) => item.id === command.submissionId)
      // Bereits angefordert: nichts zu tun (wiederholbarer Aufruf).
      if (submission?.process.documents && submission.process.result === 'einladung') return done(data, {})
      return changeProcess(data, actor, ctx, command.submissionId, (process, at) => {
        if (process.result !== 'einladung') return invalid('Gewinnerunterlagen gibt es nur bei freigegebener Einladung.')
        return { patch: { documents: emptyDocuments(at) }, log: 'Gewinnerunterlagen angefordert' }
      })
    }

    case 'documents.review':
      return changeProcess(data, actor, ctx, command.submissionId, (process, at) => {
        if (!process.documents) return invalid('Es wurden keine Unterlagen angefordert.')
        const item = process.documents.items[command.key]
        if (!item || item.status === 'offen') return invalid('Diese Unterlage ist noch nicht eingereicht.')
        const next = { ...item, status: command.status, note: command.status === 'nachbesserung' ? command.note : undefined, updatedAt: at }
        return {
          patch: { documents: { ...process.documents, items: { ...process.documents.items, [command.key]: next } } },
          log: `Unterlage „${DOC_META[command.key].label}“: ${command.status === 'geprueft' ? 'geprüft' : 'Nachbesserung erbeten'}`,
        }
      })

    /* Jury */

    case 'jury.vote':
    case 'jury.points': {
      const juror = data.jurors.find((item) => item.id === command.jurorId)
      if (!juror) return failure('not_found', MSG.jurorNotFound)
      const stage: JuryType = command.type === 'jury.vote' ? 'jury1' : 'jury2'
      if (juror.type !== stage) return failure('invalid_state', `Dieses Jurymitglied gehört nicht zur ${stage === 'jury1' ? 'Jury 1' : 'Jury 2'}.`)
      if (command.type === 'jury.points' && !(Number.isInteger(command.points) && command.points >= 1 && command.points <= 10))
        return failure('invalid_input', 'Bitte vergeben Sie 1 bis 10 Punkte.', 'points')
      return changeProcess(data, actor, ctx, command.submissionId, (process) => {
        if (!process.assigned[stage].includes(juror.id)) return invalid('Dieser Fragebogen ist dem Jurymitglied nicht zugewiesen.')
        if (process.jury !== stage) return invalid(stage === 'jury1' ? 'Die Ersteinschätzung läuft derzeit nicht.' : 'Die Punktevergabe läuft derzeit nicht.')
        return command.type === 'jury.vote'
          ? { patch: { jury1: { ...process.jury1, [juror.id]: command.vote } } }
          : { patch: { jury2: { ...process.jury2, [juror.id]: command.points } } }
      })
    }

    /* Verwaltung: Runde */

    case 'round.setStatus':
      return done({ ...data, round: command.status }, { round: true })

    case 'round.setSettings': {
      const { registrationDeadline, questionnaireDeadline } = command.patch
      if (registrationDeadline !== undefined && !isDate(registrationDeadline)) return failure('invalid_input', MSG.date, 'registrationDeadline')
      if (questionnaireDeadline !== undefined && !isDate(questionnaireDeadline)) return failure('invalid_input', MSG.date, 'questionnaireDeadline')
      return done({ ...data, roundSettings: { ...data.roundSettings, ...command.patch } }, { round: true })
    }

    /* Verwaltung: Jury und Zugänge */

    case 'juror.create': {
      const email = normalizeEmail(command.email)
      if (!command.name.trim()) return failure('invalid_input', MSG.name, 'name')
      if (!isValidSubmissionEmail(email)) return failure('invalid_input', MSG.email, 'email')
      if (emailTaken(data, email)) return failure('conflict', MSG.emailTaken, 'email')
      const juror: Juror = { id: ctx.newId(), name: command.name.trim(), email, type: command.jurorType, accountId: ctx.newId(), createdAt: ctx.now() }
      const account = juryAccount(juror, ctx.newPassword?.('jury'))
      return done(
        { ...data, jurors: [...data.jurors, juror], accounts: [...data.accounts, account] },
        { jurors: [juror.id], accounts: [account.id] },
        { jurorId: juror.id },
      )
    }

    case 'juror.update': {
      const juror = data.jurors.find((item) => item.id === command.jurorId)
      if (!juror) return failure('not_found', MSG.jurorNotFound)
      const email = normalizeEmail(command.email)
      if (!command.name.trim()) return failure('invalid_input', MSG.name, 'name')
      if (!isValidSubmissionEmail(email)) return failure('invalid_input', MSG.email, 'email')
      if (emailTaken(data, email, juror.accountId)) return failure('conflict', MSG.emailTaken, 'email')
      // Die Jury-Art bestimmt die Bewertungsform – wechseln nur ohne Zuweisungen, damit keine Bewertung „verrutscht“.
      const assignedSomewhere = data.submissions.some((item) => item.process.questionnaire === 'eingereicht' && item.process.assigned[juror.type].includes(juror.id))
      if (command.jurorType !== juror.type && assignedSomewhere) return failure('invalid_state', 'Die Jury-Art lässt sich nur ohne Zuweisungen ändern.', 'jurorType')
      const next: Juror = { ...juror, name: command.name.trim(), email, type: command.jurorType }
      const account = data.accounts.find((item) => item.id === juror.accountId)
      const accounts = account ? [{ ...account, email, profile: { ...account.profile, ...splitName(next.name) } }] : []
      return done(
        { ...data, jurors: data.jurors.map((item) => (item.id === juror.id ? next : item)), accounts: data.accounts.map((item) => accounts.find((changed) => changed.id === item.id) ?? item) },
        { jurors: [juror.id], accounts: accounts.map((item) => item.id) },
      )
    }

    case 'staff.create': {
      const email = normalizeEmail(command.email)
      if (!command.name.trim()) return failure('invalid_input', MSG.name, 'name')
      if (!isValidSubmissionEmail(email)) return failure('invalid_input', MSG.email, 'email')
      if (!isStaffRole(command.role)) return failure('invalid_input', 'Bitte wählen Sie eine Rolle.', 'role')
      if (emailTaken(data, email)) return failure('conflict', MSG.emailTaken, 'email')
      const password = ctx.newPassword?.('team')
      const account: Account = {
        id: ctx.newId(),
        email,
        passwordHash: '',
        role: command.role,
        createdAt: ctx.now(),
        profile: { ...emptyProfile(), ...splitName(command.name), group: 'institution', orgName: 'Bayerischer Mittelstandspreis' },
        ...(password ? { demoPassword: password, demo: true } : {}),
      }
      return done({ ...data, accounts: [...data.accounts, account] }, { accounts: [account.id] }, { accountId: account.id })
    }

    case 'staff.setRole':
    case 'staff.setActive':
    case 'account.resetAccess': {
      const target = data.accounts.find((item) => item.id === command.accountId)
      if (!target) return failure('not_found', MSG.accountNotFound)
      if (target.id === actorAccountId(actor)) return failure('invalid_state', MSG.self)
      const internal = isStaffRole(target.role) || target.role === 'jury'
      if (!internal || (command.type === 'staff.setRole' && !isStaffRole(target.role))) return failure('invalid_state', 'Das ist kein interner Zugang der Geschäftsstelle.')
      const next: Account =
        command.type === 'staff.setRole'
          ? { ...target, role: command.role }
          : command.type === 'staff.setActive'
            ? { ...target, active: command.active }
            : // Prototyp: neues Testpasswort. Echtes Backend: Einladungslink verschicken, nichts speichern.
              { ...target, ...(ctx.newPassword ? { demoPassword: ctx.newPassword(target.role === 'jury' ? 'jury' : 'team') } : {}) }
      return done(replaceAccount(data, next), { accounts: [target.id] })
    }
  }
}
