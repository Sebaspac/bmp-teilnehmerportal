/**
 * Rollen, Rechte und der handelnde Akteur.
 *
 * Die Oberfläche blendet nach diesen Rechten Bereiche aus oder zeigt sie nur lesbar. Verbindlich ist aber erst die
 * Prüfung in `authorize` (domain/commands.ts) – das echte Backend muss sie bei jeder Aktion serverseitig aufrufen,
 * mit dem Akteur aus der Server-Sitzung, nie aus der Anfrage.
 */

import type { Feature } from '@/portal/domain/release'
import type { Account, JuryType, PortalData, StaffRole } from '@/portal/domain/types'

export type Permission = 'review' | 'payment' | 'release' | 'questionnaires' | 'jury' | 'results' | 'documents' | 'exports' | 'round' | 'rights' | 'evaluate'
export type Role = StaffRole | JuryType

export const PERMISSIONS: Permission[] = ['review', 'payment', 'release', 'questionnaires', 'jury', 'results', 'documents', 'exports', 'round', 'rights', 'evaluate']
export const ROLES: Role[] = ['verwaltung', 'sachbearbeitung', 'jury1', 'jury2']

/** Zu welcher Ausbaustufe ein Recht gehört (`domain/release.ts`) – die Rechte-Matrix zeigt nur die Rechte der Stufe. */
export const PERMISSION_FEATURE: Record<Permission, Feature> = {
  review: 'anmeldung',
  exports: 'anmeldung',
  round: 'anmeldung',
  rights: 'anmeldung',
  payment: 'bewerbung',
  release: 'bewerbung',
  questionnaires: 'bewerbung',
  jury: 'jury',
  results: 'jury',
  evaluate: 'jury',
  documents: 'gewinnerunterlagen',
}

export const ROLE_FEATURE: Record<Role, Feature> = { verwaltung: 'anmeldung', sachbearbeitung: 'anmeldung', jury1: 'jury', jury2: 'jury' }

/** Was jede Rolle darf. Bewerber haben keine Rolle – sie handeln nur an ihren eigenen Vorgängen. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  verwaltung: ['review', 'payment', 'release', 'questionnaires', 'jury', 'results', 'documents', 'exports', 'round', 'rights'],
  sachbearbeitung: ['review', 'payment', 'release', 'documents', 'exports'],
  jury1: ['evaluate'],
  jury2: ['evaluate'],
}

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission)

/** Wer eine Aktion ausführt. Im echten System aus der Sitzung des Servers abgeleitet. */
export type Actor =
  | { kind: 'anonymous' }
  | { kind: 'applicant'; accountId: string }
  | { kind: 'staff'; accountId: string; role: StaffRole }
  | { kind: 'jury'; accountId: string; jurorId: string; role: JuryType }

export function actorOf(data: Pick<PortalData, 'accounts' | 'jurors'> | null, accountId: string | null | undefined): Actor {
  const account = accountId ? data?.accounts.find((item) => item.id === accountId) : undefined
  if (!account || account.active === false) return { kind: 'anonymous' }
  if (account.role === 'verwaltung' || account.role === 'sachbearbeitung') return { kind: 'staff', accountId: account.id, role: account.role }
  if (account.role === 'jury') {
    const juror = data?.jurors.find((item) => item.id === account.jurorId)
    return juror ? { kind: 'jury', accountId: account.id, jurorId: juror.id, role: juror.type } : { kind: 'anonymous' }
  }
  return { kind: 'applicant', accountId: account.id }
}

export const actorCan = (actor: Actor, permission: Permission) => (actor.kind === 'staff' || actor.kind === 'jury') && can(actor.role, permission)

/**
 * Rolle für die Verwaltungsansicht. Prototyp: Ohne internen Login (Perspektivwechsel über die Demo-Steuerung) gelten
 * volle Verwaltungsrechte – im echten System ist die Verwaltung ohne Staff-Sitzung nicht erreichbar.
 */
export const viewerRole = (account: Account | null): StaffRole => (account?.role === 'sachbearbeitung' ? 'sachbearbeitung' : 'verwaltung')
