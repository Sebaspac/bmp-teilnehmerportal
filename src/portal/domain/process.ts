/**
 * Prozessmodell: Aus dem Zustand eines Vorgangs werden für alle Ansichten (Bewerber, Verwaltung, Jury) Hauptphase
 * (Ebene A), Detailstatus (Ebene B) und nächste Handlung (Ebene C) abgeleitet. So zeigen alle Perspektiven denselben
 * Stand. Grundlage: Draw.io-Konzept (Phase A Anmeldung, Phase B Zahlung & Fragebogen, Phase C Jury 1/Jury 2) und die
 * vier verbindlichen Bewerberphasen.
 *
 * Nur Ableitungen und Bezeichnungen – keine Zustandsänderungen. Welche Übergänge erlaubt sind: `domain/commands.ts`.
 * Reines TypeScript, auch serverseitig nutzbar (z. B. für E-Mail-Texte oder Exporte).
 */

import { applicationProgress } from '@/portal/domain/application'
import { PRIZE_IDS, prizeById } from '@/portal/domain/questionnaire'
import { DEFAULT_STAGE, PHASE_FEATURE, hasFeature, type Stage } from '@/portal/domain/release'
import {
  DOC_KEYS,
  type ApplicationStatus,
  type DocKey,
  type DocStatus,
  type JuryStage,
  type JuryType,
  type PaymentStatus,
  type PrizeId,
  type ProcessState,
  type ResultStatus,
  type ReviewStatus,
  type RoundStatus,
  type SubmissionType,
} from '@/portal/domain/types'

/**
 * Rahmen für die Ableitungen: Ausbaustufe (`domain/release.ts`) und Preise mit freigeschaltetem Fragebogen
 * (`releasedPrizes`). Ohne Angabe: Gesamtversion, alle Fragebögen freigeschaltet.
 */
export type ProcessContext = { stage?: Stage; released?: readonly PrizeId[] }

const contextOf = (ctx: ProcessContext = {}) => ({ stage: ctx.stage ?? DEFAULT_STAGE, released: ctx.released ?? PRIZE_IDS })

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
    summary: 'Die Anmeldung ist eingegangen und wird geprüft. Fragebögen und Unterlagen sind noch nicht nötig.',
  },
  {
    number: 2,
    title: 'Fragebogen wird freigeschaltet',
    short: 'Fragebogen',
    summary:
      'Nach der Prüfung folgt die Rechnung über die Teilnahmegebühr, bei einer Fremdnominierung an das vorgeschlagene Unternehmen. Nach Zahlungseingang wird die Bewerbung freigeschaltet: je Preis ein Fragebogen und sechs Unterlagen.',
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

/** Die Hauptphasen, die es in einer Ausbaustufe gibt (A: nur 01, A + B: 01–02, ab A + B + C: alle). */
export const phasesIn = (stage: Stage) => PHASES.filter((phase) => hasFeature(stage, PHASE_FEATURE[phase.number]))

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
  /** Zugang zur Bewerbung (Fragebögen und Unterlagen). hidden = bei Fremdnominierung: Inhalte gehören dem Unternehmen, die vorschlagende Person sieht nur den Stand. */
  applicationAccess: 'locked' | 'open' | 'readonly' | 'handover' | 'hidden'
  /** Sichtbare Zusatzhinweise (z. B. Demo-Übergabe bei Fremdnominierung). */
  demoNote?: string
}

export type NextActionKind =
  | 'viewRegistration'
  | 'checkCompanyData'
  | 'viewPayment'
  | 'editApplication'
  | 'viewApplication'
  | 'viewInvitation'
  | 'demoHandover'
  | 'uploadDocuments'


/** Aus dem Prozesszustand die eine Hauptphase. Rechnung & Zahlung ist Teil von Phase 02, keine eigene Phase. */
export function phaseOf(process: ProcessState): PhaseNumber {
  if (process.jury === 'abgeschlossen' || process.result === 'einladung' || process.result === 'keine_einladung') return 4
  if (process.jury !== 'nicht_zugewiesen') return 3
  if (process.review === 'geprueft') return 2
  return 1
}

const NOMINATOR_RESULT_NOTE = 'Demo-Annahme: Ob vorschlagende Personen das Ergebnis erfahren, ist noch nicht entschieden.'

