/**
 * Prozessmodell: Aus dem Zustand eines Vorgangs werden für alle Ansichten (Bewerber, Verwaltung, Jury) Hauptphase
 * (Ebene A), Detailstatus (Ebene B) und nächste Handlung (Ebene C) abgeleitet. So zeigen alle Perspektiven denselben
 * Stand. Grundlage: Draw.io-Konzept (Phase A Anmeldung, Phase B Zahlung & Fragebogen, Phase C Jury 1/Jury 2) und die
 * vier verbindlichen Bewerberphasen.
 *
 * Nur Ableitungen und Bezeichnungen – keine Zustandsänderungen. Welche Übergänge erlaubt sind: `domain/commands.ts`.
 * Reines TypeScript, auch serverseitig nutzbar (z. B. für E-Mail-Texte oder Exporte).
 */

import { prizesOf } from '@/portal/domain/questionnaire'
import {
  DOC_KEYS,
  type DocKey,
  type DocStatus,
  type JuryStage,
  type JuryType,
  type PaymentStatus,
  type ProcessState,
  type QuestionnaireStatus,
  type ResultStatus,
  type ReviewStatus,
  type RoundStatus,
  type SubmissionType,
} from '@/portal/domain/types'

/* ── Gewinnerunterlagen & Medienstatus ─────────────────────────────────── */

/** Beispielliste (Platzhalter) – welche Unterlagen nötig sind, legt die Geschäftsstelle fest. */
export const DOC_META: Record<DocKey, { label: string; hint: string; kind: 'file' | 'text'; accept?: string; maxLength?: number }> = {
  logo: { label: 'Logo', hint: 'Vektor (SVG, EPS, PDF) oder PNG mit transparentem Hintergrund.', kind: 'file', accept: '.svg,.eps,.pdf,.png' },
  foto: { label: 'Pressefoto', hint: 'Querformat, mindestens 2.000 px breit, mit Bildnachweis.', kind: 'file', accept: '.jpg,.jpeg,.png,.tif,.tiff' },
  portraet: { label: 'Kurzporträt für Gala und Presse', hint: 'Höchstens 1.000 Zeichen, sachlich, in der dritten Person.', kind: 'text', maxLength: 1000 },
  pressekontakt: { label: 'Pressekontakt', hint: 'Name, E-Mail und Telefon der Ansprechperson für Presseanfragen.', kind: 'text', maxLength: 300 },
}

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  offen: 'offen',
  eingereicht: 'eingereicht',
  geprueft: 'geprüft',
  nachbesserung: 'Nachbesserung erbeten',
}

/** Stand der Unterlagen: angefordert, eingereicht (warten auf Prüfung), geprüft, offen beim Unternehmen. */
export function documentsProgress(process: ProcessState) {
  const items = process.documents ? DOC_KEYS.map((key) => process.documents!.items[key]) : []
  return {
    requested: Boolean(process.documents),
    total: DOC_KEYS.length,
    approved: items.filter((item) => item.status === 'geprueft').length,
    submitted: items.filter((item) => item.status === 'eingereicht').length,
    open: items.filter((item) => item.status === 'offen' || item.status === 'nachbesserung').length,
  }
}

/* ── Ebene A: die vier Hauptphasen ───────────────────────────────────────── */

export type PhaseNumber = 1 | 2 | 3 | 4

export const PHASES: Array<{ number: PhaseNumber; title: string; short: string; summary: string }> = [
  {
    number: 1,
    title: 'Anmeldung läuft',
    short: 'Anmeldung',
    summary: 'Die Anmeldung ist eingegangen und wird geprüft. Ein Fragebogen ist noch nicht nötig.',
  },
  {
    number: 2,
    title: 'Fragebogen wird freigeschaltet',
    short: 'Fragebogen',
    summary:
      'Nach der Prüfung folgt die Rechnung über die Teilnahmegebühr, bei einer Fremdnominierung an das vorgeschlagene Unternehmen. Nach Zahlungseingang wird der Bewerbungsfragebogen freigeschaltet.',
  },
  {
    number: 3,
    title: 'Auditsitzung der Jury',
    short: 'Jury',
    summary: 'Die Jury bewertet die eingereichten Bewerbungsunterlagen. Bewertungen bleiben vertraulich.',
  },
  {
    number: 4,
    title: 'Einladung zur Gala',
    short: 'Gala',
    summary: 'Es wird mitgeteilt, ob eine Einladung zur Gala vorliegt.',
  },
]

