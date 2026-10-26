/**
 * Nur Prototyp: das Backend im Browser. Konten, Vorgänge und Prozesszustand liegen im localStorage dieses Browsers;
 * Befehle laufen über dieselben Regeln wie später auf dem Server (`domain/commands.ts`).
 *
 * Unterschiede zum echten Backend – alle bewusst und hier gebündelt:
 * - Der Snapshot enthält den ganzen Bestand, weil die Demo-Steuerung ohne Login zwischen Bewerber, Verwaltung und
 *   Jury wechselt. Die Oberfläche filtert mit `visibleTo`, sobald Sitzung und Ansicht zusammenpassen.
 * - Perspektivwechsel: Passt die Ansicht nicht zur Sitzung (z. B. als Bewerber in der Verwaltung), führt der Mock
 *   Verwaltungs- und Jurybefehle trotzdem aus. Innerhalb derselben Rolle gilt die Rechteprüfung streng.
 * - Passwörter: Hash im Browser (keine Sicherheitsfunktion), Testzugänge im Klartext.
 */

import { applyCommand, authorize, COMMAND_SPEC, type CommandContext, type PortalCommand } from '@/portal/domain/commands'
import { actorOf, type Actor } from '@/portal/domain/permissions'
import { CONFIRM_KEY, PRIZE_IDS, sortPrizes } from '@/portal/domain/questionnaire'
import { parseStage, type Stage } from '@/portal/domain/release'
import { normalizeEmail } from '@/portal/domain/selectors'
import { processForScenario, seedData, simulateRemainingVotes, withSeed, type ScenarioId } from '@/portal/domain/seed'
import { defaultRoundSettings, emptyProfile, initialProcess, type Account, type PortalSnapshot, type PrizeId, type ProcessState, type Submission } from '@/portal/domain/types'
import type { CommandResponse, DemoControls, LoginResult, PortalBackend, RegisterResult } from '@/portal/data/backend'

const STORAGE_KEY = 'bmp-teilnehmerportal-prototyp'
/** Ausbaustufe der Vorführung (Demo-Steuerung) – getrennt von den Daten, damit „Zurücksetzen“ sie nicht verändert. */
const STAGE_KEY = 'bmp-teilnehmerportal-ausbaustufe'

/** Gespeichertes Format (Version 3 seit den Fragebögen je Preis und den Bewerbungsunterlagen). */
type Stored = PortalSnapshot & { version: 3 }

/* ── Hilfen ──────────────────────────────────────────────────────────────── */

const now = () => new Date().toISOString()

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

const context = (stage: Stage): CommandContext => ({
  now,
  newId: randomId,
  newReference: () => `BMP-${randomCode(6)}`,
  // Erzeugtes Demo-Passwort (wird im Prototyp nur angezeigt, nicht versendet).
  newPassword: (kind) => `${kind}-${randomCode(6).toLowerCase()}`,
  stage,
})

