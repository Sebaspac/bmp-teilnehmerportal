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
import { CONFIRM_KEY, PRIZE_KEY } from '@/portal/domain/questionnaire'
import { normalizeEmail } from '@/portal/domain/selectors'
import { processForScenario, seedData, simulateRemainingVotes, withSeed, type ScenarioId } from '@/portal/domain/seed'
import { defaultRoundSettings, emptyProfile, initialProcess, type Account, type PortalSnapshot, type Submission } from '@/portal/domain/types'
import type { CommandResponse, DemoControls, LoginResult, PortalBackend, RegisterResult } from '@/portal/data/backend'

const STORAGE_KEY = 'bmp-teilnehmerportal-prototyp'

/** Gespeichertes Format (Version 2 seit dem Vier-Phasen-Modell). */
type Stored = PortalSnapshot & { version: 2 }

/* ── Hilfen ──────────────────────────────────────────────────────────────── */

const now = () => new Date().toISOString()

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

const context: CommandContext = {
  now,
  newId: randomId,
  newReference: () => `BMP-${randomCode(6)}`,
  // Erzeugtes Demo-Passwort (wird im Prototyp nur angezeigt, nicht versendet).
  newPassword: (kind) => `${kind}-${randomCode(6).toLowerCase()}`,
}

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

const fresh = (): Stored => ({ version: 2, sessionAccountId: null, ...seedData() })

/** Antworten von vor der Preiswahl gehören zum Bayerischen Mittelstandspreis (damals der einzige Fragebogen). */
function withPrize(submission: Submission): Submission {
  const { answers } = submission.process
  const started = Object.keys(answers).some((key) => key !== CONFIRM_KEY)
  if (!started || answers[PRIZE_KEY]) return submission
  return { ...submission, process: { ...submission.process, answers: { ...answers, [PRIZE_KEY]: 'bmp' } } }
}

/** Daten früherer Prototyp-Stände übernehmen. Version 1 (vor dem Vier-Phasen-Modell): Jeder Vorgang beginnt in Phase 01. */
function migrate(raw: unknown): Stored {
  const parsed = raw as { version?: number } & Partial<Stored>
  if (parsed?.version === 2) {
    const current = parsed as Stored
    return withSeed({ ...current, submissions: current.submissions.map(withPrize) })
  }
  if (parsed?.version === 1) {
    return withSeed({
      version: 2,
      accounts: parsed.accounts || [],
      sessionAccountId: parsed.sessionAccountId ?? null,
      submissions: ((parsed.submissions || []) as Submission[]).map((submission) => ({ ...submission, process: initialProcess() })),
      round: 'anmeldung_offen',
      roundSettings: defaultRoundSettings(),
      jurors: [],
    })
  }
  return fresh()
}

/* ── Backend ─────────────────────────────────────────────────────────────── */

export function createMockBackend(): PortalBackend & { demo: DemoControls } {
  let state: Stored | null = null
  const listeners = new Set<() => void>()

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
      const outcome = applyCommand(snapshot, denied ? { kind: 'anonymous' } : sessionActor, command, context)
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
    },
  }
}