/* ── Ebene B: Detailstatus mit Bedeutung ─────────────────────────────────── */

export type Tone = 'neu' | 'wartend' | 'aktion' | 'freigeschaltet' | 'bearbeitung' | 'abgeschlossen' | 'einladung' | 'neutral'

export const TONE_LABEL: Record<Tone, string> = {
  neu: 'Neu',
  wartend: 'Wartend',
  aktion: 'Aktion erforderlich',
  freigeschaltet: 'Freigeschaltet',
  bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  einladung: 'Einladung',
  neutral: 'Abgeschlossen',
}

export type StepState = 'done' | 'current' | 'upcoming' | 'closed'

export type ApplicantView = {
  phase: PhaseNumber
  status: { label: string; tone: Tone }
  title: string
  description: string
  /** Ebene C: Was als Nächstes passiert und ob der Bewerber handeln muss. */
  next: { label: string; mustAct: boolean; action?: NextActionKind; deadline?: string }
  steps: Array<{ number: PhaseNumber; title: string; state: StepState; note: string }>
  /** hidden = bei Fremdnominierung: Inhalte gehören dem Unternehmen, die vorschlagende Person sieht nur den Stand. */
  questionnaireAccess: 'locked' | 'open' | 'readonly' | 'handover' | 'hidden'
  /** Sichtbare Zusatzhinweise (z. B. Demo-Übergabe bei Fremdnominierung). */
  demoNote?: string
}

export type NextActionKind =
  | 'viewRegistration'
  | 'checkCompanyData'
  | 'viewPayment'
  | 'editQuestionnaire'
  | 'viewQuestionnaire'
  | 'viewInvitation'
  | 'demoHandover'
  | 'changePrizes'
  | 'uploadDocuments'


/** Aus dem Prozesszustand die eine Hauptphase. Rechnung & Zahlung ist Teil von Phase 02, keine eigene Phase. */
export function phaseOf(process: ProcessState): PhaseNumber {
  if (process.jury === 'abgeschlossen' || process.result === 'einladung' || process.result === 'keine_einladung') return 4
  if (process.jury !== 'nicht_zugewiesen') return 3
  if (process.review === 'geprueft') return 2
  return 1
}

const NOMINATOR_RESULT_NOTE = 'Demo-Annahme: Ob vorschlagende Personen das Ergebnis erfahren, ist noch nicht entschieden.'

/** Gewählte Preise, für die es (noch) keinen Fragebogen gibt – und keiner mit Fragebogen. */
export function onlyPendingPrizes(process: ProcessState) {
  const prizes = prizesOf(process.answers)
  return process.questionnaire !== 'eingereicht' && prizes.length > 0 && !prizes.some((prize) => prize.hasQuestionnaire)
}

/** Warum der Fragebogen gerade gesperrt ist – immer die tatsächlich offene Voraussetzung, passend zur Zeitleiste. */
export function questionnaireLockReason(process: ProcessState, kind: SubmissionType | null): string {
  if (kind === 'fremdvorschlag') return 'Geht nach der Prüfung an das vorgeschlagene Unternehmen, nicht an Sie (Demo-Annahme).'
  if (process.review !== 'geprueft') return 'Wird nach der Prüfung Ihrer Anmeldung und dem Eingang der Teilnahmegebühr freigeschaltet.'
  if (process.payment === 'rechnung_offen') return 'Wird freigeschaltet, sobald Ihre Zahlung eingegangen ist.'
  if (process.payment === 'zahlung_eingegangen') return 'Ihre Zahlung ist eingegangen. Die Geschäftsstelle schaltet den Fragebogen in Kürze frei.'
  return 'Ihre Anmeldung ist geprüft. Nach Rechnung und Zahlungseingang wird der Fragebogen freigeschaltet.'
}