/** Wartet die Bewerbung nur noch darauf, dass die Verwaltung Fragebögen gewählter Preise freischaltet? */
export function waitingForDefinitions(process: ProcessState, released: readonly PrizeId[]) {
  if (process.application === 'gesperrt' || process.application === 'eingereicht') return []
  const progress = applicationProgress(process, released)
  return progress.open.length === 0 && progress.docs.uploaded === progress.docs.total ? progress.waiting : []
}

/** „den A“ bzw. „den A und den B“ – für Sätze über Preise. */
export const prizeList = (prizes: readonly PrizeId[]) => prizes.map((prize) => `den ${prizeById(prize).title}`).join(' und ')

/** Warum die Bewerbung gerade gesperrt ist – immer die tatsächlich offene Voraussetzung, passend zur Zeitleiste. */
export function applicationLockReason(process: ProcessState, kind: SubmissionType | null): string {
  if (kind === 'fremdvorschlag') return 'Geht nach der Prüfung an das vorgeschlagene Unternehmen, nicht an Sie (Demo-Annahme).'
  if (process.review !== 'geprueft') return 'Wird nach der Prüfung Ihrer Anmeldung und dem Eingang der Teilnahmegebühr freigeschaltet.'
  if (process.payment === 'rechnung_offen') return 'Wird freigeschaltet, sobald Ihre Zahlung eingegangen ist.'
  if (process.payment === 'zahlung_eingegangen') return 'Ihre Zahlung ist eingegangen. Die Geschäftsstelle schaltet die Bewerbung in Kürze frei.'
  return 'Ihre Anmeldung ist geprüft. Nach Rechnung und Zahlungseingang wird die Bewerbung freigeschaltet.'
}

/**
 * Bewerberansicht – zeigt nie interne Jury-Details, Notizen oder vorbereitete (nicht freigegebene) Ergebnisse.
 * `ctx`: Ausbaustufe und freigeschaltete Fragebögen; die Phasen enden mit der letzten Phase der Stufe.
 */
