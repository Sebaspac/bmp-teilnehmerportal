/**
 * Lesehilfen auf dem Bestand: Listen, Zuordnungen und abgeleitete Werte. Keine Zustandsänderungen.
 */

import type { Account, PortalData, PortalSnapshot, Profile, ProcessState, Submission } from '@/portal/domain/types'

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function sessionAccount(snapshot: PortalSnapshot | null) {
  if (!snapshot?.sessionAccountId) return null
  return snapshot.accounts.find((account) => account.id === snapshot.sessionAccountId) ?? null
}

export function isProfileComplete(profile: Profile) {
  if (!profile.firstName.trim() || !profile.lastName.trim() || !profile.group) return false
  if (profile.group === 'privatperson') return true
  return Boolean(profile.orgName.trim())
}

const byDateDesc = (a: Submission, b: Submission) => (b.submittedAt || b.updatedAt).localeCompare(a.submittedAt || a.updatedAt)

/** Alle Vorgänge eines Kontos (Entwürfe und eingereichte), neueste zuerst. */
export function submissionsFor(data: PortalData | null, accountId: string | undefined) {
  if (!data || !accountId) return []
  return data.submissions.filter((submission) => submission.accountId === accountId).sort(byDateDesc)
}

/** Alle eingereichten Anmeldungen (Verwaltung, Jury), neueste zuerst. */
export function submittedSubmissions(data: PortalData | null) {
  if (!data) return []
  return data.submissions.filter((submission) => submission.status === 'eingereicht').sort(byDateDesc)
}

export const submissionCompany = (submission: Submission) =>
  (submission.type === 'fremdvorschlag' ? submission.nomination.companyName : submission.self.companyName).trim()

export const accountOf = (data: PortalData | null, accountId: string) => data?.accounts.find((account) => account.id === accountId) ?? null

export const jurorById = (data: PortalData | null, id: string | undefined) => data?.jurors.find((juror) => juror.id === id) ?? null

/** Standardbesetzung: alle Jurymitglieder je Art (wenn für den Vorgang noch niemand zugewiesen ist). */
export function defaultAssignment(data: Pick<PortalData, 'jurors'>): ProcessState['assigned'] {
  return {
    jury1: data.jurors.filter((juror) => juror.type === 'jury1').map((juror) => juror.id),
    jury2: data.jurors.filter((juror) => juror.type === 'jury2').map((juror) => juror.id),
  }
}

/** Neue Anmeldungen sind nur möglich, solange die Runde zur Anmeldung geöffnet ist. */
export const registrationOpen = (data: PortalData | null) => data?.round === 'anmeldung_offen'

const INTERNAL_ROLES: Array<Account['role']> = ['verwaltung', 'sachbearbeitung', 'jury']

/** Interne Zugänge: Verwaltung, Sachbearbeitung und Jury. */
export const staffAccounts = (data: PortalData | null) => (data?.accounts ?? []).filter((account) => INTERNAL_ROLES.includes(account.role))

/** Datum (YYYY-MM-DD oder ISO) als TT.MM.JJJJ. */
export const formatDay = (value?: string) =>
  value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