/** Bewerberansicht – zeigt nie interne Jury-Details, Notizen oder vorbereitete (nicht freigegebene) Ergebnisse. */
export function applicantView(process: ProcessState, kind: SubmissionType | null, company = ''): ApplicantView {
  const phase = phaseOf(process)
  const isNomination = kind === 'fremdvorschlag'
  // Bei einer Fremdnominierung ist es nicht „Ihr Unternehmen“, sondern das vorgeschlagene.
  const subject = isNomination ? company || 'das vorgeschlagene Unternehmen' : 'Ihr Unternehmen'
  let view: Omit<ApplicantView, 'steps' | 'phase'>

  if (phase === 1) {
    // Bei einer Fremdnominierung endet die Aufgabe der vorschlagenden Person mit dem Vorschlag.
    const what = isNomination ? 'Ihre Fremdnominierung' : 'Ihre Anmeldung'
    if (process.review === 'rueckfrage') {
      // Im Portal gibt es (noch) keine Nachrichten: Die Geschäftsstelle meldet sich direkt – ein Wartezustand, keine Sackgasse.
      view = {
        status: { label: 'Rückfrage', tone: 'wartend' },
        title: 'Anmeldung läuft',
        description: `Die Geschäftsstelle hat eine Rückfrage zu ${isNomination ? 'Ihrer Fremdnominierung' : 'Ihrer Anmeldung'} und meldet sich per E-Mail oder Telefon bei Ihnen. Danach wird die Prüfung fortgesetzt.`,
        next: { label: 'Die Geschäftsstelle meldet sich mit ihrer Rückfrage', mustAct: false, action: 'viewRegistration' },
        questionnaireAccess: 'locked',
      }
    } else if (process.review === 'in_pruefung') {
      view = {
        status: { label: 'In Prüfung', tone: 'wartend' },
        title: 'Anmeldung läuft',
        description: isNomination
          ? `${what} für ${subject} wird derzeit geprüft. Danach wird das Unternehmen informiert. Für Sie ist nichts weiter zu tun.`
          : 'Ihre Anmeldung wird derzeit geprüft. Danach erhalten Sie die Rechnung über die Teilnahmegebühr; nach Zahlungseingang wird der Bewerbungsfragebogen freigeschaltet.',
        next: { label: 'Auf Prüfung warten', mustAct: false, action: 'viewRegistration' },
        questionnaireAccess: 'locked',
      }
    } else {
      view = {
        status: { label: 'Neu eingegangen', tone: 'neu' },
        title: 'Anmeldung läuft',
        description: isNomination
          ? `${what} für ${subject} ist eingegangen. Die Geschäftsstelle prüft sie und informiert anschließend das Unternehmen. Für Sie ist nichts weiter zu tun.`
          : 'Ihre Anmeldung ist eingegangen. Derzeit prüfen wir die Angaben. Danach erhalten Sie die Rechnung über die Teilnahmegebühr; nach Zahlungseingang wird der Bewerbungsfragebogen freigeschaltet.',
        next: { label: 'Auf Prüfung warten', mustAct: false, action: 'viewRegistration' },
        questionnaireAccess: 'locked',
      }
    }
  } else if (phase === 2) {
    if (isNomination && process.questionnaire !== 'eingereicht') {
      view =
        process.questionnaire === 'gesperrt'
          ? {
              status: { label: process.payment === 'keine_rechnung' ? 'Unternehmen wird informiert' : 'Unternehmen informiert', tone: 'wartend' },
              title: 'Fragebogen wird freigeschaltet',
              description:
                process.payment === 'keine_rechnung'
                  ? `Ihre Fremdnominierung ist geprüft. Als Nächstes wird ${subject} informiert und erhält den Bewerbungsfragebogen. Sie müssen nichts weiter tun.`
                  : `Ihre Fremdnominierung ist geprüft. ${subject} ist informiert und erhält Rechnung und Bewerbungsfragebogen. Sie müssen nichts weiter tun.`,
              next: { label: 'Auf das Unternehmen warten', mustAct: false },
              questionnaireAccess: 'handover',
              demoNote: 'Demo-Annahme: Rechnung und Fragebogen gehen bei einer Fremdnominierung an das vorgeschlagene Unternehmen. Die Zuständigkeit ist noch nicht entschieden.',
            }
          : {
              status: { label: 'Beim vorgeschlagenen Unternehmen', tone: 'wartend' },
              title: 'Fragebogen wird freigeschaltet',
              description: `Der Bewerbungsfragebogen liegt bei ${subject}. Sie müssen nichts weiter tun.`,
              next: { label: 'Auf das Unternehmen warten', mustAct: false, action: 'demoHandover' },
              questionnaireAccess: 'handover',
              demoNote: 'Demo-Zustand: Wer den Fragebogen bei einer Fremdnominierung ausfüllt, ist noch nicht entschieden.',
            }
    } else if (process.questionnaire === 'gesperrt') {
      if (process.payment === 'rechnung_offen') {
        view = {
          status: { label: 'Rechnung offen', tone: 'aktion' },
          title: 'Fragebogen wird freigeschaltet',
          description: 'Ihre Anmeldung ist geprüft. Für die Teilnahme liegt eine Rechnung vor. Nach dem Zahlungseingang wird der Bewerbungsfragebogen freigeschaltet.',
          next: { label: 'Rechnung begleichen', mustAct: true, action: 'viewPayment' },
          questionnaireAccess: 'locked',
        }
      } else {
        view = {
          status: process.payment === 'zahlung_eingegangen' ? { label: 'Zahlung eingegangen', tone: 'wartend' } : { label: 'Rechnung folgt', tone: 'wartend' },
          title: 'Fragebogen wird freigeschaltet',
          description:
            process.payment === 'zahlung_eingegangen'
              ? 'Ihre Zahlung ist eingegangen. Der Bewerbungsfragebogen wird in Kürze für Sie freigeschaltet.'
              : 'Ihre Anmeldung ist geprüft. Wir bereiten den nächsten Schritt vor und informieren Sie, sobald der Bewerbungsfragebogen freigeschaltet ist.',
          next: { label: 'Auf Freigabe warten', mustAct: false },
          questionnaireAccess: 'locked',
        }
      }
    } else if (process.questionnaire === 'eingereicht') {
      view = {
        status: { label: 'Fragebogen eingereicht', tone: 'abgeschlossen' },
        title: 'Fragebogen eingereicht',
        description: isNomination
          ? `Der Bewerbungsfragebogen für ${subject} ist eingegangen. Als Nächstes wird er der Jury zur Bewertung vorgelegt.`
          : 'Ihr Bewerbungsfragebogen ist eingegangen. Als Nächstes wird er der Jury zur Bewertung vorgelegt; Sie müssen nichts weiter tun.',
        next: isNomination ? { label: 'Juryprüfung abwarten', mustAct: false } : { label: 'Juryprüfung abwarten', mustAct: false, action: 'viewQuestionnaire' },
        questionnaireAccess: isNomination ? 'hidden' : 'readonly',
      }
    } else if (onlyPendingPrizes(process)) {
      // Nur Preise gewählt, für die noch kein Fragebogen hinterlegt ist: nichts zu tun, keine Frist.
      const titles = prizesOf(process.answers).map((prize) => prize.title)
      view = {
        status: { label: 'Fragebogen folgt', tone: 'wartend' },
        title: 'Fragebogen folgt',
        description: `Für ${titles.map((title) => `den ${title}`).join(' und ')} ist noch kein Fragebogen hinterlegt. Sobald er vorliegt, informieren wir Sie. Ihre Preisauswahl können Sie bis dahin ändern.`,
        next: { label: 'Auf den Fragebogen warten', mustAct: false, action: 'changePrizes' },
        questionnaireAccess: 'open',
      }
    } else if (process.questionnaire === 'in_bearbeitung') {
      view = {
        status: { label: 'In Bearbeitung', tone: 'bearbeitung' },
        title: 'Ihr Bewerbungsfragebogen ist in Bearbeitung',
        description: 'Sie haben mit dem Bewerbungsfragebogen begonnen. Ihre Angaben sind zwischengespeichert; reichen Sie ihn ein, wenn alles vollständig ist.',
        next: { label: 'Fragebogen fortsetzen', mustAct: true, action: 'editQuestionnaire', deadline: process.deadline },
        questionnaireAccess: 'open',
      }
    } else {
      view = {
        status: { label: 'Fragebogen verfügbar', tone: 'freigeschaltet' },
        title: 'Ihr Bewerbungsfragebogen ist freigeschaltet',
        description: 'Wählen Sie die Preise, für die Sie sich bewerben – einen oder mehrere –, und füllen Sie anschließend den Bewerbungsfragebogen aus.',
        next: { label: 'Fragebogen bearbeiten', mustAct: true, action: 'editQuestionnaire', deadline: process.deadline },
        questionnaireAccess: 'open',
      }
    }
  } else if (phase === 3) {
    view = {
      status: process.jury === 'zugewiesen' ? { label: 'Juryprüfung ausstehend', tone: 'wartend' } : { label: 'In Juryprüfung', tone: 'wartend' },
      title: 'Auditsitzung der Jury',
      description: isNomination
        ? `Die Bewerbungsunterlagen von ${subject} werden im Rahmen des Juryverfahrens bewertet.`
        : 'Die eingereichten Bewerbungsunterlagen werden im Rahmen des Juryverfahrens bewertet.',
      next: isNomination ? { label: 'Juryentscheidung abwarten', mustAct: false } : { label: 'Juryentscheidung abwarten', mustAct: false, action: 'viewQuestionnaire' },
      questionnaireAccess: isNomination ? 'hidden' : 'readonly',
    }
  } else if (process.result === 'einladung') {
    view = {
      status: { label: 'Einladung liegt vor', tone: 'einladung' },
      title: 'Einladung zur Gala',
      description: isNomination
        ? `Für ${subject} liegt eine Einladung zur Gala des Bayerischen Mittelstandspreises vor. Die Einladung erhält das Unternehmen direkt.`
        : `Für ${subject} liegt eine Einladung zur Gala des Bayerischen Mittelstandspreises vor.`,
      // Die Einladung gilt dem Unternehmen; die vorschlagende Person sieht nur den Stand, nicht den Brief.
      next: isNomination
        ? { label: 'Die Einladung ist an das Unternehmen gegangen', mustAct: false }
        : documentsProgress(process).requested && documentsProgress(process).open > 0
          ? { label: 'Unterlagen für Gala und Presse einreichen', mustAct: true, action: 'uploadDocuments' }
          : { label: 'Einladung ansehen', mustAct: true, action: 'viewInvitation' },
      questionnaireAccess: isNomination ? 'hidden' : 'readonly',
      demoNote: isNomination ? NOMINATOR_RESULT_NOTE : undefined,
    }
  } else if (process.result === 'keine_einladung') {
    view = {
      status: { label: 'Abgeschlossen', tone: 'neutral' },
      title: 'Verfahren abgeschlossen',
      description: isNomination
        ? 'Das Auswahlverfahren ist abgeschlossen. Für das vorgeschlagene Unternehmen ist keine Einladung vorgesehen. Vielen Dank für Ihren Vorschlag.'
        : 'Das aktuelle Auswahlverfahren ist abgeschlossen. Vielen Dank für Ihre Teilnahme.',
      next: { label: 'Keine weiteren Schritte', mustAct: false },
      questionnaireAccess: isNomination ? 'hidden' : 'readonly',
      demoNote: isNomination ? NOMINATOR_RESULT_NOTE : undefined,
    }
  } else {
    // Juryprüfung abgeschlossen; ein intern vorbereitetes Ergebnis bleibt bis zur Freigabe unsichtbar.
    view = {
      status: { label: 'Entscheidung ausstehend', tone: 'wartend' },
      title: 'Einladung zur Gala',
      description: isNomination
        ? `Die Juryprüfung ist abgeschlossen. Die Entscheidung über eine Einladung zur Gala für ${subject} steht noch aus.`
        : 'Die Juryprüfung ist abgeschlossen. Wir informieren Sie, sobald die Entscheidung über eine Einladung zur Gala vorliegt.',
      next: { label: 'Entscheidung abwarten', mustAct: false },
      questionnaireAccess: isNomination ? 'hidden' : 'readonly',
    }
  }

  return { ...view, phase, steps: phaseSteps(process, phase, view.status.label) }
}