export function applicantView(process: ProcessState, kind: SubmissionType | null, company = '', ctx?: ProcessContext): ApplicantView {
  const { stage, released } = contextOf(ctx)
  const phases = phasesIn(stage)
  const realPhase = phaseOf(process)
  const phase = Math.min(realPhase, phases[phases.length - 1].number) as PhaseNumber
  const isNomination = kind === 'fremdvorschlag'
  // Bei einer Fremdnominierung ist es nicht „Ihr Unternehmen“, sondern das vorgeschlagene.
  const subject = isNomination ? company || 'das vorgeschlagene Unternehmen' : 'Ihr Unternehmen'
  const withJury = hasFeature(stage, 'jury')
  let view: Omit<ApplicantView, 'steps' | 'phase'>

  if (realPhase === 1) {
    // Bei einer Fremdnominierung endet die Aufgabe der vorschlagenden Person mit dem Vorschlag.
    const what = isNomination ? 'Ihre Fremdnominierung' : 'Ihre Anmeldung'
    const after = hasFeature(stage, 'bewerbung')
      ? 'Danach erhalten Sie die Rechnung über die Teilnahmegebühr; nach Zahlungseingang wird Ihre Bewerbung freigeschaltet.'
      : 'Danach informieren wir Sie über die nächsten Schritte.'
    if (process.review === 'rueckfrage') {
      // Im Portal gibt es (noch) keine Nachrichten: Die Geschäftsstelle meldet sich direkt – ein Wartezustand, keine Sackgasse.
      view = {
        status: { label: 'Rückfrage', tone: 'wartend' },
        title: 'Anmeldung läuft',
        description: `Die Geschäftsstelle hat eine Rückfrage zu ${isNomination ? 'Ihrer Fremdnominierung' : 'Ihrer Anmeldung'} und meldet sich per E-Mail oder Telefon bei Ihnen. Danach wird die Prüfung fortgesetzt.`,
        next: { label: 'Die Geschäftsstelle meldet sich mit ihrer Rückfrage', mustAct: false, action: 'viewRegistration' },
        applicationAccess: 'locked',
      }
    } else if (process.review === 'in_pruefung') {
      view = {
        status: { label: 'In Prüfung', tone: 'wartend' },
        title: 'Anmeldung läuft',
        description: isNomination
          ? `${what} für ${subject} wird derzeit geprüft. Danach wird das Unternehmen informiert. Für Sie ist nichts weiter zu tun.`
          : `Ihre Anmeldung wird derzeit geprüft. ${after}`,
        next: { label: 'Auf Prüfung warten', mustAct: false, action: 'viewRegistration' },
        applicationAccess: 'locked',
      }
    } else {
      view = {
        status: { label: 'Neu eingegangen', tone: 'neu' },
        title: 'Anmeldung läuft',
        description: isNomination
          ? `${what} für ${subject} ist eingegangen. Die Geschäftsstelle prüft sie und informiert anschließend das Unternehmen. Für Sie ist nichts weiter zu tun.`
          : `Ihre Anmeldung ist eingegangen. Derzeit prüfen wir die Angaben. ${after}`,
        next: { label: 'Auf Prüfung warten', mustAct: false, action: 'viewRegistration' },
        applicationAccess: 'locked',
      }
    }
  } else if (!hasFeature(stage, 'bewerbung')) {
    // Ausbaustufe A: Mit der Prüfung endet der Ablauf im Portal; die nächsten Schritte kündigt die Geschäftsstelle an.
    view = {
      status: { label: 'Anmeldung geprüft', tone: 'abgeschlossen' },
      title: 'Anmeldung geprüft',
      description: isNomination
        ? `Ihre Fremdnominierung für ${subject} ist geprüft. Für Sie ist nichts weiter zu tun.`
        : 'Ihre Anmeldung ist geprüft. Über die nächsten Schritte – Rechnung und Bewerbung – informieren wir Sie per E-Mail.',
      next: { label: 'Auf Nachricht der Geschäftsstelle warten', mustAct: false, action: 'viewRegistration' },
      applicationAccess: 'locked',
    }
  } else if (realPhase === 2 || !withJury) {
    const progress = applicationProgress(process, released)
    const waiting = waitingForDefinitions(process, released)
    if (isNomination && process.application !== 'eingereicht') {
      view =
        process.application === 'gesperrt'
          ? {
              status: { label: process.payment === 'keine_rechnung' ? 'Unternehmen wird informiert' : 'Unternehmen informiert', tone: 'wartend' },
              title: 'Fragebogen wird freigeschaltet',
              description:
                process.payment === 'keine_rechnung'
                  ? `Ihre Fremdnominierung ist geprüft. Als Nächstes wird ${subject} informiert und erhält die Bewerbungsunterlagen. Sie müssen nichts weiter tun.`
                  : `Ihre Fremdnominierung ist geprüft. ${subject} ist informiert und erhält Rechnung und Bewerbungsunterlagen. Sie müssen nichts weiter tun.`,
              next: { label: 'Auf das Unternehmen warten', mustAct: false },
              applicationAccess: 'handover',
              demoNote: 'Demo-Annahme: Rechnung und Bewerbung gehen bei einer Fremdnominierung an das vorgeschlagene Unternehmen. Die Zuständigkeit ist noch nicht entschieden.',
            }
          : {
              status: { label: 'Beim vorgeschlagenen Unternehmen', tone: 'wartend' },
              title: 'Fragebogen wird freigeschaltet',
              description: `Die Bewerbung liegt bei ${subject}. Sie müssen nichts weiter tun.`,
              next: { label: 'Auf das Unternehmen warten', mustAct: false, action: 'demoHandover' },
              applicationAccess: 'handover',
              demoNote: 'Demo-Zustand: Wer die Bewerbung bei einer Fremdnominierung ausfüllt, ist noch nicht entschieden.',
            }
    } else if (process.application === 'gesperrt') {
      if (process.payment === 'rechnung_offen') {
        view = {
          status: { label: 'Rechnung offen', tone: 'aktion' },
          title: 'Fragebogen wird freigeschaltet',
          description: 'Ihre Anmeldung ist geprüft. Für die Teilnahme liegt eine Rechnung vor. Nach dem Zahlungseingang wird Ihre Bewerbung freigeschaltet.',
          next: { label: 'Rechnung begleichen', mustAct: true, action: 'viewPayment' },
          applicationAccess: 'locked',
        }
      } else {
        view = {
          status: process.payment === 'zahlung_eingegangen' ? { label: 'Zahlung eingegangen', tone: 'wartend' } : { label: 'Rechnung folgt', tone: 'wartend' },
          title: 'Fragebogen wird freigeschaltet',
          description:
            process.payment === 'zahlung_eingegangen'
              ? 'Ihre Zahlung ist eingegangen. Ihre Bewerbung wird in Kürze freigeschaltet.'
              : 'Ihre Anmeldung ist geprüft. Wir bereiten den nächsten Schritt vor und informieren Sie, sobald Ihre Bewerbung freigeschaltet ist.',
          next: { label: 'Auf Freigabe warten', mustAct: false },
          applicationAccess: 'locked',
        }
      }
    } else if (process.application === 'eingereicht') {
      view = {
        status: { label: 'Bewerbung eingereicht', tone: 'abgeschlossen' },
        title: 'Bewerbung eingereicht',
        description: withJury
          ? isNomination
            ? `Die Bewerbung von ${subject} ist vollständig eingegangen. Als Nächstes wird sie der Jury zur Bewertung vorgelegt.`
            : 'Ihre Bewerbung ist vollständig eingegangen. Als Nächstes wird sie der Jury zur Bewertung vorgelegt; Sie müssen nichts weiter tun.'
          : 'Ihre Bewerbung ist vollständig eingegangen. Über die weiteren Schritte informieren wir Sie per E-Mail.',
        next: {
          label: withJury ? 'Juryprüfung abwarten' : 'Auf Nachricht der Geschäftsstelle warten',
          mustAct: false,
          action: isNomination ? undefined : 'viewApplication',
        },
        applicationAccess: isNomination ? 'hidden' : 'readonly',
      }
    } else if (waiting.length > 0) {
      // Alles erledigt bis auf Fragebögen, die die Verwaltung noch nicht freigeschaltet hat: nichts zu tun.
      view = {
        status: { label: 'Fragebogen folgt', tone: 'wartend' },
        title: 'Fragebogen folgt',
        description: `Für ${prizeList(waiting)} ist noch kein Fragebogen freigeschaltet. Alles andere ist vollständig; sobald der Fragebogen vorliegt, informieren wir Sie. Ihre Preisauswahl können Sie bis dahin ändern.`,
        next: { label: 'Auf den Fragebogen warten', mustAct: false, action: 'editApplication' },
        applicationAccess: 'open',
      }
    } else if (process.application === 'in_bearbeitung') {
      view = {
        status: { label: 'In Bearbeitung', tone: 'bearbeitung' },
        title: 'Ihre Bewerbung ist in Bearbeitung',
        description:
          progress.chosen === 0
            ? 'Wählen Sie die Preise, für die Sie sich bewerben. Ihre Angaben sind zwischengespeichert.'
            : `Ihre Angaben sind zwischengespeichert. Fragebögen: ${progress.submitted} von ${progress.chosen} eingereicht · Unterlagen: ${progress.docs.uploaded} von ${progress.docs.total} hochgeladen. Die Bewerbung ist eingereicht, sobald alles vollständig ist.`,
        next: { label: 'Bewerbung fortsetzen', mustAct: true, action: 'editApplication', deadline: process.deadline },
        applicationAccess: 'open',
      }
    } else {
      view = {
        status: { label: 'Bewerbung freigeschaltet', tone: 'freigeschaltet' },
        title: 'Ihre Bewerbung ist freigeschaltet',
        description:
          'Wählen Sie die Preise, für die Sie sich bewerben – einen oder mehrere. Je Preis füllen Sie einen Fragebogen aus; dazu laden Sie sechs Unterlagen hoch (PDF, Word, Excel und weitere Formate).',
        next: { label: 'Bewerbung starten', mustAct: true, action: 'editApplication', deadline: process.deadline },
        applicationAccess: 'open',
      }
    }
  } else if (realPhase === 3) {
    view = {
      status: process.jury === 'zugewiesen' ? { label: 'Juryprüfung ausstehend', tone: 'wartend' } : { label: 'In Juryprüfung', tone: 'wartend' },
      title: 'Auditsitzung der Jury',
      description: isNomination
        ? `Die Bewerbung von ${subject} wird im Rahmen des Juryverfahrens bewertet.`
        : 'Ihre eingereichte Bewerbung wird im Rahmen des Juryverfahrens bewertet.',
      next: isNomination ? { label: 'Juryentscheidung abwarten', mustAct: false } : { label: 'Juryentscheidung abwarten', mustAct: false, action: 'viewApplication' },
      applicationAccess: isNomination ? 'hidden' : 'readonly',
    }
  } else if (process.result === 'einladung') {
    const docs = documentsProgress(process)
    view = {
      status: { label: 'Einladung liegt vor', tone: 'einladung' },
      title: 'Einladung zur Gala',
      description: isNomination
        ? `Für ${subject} liegt eine Einladung zur Gala des Bayerischen Mittelstandspreises vor. Die Einladung erhält das Unternehmen direkt.`
        : `Für ${subject} liegt eine Einladung zur Gala des Bayerischen Mittelstandspreises vor.`,
      // Die Einladung gilt dem Unternehmen; die vorschlagende Person sieht nur den Stand, nicht den Brief.
      next: isNomination
        ? { label: 'Die Einladung ist an das Unternehmen gegangen', mustAct: false }
        : hasFeature(stage, 'gewinnerunterlagen') && docs.requested && docs.open > 0
          ? { label: 'Unterlagen für Gala und Presse einreichen', mustAct: true, action: 'uploadDocuments' }
          : { label: 'Einladung ansehen', mustAct: true, action: 'viewInvitation' },
      applicationAccess: isNomination ? 'hidden' : 'readonly',
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
      applicationAccess: isNomination ? 'hidden' : 'readonly',
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
      applicationAccess: isNomination ? 'hidden' : 'readonly',
    }
  }

  // Ende der Stufe erreicht (z. B. Stufe A nach der Prüfung): Die letzte Phase gilt als abgeschlossen.
  const endOfStage = realPhase > phase || (!withJury && process.application === 'eingereicht')
  return { ...view, phase, steps: phaseSteps(process, phase, view.status.label, phases, endOfStage) }
}

