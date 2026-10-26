/**
 * Was welche Rolle sehen darf – die Referenz für jede Antwort des Backends.
 *
 * Die Oberfläche blendet Vertrauliches ohnehin aus; das reicht im echten System nicht, weil alles, was der Server
 * schickt, im Browser lesbar ist. Deshalb filtert das Backend jede Antwort mit `visibleTo`. Der Prototyp tut dasselbe,
 * sobald Sitzung und Ansicht zusammenpassen (siehe ui/PortalApp.tsx) – so ist belegt, dass die Oberfläche mit den
 * gefilterten Daten auskommt.
 */

import type { Actor } from '@/portal/domain/permissions'
import type { Account, PortalData, ProcessState, QuestionnaireDefinition, Submission } from '@/portal/domain/types'

/** Zugangsdaten verlassen nie den Server. Ausnahme Prototyp: Testpasswörter für die Verwaltung (Rechte & Benutzer). */
const withoutSecrets = (account: Account, keepDemoPassword: boolean): Account => {
  const { passwordHash: _hash, demoPassword, ...rest } = account
  return { ...rest, passwordHash: '', ...(keepDemoPassword && demoPassword ? { demoPassword } : {}) }
}

/** Vertrauliches eines Vorgangs, das nur die Verwaltung sieht: Stimmen, Punkte, Besetzung, Verlauf, vorbereitetes Ergebnis. */
const applicantProcess = (process: ProcessState): ProcessState => ({
  ...process,
  assigned: { jury1: [], jury2: [] },
  jury1: {},
  jury2: {},
  log: [],
  result: process.result === 'vorbereitet' ? 'ausstehend' : process.result,
})

/** Fragebögen im Entwurf kennt nur die Verwaltung; alle anderen sehen nur, dass es sie gibt (für „Fragebogen folgt“). */
const releasedOnly = (definitions: QuestionnaireDefinition[]) =>
  definitions.map((definition) => (definition.status === 'freigeschaltet' ? definition : { ...definition, sections: [] }))

/** Jury: nur eingereichte Fragebögen der gewählten Preise – keine Entwürfe abgewählter Preise. */
const submittedApplication = (process: ProcessState): Pick<ProcessState, 'questionnaires'> => ({
  questionnaires: Object.fromEntries(process.prizes.filter((prize) => process.questionnaires[prize]?.status === 'eingereicht').map((prize) => [prize, process.questionnaires[prize]])),
})

export function visibleTo(data: PortalData, actor: Actor): PortalData {
  const base = { round: data.round, roundSettings: data.roundSettings }

  switch (actor.kind) {
    case 'staff':
      // Die Verwaltung sieht alle Vorgänge; Testpasswörter nur mit dem Recht, Zugänge zu verwalten.
      return {
        ...base,
        submissions: data.submissions,
        jurors: data.jurors,
        questionnaires: data.questionnaires,
        accounts: data.accounts.map((account) => withoutSecrets(account, actor.role === 'verwaltung')),
      }

    case 'jury': {
      // Ein Jurymitglied sieht nur die ihm zugewiesenen Bewerbungen (Fragebögen und Unterlagen) und nur die eigene Bewertung.
      const own = (process: ProcessState): ProcessState => ({
        ...applicantProcess(process),
        ...submittedApplication(process),
        assigned: { jury1: [], jury2: [], [actor.role]: [actor.jurorId] } as ProcessState['assigned'],
        jury1: actor.role === 'jury1' && process.jury1[actor.jurorId] ? { [actor.jurorId]: process.jury1[actor.jurorId] } : {},
        jury2: actor.role === 'jury2' && process.jury2[actor.jurorId] !== undefined ? { [actor.jurorId]: process.jury2[actor.jurorId] } : {},
        documents: undefined,
      })
      const submissions = data.submissions
        .filter((submission) => submission.status === 'eingereicht' && submission.process.jury !== 'nicht_zugewiesen')
        .filter((submission) => submission.process.assigned[actor.role].includes(actor.jurorId))
        .map((submission): Submission => ({ ...submission, process: own(submission.process) }))
      return {
        ...base,
        submissions,
        jurors: data.jurors.filter((juror) => juror.id === actor.jurorId),
        questionnaires: releasedOnly(data.questionnaires),
        accounts: data.accounts.filter((account) => account.id === actor.accountId).map((account) => withoutSecrets(account, false)),
      }
    }

    case 'applicant':
      // Bewerber sehen nur eigene Vorgänge, ohne interne Jury- und Verlaufsdaten. Offene Entscheidung: Bei einer
      // Fremdnominierung sieht die vorschlagende Person im Prototyp noch Fragebögen und Unterlagen (Demo-Übergabe).
      return {
        ...base,
        submissions: data.submissions
          .filter((submission) => submission.accountId === actor.accountId)
          .map((submission) => ({ ...submission, process: applicantProcess(submission.process) })),
        jurors: [],
        questionnaires: releasedOnly(data.questionnaires),
        accounts: data.accounts.filter((account) => account.id === actor.accountId).map((account) => withoutSecrets(account, false)),
      }

    case 'anonymous':
      return { ...base, submissions: [], jurors: [], questionnaires: [], accounts: [] }
  }
}