function phaseSteps(process: ProcessState, phase: PhaseNumber, currentLabel: string): ApplicantView['steps'] {
  const doneNote: Record<PhaseNumber, string> = {
    1: 'Anmeldung geprüft',
    2: 'Fragebogen eingereicht',
    3: 'Juryprüfung abgeschlossen',
    4: '',
  }
  const upcomingNote: Record<PhaseNumber, string> = {
    1: '',
    2: 'Noch nicht freigeschaltet',
    3: process.questionnaire === 'eingereicht' ? 'Folgt in Kürze' : 'Folgt nach dem Fragebogen',
    4: 'Entscheidung ausstehend',
  }
  return PHASES.map(({ number, title }) => {
    if (number < phase) return { number, title, state: 'done' as const, note: doneNote[number] }
    if (number > phase) return { number, title, state: 'upcoming' as const, note: upcomingNote[number] }
    // Phasenname bleibt der offizielle; der Ausgang steht in der Notiz.
    if (number === 4 && process.result === 'keine_einladung') return { number, title, state: 'closed' as const, note: 'Keine Einladung · Verfahren abgeschlossen' }
    return { number, title, state: 'current' as const, note: currentLabel }
  })
}

/* ── Administration: Bezeichnungen & Voraussetzungen ─────────────────────── */

