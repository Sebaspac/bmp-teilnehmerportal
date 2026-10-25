/**
 * Vorlage: Anbindung an das echte Backend über HTTP. Noch nicht in Betrieb – aktiv erst mit
 * `NEXT_PUBLIC_PORTAL_BACKEND=http` (siehe data/portalClient.ts).
 *
 * Erwartete Endpunkte (Details, Statuscodes und ein Beispiel-Route-Handler: docs/teilnehmerportal-backend.md):
 *   GET  /api/portal/snapshot        → PortalSnapshot der Sitzung, gefiltert mit `visibleTo`
 *   POST /api/portal/auth/register   { email, password } → 201 | 409
 *   POST /api/portal/auth/login      { email, password } → 200 | 401 | 403 (deaktiviert)
 *   POST /api/portal/auth/logout     → 204
 *   POST /api/portal/commands        PortalCommand → 200 { result } | 4xx { error: CommandError }
 *
 * Die Sitzung läuft über ein HttpOnly-Cookie; der Client schickt nie Rolle oder Konto-ID mit.
 */

import type { CommandError, CommandResult, PortalCommand } from '@/portal/domain/commands'
import type { PortalSnapshot } from '@/portal/domain/types'
import type { CommandResponse, LoginResult, PortalBackend, RegisterResult } from '@/portal/data/backend'

const NETWORK_ERROR: CommandError = { code: 'invalid_state', message: 'Die Verbindung zum Server ist fehlgeschlagen. Bitte versuchen Sie es erneut.' }

export function createHttpBackend(baseUrl = '/api/portal'): PortalBackend {
  let snapshot: PortalSnapshot | null = null
  let started = false
  let queue: Promise<void> = Promise.resolve()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())

  const post = (path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  /** Snapshot neu laden – nach jeder Änderung und beim Start. Später ggf. ergänzen um Polling oder Server-Sent Events. */
  async function refresh() {
    try {
      const response = await fetch(`${baseUrl}/snapshot`, { credentials: 'include' })
      if (response.ok) snapshot = (await response.json()) as PortalSnapshot
    } finally {
      emit()
    }
  }

  return {
    getSnapshot() {
      if (!started && typeof window !== 'undefined') {
        started = true
        void refresh()
      }
      return snapshot
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async register(email, password): Promise<RegisterResult> {
      const response = await post('/auth/register', { email, password })
      if (response.status === 409) return { ok: false, reason: 'taken' }
      await refresh()
      return { ok: true }
    },

    async login(email, password): Promise<LoginResult> {
      const response = await post('/auth/login', { email, password })
      if (response.status === 403) return 'inactive'
      if (!response.ok) return 'invalid'
      await refresh()
      return 'ok'
    },

    async logout() {
      await post('/auth/logout')
      await refresh()
    },

    execute<C extends PortalCommand>(command: C): Promise<CommandResponse<C>> {
      // Befehle in der Reihenfolge senden, in der die Oberfläche sie auslöst – sonst könnte beim schnellen
      // Zwischenspeichern ein `draft.update` vor dem zugehörigen `draft.create` ankommen.
      const send = async (): Promise<CommandResponse<C>> => {
        try {
          const response = await post('/commands', command)
          const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: CommandError }
          if (!response.ok) return { ok: false, error: body.error ?? NETWORK_ERROR }
          await refresh()
          return { ok: true, result: body.result as CommandResult<C> }
        } catch {
          return { ok: false, error: NETWORK_ERROR }
        }
      }
      const next = queue.then(send)
      queue = next.then(() => undefined)
      return next
    },
  }
}
