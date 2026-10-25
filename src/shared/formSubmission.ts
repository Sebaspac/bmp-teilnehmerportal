/**
 * Gemeinsame Formularregeln, übernommen aus dem Website-Projekt (src/spa/components/forms/formSubmission.ts), damit
 * Portal und Website E-Mail-Adressen gleich prüfen. Reine Funktionen ohne Server- oder Browser-Abhängigkeiten.
 */

/**
 * E-Mail-Prüfung wie Payloads Feldtyp `email`: nur ASCII, keine zwei Punkte hintereinander, Endung aus Buchstaben.
 * Strenger als ein einfaches „x@y.z“, damit nichts durchkommt, was Payload beim Speichern ablehnen würde.
 */
export const submissionEmailPattern =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

export const isValidSubmissionEmail = (value: string) => submissionEmailPattern.test(value.trim())

/** Seite mit der Datenschutzerklärung (Link neben dem Einwilligungs-Häkchen) – liegt auf der Website derselben Domain. */
export const PRIVACY_POLICY_PATH = '/datenschutz'
