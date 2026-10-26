/**
 * Bewerbung (Phase 02): je gewähltem Preis ein Fragebogen plus sechs feste Unterlagen. Die Bewerbung ist vollständig,
 * sobald alle Fragebögen eingereicht und alle Unterlagen hochgeladen sind – dann setzen die Befehle den Stand auf
 * `eingereicht` (`domain/commands.ts`). Die Jury sieht danach Antworten und Dateien.
 *
 * Reines TypeScript: Prüfregeln für Dateien gelten im Browser (Vorabprüfung) und auf dem Server (verbindlich).
 */

import type { AppDocKey, PrizeId, ProcessState } from '@/portal/domain/types'

/* ── Unterlagen ─────────────────────────────────────────────────────────── */

/**
 * Die sechs Unterlagen je Unternehmen. Platzhalter – welche Unterlagen nötig sind, legt die Geschäftsstelle fest.
 * Jeder Platz nimmt alle üblichen Formate an (PDF, Word, Excel, PowerPoint, OpenDocument, Bilder).
 */
export const APPLICATION_DOCS: Array<{ key: AppDocKey; label: string; hint: string }> = [
  { key: 'praesentation', label: 'Unternehmenspräsentation', hint: 'Zum Beispiel als PDF oder PowerPoint.' },
  { key: 'jahresabschluss', label: 'Jahresabschlüsse der letzten drei Jahre', hint: 'Zum Beispiel als PDF oder Excel.' },
  { key: 'kennzahlen', label: 'Kennzahlenübersicht', hint: 'Umsatz, Mitarbeiter und Ergebnis je Jahr, zum Beispiel als Excel.' },
  { key: 'handelsregister', label: 'Handelsregisterauszug', hint: 'Nicht älter als drei Monate, zum Beispiel als PDF.' },
  { key: 'organigramm', label: 'Organigramm', hint: 'Zum Beispiel als PDF oder Bild.' },
  { key: 'referenzen', label: 'Referenz- oder Empfehlungsschreiben', hint: 'Zum Beispiel als PDF oder Word.' },
]

export const APP_DOC_KEYS: AppDocKey[] = APPLICATION_DOCS.map((doc) => doc.key)

/** Erlaubte Dateiendungen je Format – Grundlage für `accept` im Dateifeld und für die Prüfung beim Hochladen. */
const FORMATS: Array<{ label: string; extensions: string[] }> = [
  { label: 'PDF', extensions: ['pdf'] },
  { label: 'Word', extensions: ['doc', 'docx', 'odt', 'rtf'] },
  { label: 'Excel', extensions: ['xls', 'xlsx', 'ods', 'csv'] },
  { label: 'PowerPoint', extensions: ['ppt', 'pptx', 'odp'] },
  { label: 'Bild', extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff'] },
  { label: 'Text', extensions: ['txt'] },
]

export const ACCEPTED_EXTENSIONS = FORMATS.flatMap((format) => format.extensions)

/** Für `<input type="file" accept=…>`. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(',')

/** Höchstgröße je Datei. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

const extensionOf = (fileName: string) => (fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '')

/** Format einer Datei für die Anzeige („PDF“, „Excel“ …). */
export const fileFormat = (fileName: string) => FORMATS.find((format) => format.extensions.includes(extensionOf(fileName)))?.label ?? 'Datei'

/** Dateigröße lesbar, z. B. „2,4 MB“. */
export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('de-DE')} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

export const FILE_ERRORS = {
  missing: 'Bitte wählen Sie eine Datei aus.',
  format: 'Dieses Format wird nicht angenommen. Erlaubt sind PDF, Word, Excel, PowerPoint, OpenDocument und Bilder.',
  size: `Die Datei ist zu groß. Erlaubt sind höchstens ${formatBytes(MAX_FILE_BYTES)} je Datei.`,
  empty: 'Die Datei ist leer.',
} as const

/** Prüft eine Datei vor dem Hochladen; `undefined` = in Ordnung. */
export function checkUpload(fileName: string, size: number): string | undefined {
  if (!fileName.trim()) return FILE_ERRORS.missing
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(fileName))) return FILE_ERRORS.format
  if (!Number.isFinite(size) || size <= 0) return FILE_ERRORS.empty
  if (size > MAX_FILE_BYTES) return FILE_ERRORS.size
  return undefined
}

/* ── Stand der Bewerbung ─────────────────────────────────────────────────── */

/**
 * Wie weit die Bewerbung ist. `released`: Preise, deren Fragebogen freigeschaltet ist – gewählte Preise ohne
 * freigeschalteten Fragebogen stehen in `waiting` (die Verwaltung muss ihn erst bereitstellen).
 */
export function applicationProgress(process: ProcessState, released: readonly PrizeId[]) {
  const chosen = process.prizes
  const submitted = chosen.filter((prize) => process.questionnaires[prize]?.status === 'eingereicht')
  const open = chosen.filter((prize) => !submitted.includes(prize))
  const uploaded = APP_DOC_KEYS.filter((key) => process.applicationDocs[key]).length
  return {
    chosen: chosen.length,
    submitted: submitted.length,
    /** Gewählt, Fragebogen freigeschaltet, noch nicht eingereicht. */
    open: open.filter((prize) => released.includes(prize)),
    /** Gewählt, aber der Fragebogen ist noch nicht freigeschaltet. */
    waiting: open.filter((prize) => !released.includes(prize)),
    docs: { uploaded, total: APP_DOC_KEYS.length },
    started: chosen.length > 0 || uploaded > 0,
    complete: chosen.length > 0 && submitted.length === chosen.length && uploaded === APP_DOC_KEYS.length,
  }
}

/** Unterlagen lassen sich austauschen, bis der Vorgang der Jury zugewiesen ist. */
export const docsEditable = (process: ProcessState) => process.application !== 'gesperrt' && process.jury === 'nicht_zugewiesen'

export const applicationOpen = (process: ProcessState) => process.application === 'verfuegbar' || process.application === 'in_bearbeitung'