export type Party = 'verwaltung' | 'bewerber' | 'unternehmen' | 'jury' | 'niemand'

export const PARTY_LABEL: Record<Party, string> = {
  verwaltung: 'Verwaltung',
  bewerber: 'Bewerber',
  unternehmen: 'Vorgeschlagenes Unternehmen',
  jury: 'Jury',
  niemand: 'Abgeschlossen',
}

/** Ebene C für die Verwaltung: Wer ist am Zug und was ist zu tun? Gleiche Begriffe wie die Steuerung im Vorgang. */
export function adminNext(process: ProcessState, kind: SubmissionType | null = null): { label: string; party: Party } {
  // Bei einer Fremdnominierung handelt nach der Prüfung das vorgeschlagene Unternehmen, nicht die vorschlagende Person.
  const applicant: Party = kind === 'fremdvorschlag' ? 'unternehmen' : 'bewerber'
  if (process.review === 'neu') return { label: 'Anmeldung prüfen', party: 'verwaltung' }
  if (process.review === 'in_pruefung') return { label: 'Prüfung abschließen', party: 'verwaltung' }
  if (process.review === 'rueckfrage') return { label: 'Rückfrage klären', party: 'verwaltung' }
  if (process.questionnaire === 'gesperrt') {
    if (process.payment === 'keine_rechnung') return { label: 'Rechnung stellen', party: 'verwaltung' }
    if (process.payment === 'rechnung_offen') return { label: 'Zahlung abwarten', party: applicant }
    return { label: 'Fragebogen freigeben', party: 'verwaltung' }
  }
  if (onlyPendingPrizes(process)) return { label: 'Fragebogen für die gewählten Preise bereitstellen', party: 'verwaltung' }
  if (process.questionnaire !== 'eingereicht') return { label: 'Fragebogen abwarten', party: applicant }
  if (process.jury === 'nicht_zugewiesen') return { label: 'Der Jury zuweisen', party: 'verwaltung' }
  if (process.jury === 'zugewiesen') return { label: 'Jury 1 starten', party: 'verwaltung' }
  if (process.jury === 'jury1' || process.jury === 'jury2') {
    const progress = juryProgress(process)[process.jury]
    const label = process.jury === 'jury1' ? 'Ersteinschätzung läuft' : 'Punktevergabe läuft'
    return progress.done >= progress.assigned && progress.assigned > 0
      ? { label: process.jury === 'jury1' ? 'Jury 2 starten' : 'Juryprüfung abschließen', party: 'verwaltung' }
      : { label: `${label} (${progress.done}/${progress.assigned})`, party: 'jury' }
  }
  if (process.result === 'einladung') {
    const docs = documentsProgress(process)
    if (!docs.requested) return { label: 'Einladung freigegeben', party: 'niemand' }
    if (docs.submitted > 0) return { label: 'Unterlagen prüfen', party: 'verwaltung' }
    if (docs.open > 0) return { label: 'Unterlagen abwarten', party: applicant }
    return { label: 'Unterlagen vollständig', party: 'niemand' }
  }
  if (process.result === 'keine_einladung') return { label: 'Verfahren abgeschlossen', party: 'niemand' }
  return { label: 'Ergebnis festlegen', party: 'verwaltung' }
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  neu: 'Neu eingegangen',
  in_pruefung: 'In Prüfung',
  rueckfrage: 'Rückfrage erforderlich',
  geprueft: 'Geprüft · für Fragebogen vorgemerkt',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  keine_rechnung: 'Keine Rechnung gestellt',
  rechnung_offen: 'Rechnung offen',
  zahlung_eingegangen: 'Zahlung als eingegangen markiert',
}

