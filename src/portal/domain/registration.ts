/**
 * Prüfregeln der Anmeldung (Eigenbewerbung und Fremdnominierung). Die Oberfläche zeigt damit Fehler am Feld, und
 * `draft.submit` (domain/commands.ts) lehnt unvollständige Anmeldungen mit denselben Regeln ab – auch serverseitig.
 */

import { portalContent } from '@/portal/content/portalContent'
import type { NominationData, SelfData, SubmissionType } from '@/portal/domain/types'

export const LIMITS = { portrait: 1500, reason: 800 } as const

/** Pflichtangaben je Weg – Grundlage für Prüfung und für die Anzeige „n Pflichtangaben“. */
export const SELF_REQUIRED: Array<keyof SelfData> = [
  'companyName',
  'industry',
  'street',
  'zip',
  'city',
  'seatInBavaria',
  'foundedYear',
  'employees',
  'ownerManaged',
  'portrait',
]
export const NOMINATION_REQUIRED: Array<keyof NominationData> = ['companyName', 'city', 'reason']

export const SELF_REQUIRED_COUNT = SELF_REQUIRED.length
export const NOMINATION_REQUIRED_COUNT = NOMINATION_REQUIRED.length

/** Feld → Fehlermeldung. Leer = alles in Ordnung. */
export type FieldErrors = Partial<Record<string, string>>

export const looksLikeUrl = (value: string) => /^(https?:\/\/)?[^\s/]+\.[^\s]{2,}$/i.test(value.trim())

export function validateSelf(data: SelfData): FieldErrors {
  const copy = portalContent.submission.errors
  const errors: FieldErrors = {}
  for (const key of SELF_REQUIRED) {
    if (!String(data[key]).trim()) errors[key] = copy.requiredBy[key] ?? copy.required
  }
  if (!errors.zip && !/^\d{5}$/.test(data.zip.trim())) errors.zip = copy.zip
  if (!errors.foundedYear) {
    if (!/^\d{4}$/.test(data.foundedYear.trim())) errors.foundedYear = copy.year
    else if (Number(data.foundedYear) > new Date().getFullYear()) errors.foundedYear = copy.yearFuture
  }
  if (data.website.trim() && !looksLikeUrl(data.website)) errors.website = copy.url
  if (data.portrait.length > LIMITS.portrait) errors.portrait = copy.tooLong(LIMITS.portrait)
  return errors
}

export function validateNomination(data: NominationData): FieldErrors {
  const copy = portalContent.submission.errors
  const errors: FieldErrors = {}
  for (const key of NOMINATION_REQUIRED) {
    if (!data[key].trim()) errors[key] = copy.requiredBy[key] ?? copy.required
  }
  if (data.website.trim() && !looksLikeUrl(data.website)) errors.website = copy.url
  if (data.reason.length > LIMITS.reason) errors.reason = copy.tooLong(LIMITS.reason)
  return errors
}

/** Alle Fehler einer Anmeldung je nach Weg. */
export const validateRegistration = (type: SubmissionType, self: SelfData, nomination: NominationData): FieldErrors =>
  type === 'eigenbewerbung' ? validateSelf(self) : validateNomination(nomination)