/** Nur damit kein Klartext-Passwort im Browser liegt – keine Sicherheitsfunktion. */
async function hashPassword(email: string, password: string) {
  const input = `${email.toLowerCase()}::${password}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 0
  for (let index = 0; index < input.length; index++) hash = (hash * 31 + input.charCodeAt(index)) | 0
  return `weak-${hash}`
}

/**
 * Demo-Steuerung: Verwaltungs- und Jurybefehle aus einer Ansicht, zu der die Sitzung nicht passt (Perspektivwechsel).
 * Bewerberbefehle und Rechte innerhalb derselben Rolle bleiben streng.
 */
function demoPerspective(actor: Actor, command: PortalCommand) {
  const { scope } = COMMAND_SPEC[command.type]
  return (scope === 'staff' && actor.kind !== 'staff') || (scope === 'jury' && actor.kind !== 'jury')
}

/* ── Speicher und Migration ──────────────────────────────────────────────── */

const fresh = (): Stored => ({ version: 3, sessionAccountId: null, ...seedData() })

/** Version 2 → 3: ein Fragebogen mit Preiswahl („__prize“) wird zu Fragebögen je Preis; Unterlagen beginnen leer. */
type ProcessV2 = Omit<ProcessState, 'application' | 'prizes' | 'questionnaires' | 'applicationDocs'> & {
  questionnaire: ProcessState['application']
  answers?: Record<string, string>
  questionnaireStep?: number
  questionnaireSavedAt?: string
  questionnaireSubmittedAt?: string
}

function fromV2(process: ProcessV2): ProcessState {
  const { questionnaire, answers = {}, questionnaireStep = 0, questionnaireSavedAt, questionnaireSubmittedAt, ...rest } = process
  const { __prize: rawPrizes = '', ...ownAnswers } = answers
  const started = Object.keys(ownAnswers).some((key) => key !== CONFIRM_KEY)
  // Antworten von vor der Preiswahl gehören zum Bayerischen Mittelstandspreis (damals der einzige Fragebogen).
  const prizes = sortPrizes(rawPrizes ? (rawPrizes.split(',').filter((id) => PRIZE_IDS.includes(id as PrizeId)) as PrizeId[]) : started ? ['bmp'] : [])
  const submitted = questionnaire === 'eingereicht'
  return {
    ...rest,
    application: questionnaire,
    prizes,
    questionnaires: started
      ? { bmp: { status: submitted ? 'eingereicht' : 'in_bearbeitung', answers: ownAnswers, step: questionnaireStep, savedAt: questionnaireSavedAt, submittedAt: questionnaireSubmittedAt } }
      : {},
    applicationDocs: {},
    ...(submitted ? { applicationCompletedAt: questionnaireSubmittedAt } : {}),
  }
}

/** Daten früherer Prototyp-Stände übernehmen. Version 1 (vor dem Vier-Phasen-Modell): Jeder Vorgang beginnt in Phase 01. */
function migrate(raw: unknown): Stored {
  const parsed = raw as { version?: number } & Partial<Stored>
  if (parsed?.version === 3) return withSeed(parsed as Stored)
  if (parsed?.version === 2) {
    const submissions = ((parsed.submissions ?? []) as unknown as Array<Omit<Submission, 'process'> & { process: ProcessV2 }>).map((submission) => ({ ...submission, process: fromV2(submission.process) }))
    return withSeed({ ...(parsed as Stored), version: 3, submissions, questionnaires: [] })
  }
  if (parsed?.version === 1) {
    return withSeed({
      version: 3,
      accounts: parsed.accounts || [],
      sessionAccountId: parsed.sessionAccountId ?? null,
      submissions: ((parsed.submissions || []) as Submission[]).map((submission) => ({ ...submission, process: initialProcess() })),
      round: 'anmeldung_offen',
      roundSettings: defaultRoundSettings(),
      jurors: [],
      questionnaires: [],
    })
  }
  return fresh()
}

/* ── Backend ─────────────────────────────────────────────────────────────── */

/** `configuredStage`: Ausbaustufe aus der Einstellung; die Demo-Steuerung kann sie für die Vorführung überschreiben. */
export function createMockBackend(configuredStage: Stage): PortalBackend & { demo: DemoControls } {
  let state: Stored | null = null
  const listeners = new Set<() => void>()
  const stageListeners = new Set<() => void>()
  let stageOverride: Stage | null | undefined

  const readStage = (): Stage | null => {
    try {
      const raw = window.localStorage.getItem(STAGE_KEY)
      return raw ? parseStage(raw) : null
    } catch {
      return null
    }
  }
  const currentStage = (): Stage => {
    if (typeof window === 'undefined') return configuredStage
    if (stageOverride === undefined) stageOverride = readStage()
    return stageOverride ?? configuredStage
  }

  const read = (): Stored => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? migrate(JSON.parse(raw)) : fresh()
    } catch {
      return fresh()
    }
  }

  const current = (): Stored => {
    if (!state) state = read()
    return state
  }

  const write = (next: Stored) => {
    state = next
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Privates Fenster oder voller Speicher: Der Prototyp läuft in dieser Sitzung trotzdem weiter.
    }
    listeners.forEach((listener) => listener())
  }

  const changeSubmission = (id: string, change: (submission: Submission) => Submission) => {
    const snapshot = current()
    write({ ...snapshot, submissions: snapshot.submissions.map((submission) => (submission.id === id ? change(submission) : submission)) })
  }

  return {
    getSnapshot: () => (typeof window === 'undefined' ? null : current()),

    subscribe(listener) {
      listeners.add(listener)
      // Änderungen aus anderen Tabs desselben Browsers (z. B. Verwaltung und Bewerber nebeneinander).
      const onStorage = (event: StorageEvent) => {
        if (event.key === STAGE_KEY) {
          stageOverride = readStage()
          stageListeners.forEach((item) => item())
        }
        if (event.key !== STORAGE_KEY) return
        state = read()
        listener()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },

    async register(email, password): Promise<RegisterResult> {
      const normalized = normalizeEmail(email)
      if (current().accounts.some((account) => account.email === normalized)) return { ok: false, reason: 'taken' }
      const account: Account = { id: randomId(), email: normalized, passwordHash: await hashPassword(normalized, password), createdAt: now(), profile: emptyProfile() }
      const snapshot = current()
      write({ ...snapshot, accounts: [...snapshot.accounts, account], sessionAccountId: account.id })
      return { ok: true }
    },

    async login(email, password): Promise<LoginResult> {
      const normalized = normalizeEmail(email)
      const account = current().accounts.find((item) => item.email === normalized)
      if (!account) return 'invalid'
      if (account.demo) {
        // Testzugänge der Demo: festes Passwort; das Sammelkonto für Beispieldaten hat keinen Zugang.
        if (!account.demoPassword || password !== account.demoPassword) return 'invalid'
      } else if (account.passwordHash !== (await hashPassword(normalized, password))) return 'invalid'
      if (account.active === false) return 'inactive'
      write({ ...current(), sessionAccountId: account.id })
      return 'ok'
    },

    async logout() {
      write({ ...current(), sessionAccountId: null })
    },

    async execute<C extends PortalCommand>(command: C): Promise<CommandResponse<C>> {
      const snapshot = current()
      const sessionActor = actorOf(snapshot, snapshot.sessionAccountId)
      const denied = authorize(snapshot, sessionActor, command)
      if (denied && !demoPerspective(sessionActor, command)) return { ok: false, error: denied }
      // Im Perspektivwechsel handelt die Demo ohne Konto (kein Verlaufseintrag „von“ einem fremden Konto).
      const outcome = applyCommand(snapshot, denied ? { kind: 'anonymous' } : sessionActor, command, context(currentStage()))
      if (!outcome.ok) return { ok: false, error: outcome.error }
      write({ ...snapshot, ...outcome.data })
      return { ok: true, result: outcome.result }
    },

    demo: {
      loginAs(accountId) {
        write({ ...current(), sessionAccountId: accountId })
      },
      applyScenario(submissionId, scenario: ScenarioId) {
        const time = now()
        changeSubmission(submissionId, (submission) => ({ ...submission, updatedAt: time, process: processForScenario(scenario, submission.process, time) }))
      },
      simulateVotes(submissionId) {
        const time = now()
        changeSubmission(submissionId, (submission) => ({
          ...submission,
          updatedAt: time,
          process: {
            ...submission.process,
            ...simulateRemainingVotes(submission.process),
            log: [...submission.process.log, { at: time, text: 'Übrige Jurystimmen simuliert (Demo)' }],
          },
        }))
      },
      reset() {
        write(fresh())
      },
      stage: currentStage,
      setStage(stage) {
        stageOverride = stage
        try {
          if (stage) window.localStorage.setItem(STAGE_KEY, stage)
          else window.localStorage.removeItem(STAGE_KEY)
        } catch {
          // Ohne Speicher gilt die Wahl nur in diesem Tab.
        }
        stageListeners.forEach((listener) => listener())
      },
      subscribeStage(listener) {
        stageListeners.add(listener)
        return () => stageListeners.delete(listener)
      },
    },
  }
}