export const QUESTIONNAIRE_LABEL: Record<QuestionnaireStatus, string> = {
  gesperrt: 'Gesperrt',
  verfuegbar: 'Freigegeben',
  in_bearbeitung: 'In Bearbeitung',
  eingereicht: 'Eingereicht',
}

export const JURY_LABEL: Record<JuryStage, string> = {
  nicht_zugewiesen: 'Nicht zugewiesen',
  zugewiesen: 'Zugewiesen',
  jury1: 'Jury 1 · Ersteinschätzung',
  jury2: 'Jury 2 · Punktevergabe',
  abgeschlossen: 'Abgeschlossen',
}

export const RESULT_LABEL: Record<ResultStatus, string> = {
  ausstehend: 'Entscheidung ausstehend',
  vorbereitet: 'Einladung vorbereitet (intern)',
  einladung: 'Einladung freigegeben',
  keine_einladung: 'Keine Einladung',
}

export const ROUND_LABEL: Record<RoundStatus, string> = {
  vorbereitung: 'Vorbereitung',
  anmeldung_offen: 'Anmeldung geöffnet',
  anmeldung_geschlossen: 'Anmeldung geschlossen',
  fragebogenphase: 'Fragebogenphase',
  juryphase: 'Juryphase',
  abgeschlossen: 'Verfahren abgeschlossen',
}