function phaseSteps(process: ProcessState, phase: PhaseNumber, currentLabel: string, phases: typeof PHASES, endOfStage: boolean): ApplicantView['steps'] {
  const doneNote: Record<PhaseNumber, string> = {
    1: 'Anmeldung geprüft',
    2: 'Bewerbung eingereicht',
    3: 'Juryprüfung abgeschlossen',
    4: '',
  }
  const upcomingNote: Record<PhaseNumber, string> = {
    1: '',
    2: 'Noch nicht freigeschaltet',
    3: process.application === 'eingereicht' ? 'Folgt in Kürze' : 'Folgt nach der Bewerbung',
    4: 'Entscheidung ausstehend',
  }
  return phases.map(({ number, title }) => {
    if (number < phase || (number === phase && endOfStage)) return { number, title, state: 'done' as const, note: doneNote[number] || currentLabel }
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
export function adminNext(process: ProcessState, kind: SubmissionType | null = null, ctx?: ProcessContext): { label: string; party: Party } {
  const { stage, released } = contextOf(ctx)
  // Bei einer Fremdnominierung handelt nach der Prüfung das vorgeschlagene Unternehmen, nicht die vorschlagende Person.
  const applicant: Party = kind === 'fremdvorschlag' ? 'unternehmen' : 'bewerber'
  if (process.review === 'neu') return { label: 'Anmeldung prüfen', party: 'verwaltung' }
  if (process.review === 'in_pruefung') return { label: 'Prüfung abschließen', party: 'verwaltung' }
  if (process.review === 'rueckfrage') return { label: 'Rückfrage klären', party: 'verwaltung' }
  if (!hasFeature(stage, 'bewerbung')) return { label: 'Anmeldung geprüft', party: 'niemand' }
  if (process.application === 'gesperrt') {
    if (process.payment === 'keine_rechnung') return { label: 'Rechnung stellen', party: 'verwaltung' }
    if (process.payment === 'rechnung_offen') return { label: 'Zahlung abwarten', party: applicant }
    return { label: 'Bewerbung freigeben', party: 'verwaltung' }
  }
  const waiting = waitingForDefinitions(process, released)
  if (waiting.length) return { label: `Fragebogen freischalten: ${waiting.map((prize) => prizeById(prize).short).join(', ')}`, party: 'verwaltung' }
  if (process.application !== 'eingereicht') return { label: 'Bewerbung abwarten', party: applicant }
  if (!hasFeature(stage, 'jury')) return { label: 'Bewerbung eingereicht', party: 'niemand' }
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
    if (!hasFeature(stage, 'gewinnerunterlagen')) return { label: 'Einladung freigegeben', party: 'niemand' }
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
  geprueft: 'Geprüft · für Bewerbung vorgemerkt',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  keine_rechnung: 'Keine Rechnung gestellt',
  rechnung_offen: 'Rechnung offen',
  zahlung_eingegangen: 'Zahlung als eingegangen markiert',
}

export const APPLICATION_LABEL: Record<ApplicationStatus, string> = {
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
  fragebogenphase: 'Bewerbungsphase',
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

/** Voraussetzungen der Freigabe einer Bewerbung (ohne Frist). */
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