/* ── Jury: zwei Arten ──────────────────────────────────────────────────── */

export const JURY_TYPE_LABEL: Record<JuryType, string> = {
  jury1: 'Jury 1 · Ersteinschätzung',
  jury2: 'Jury 2 · Punktevergabe',
}

export const JURY_TYPE_HINT: Record<JuryType, string> = {
  jury1: 'Ja, Vielleicht oder Nein',
  jury2: 'Punkte von 1 bis 10',
}

export const assignedOf = (process: ProcessState) => process.assigned ?? { jury1: [], jury2: [] }

/** Hat dieses Jurymitglied seine Bewertung in seiner Jury-Art abgegeben? */
export const isEvaluated = (process: ProcessState, type: JuryType, jurorId: string) =>
  type === 'jury1' ? Boolean(process.jury1[jurorId]) : process.jury2[jurorId] !== undefined

/** Fortschritt je Jury-Art: zugewiesen und abgegeben. */
export function juryProgress(process: ProcessState) {
  const assigned = assignedOf(process)
  const count = (type: JuryType) => ({
    assigned: assigned[type].length,
    done: assigned[type].filter((id) => isEvaluated(process, type, id)).length,
  })
  return { jury1: count('jury1'), jury2: count('jury2') }
}

export const canRelease = (process: ProcessState) => process.review === 'geprueft' && process.payment === 'zahlung_eingegangen'

export function juryTally(process: ProcessState) {
  // Nur Bewertungen der zugewiesenen Mitglieder der jeweiligen Jury-Art zählen.
  const assigned = assignedOf(process)
  const votes = assigned.jury1.map((id) => process.jury1[id]).filter(Boolean)
  const points = assigned.jury2.map((id) => process.jury2[id]).filter((value): value is number => value !== undefined)
  return {
    ja: votes.filter((vote) => vote === 'ja').length,
    vielleicht: votes.filter((vote) => vote === 'vielleicht').length,
    nein: votes.filter((vote) => vote === 'nein').length,
    average: points.length ? Math.round((points.reduce((sum, value) => sum + value, 0) / points.length) * 10) / 10 : null,
  }
}
