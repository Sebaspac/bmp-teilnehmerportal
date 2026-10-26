/**
 * Fragebögen der drei Preise: Vorlagen, Prüfregeln je Antwortformat und Regeln für die Bearbeitung durch die Verwaltung.
 *
 * Gespeichert sind die Fragebögen als `QuestionnaireDefinition` im Bestand (`PortalData.questionnaires`) – die Verwaltung
 * bearbeitet und schaltet sie frei. Diese Datei liefert die Ausgangsfassungen (Seed) und alles, was für jede Fassung gilt:
 *
 * - Bayerischer Mittelstandspreis: Fragen aus dem BMP-Fragebogen 2025 (Vorlage der Geschäftsstelle). Wo der bisherige
 *   Fragebogen freie Angaben zuließ (z. B. „Umsatzvolumen“, „Anzahl der Mitarbeiter“, „Branche“), legt das Schema ein
 *   festes Antwortformat fest – Einheit, Stichtag, Auswahl oder Länge –, damit alle Bewerbungen vergleichbar sind.
 * - Roland-Berger-Zukunftspreis und Bavarian Future Award: Platzhalter, bis die Geschäftsstelle die Fragen festlegt.
 */

import { isValidSubmissionEmail } from '@/shared/formSubmission'
import { looksLikeUrl } from '@/portal/domain/registration'

import type { FieldType, PortalData, PrizeId, QuestionField, QuestionSection, QuestionnaireAnswers, QuestionnaireDefinition } from '@/portal/domain/types'

/** Wettbewerbsrunde des Prototyps. Umsatzjahre wie 2025 (Runde 2025 → 2021–2023): Runde − 4 bis Runde − 2. */
export const ROUND_YEAR = 2027
const REVENUE_YEARS = [ROUND_YEAR - 4, ROUND_YEAR - 3, ROUND_YEAR - 2]

const GUIDANCE_NOTE =
  'Auf folgende Fragen können Sie in Ihrer Antwort eingehen. Die Fragen dienen zur Orientierung – Sie müssen nicht jede Frage beantworten. Bitte geben Sie, wenn möglich, auch Beispiele an, um Ihre Erfolge anschaulich darzustellen.'

export const guidanceNote = GUIDANCE_NOTE

const GENERAL_LIMIT = 1500
const CRITERION_LIMIT = 4000

/** Wirtschaftszweige nach WZ 2008 (Abschnitte) – einheitliche Branchenangabe statt Freitext. */
const INDUSTRIES = [
  ['A', 'Land- und Forstwirtschaft, Fischerei'],
  ['B', 'Bergbau und Gewinnung von Steinen und Erden'],
  ['C', 'Verarbeitendes Gewerbe'],
  ['D', 'Energieversorgung'],
  ['E', 'Wasserversorgung, Abwasser- und Abfallentsorgung'],
  ['F', 'Baugewerbe'],
  ['G', 'Handel; Instandhaltung und Reparatur von Kraftfahrzeugen'],
  ['H', 'Verkehr und Lagerei'],
  ['I', 'Gastgewerbe'],
  ['J', 'Information und Kommunikation'],
  ['K', 'Finanz- und Versicherungsdienstleistungen'],
  ['L', 'Grundstücks- und Wohnungswesen'],
  ['M', 'Freiberufliche, wissenschaftliche und technische Dienstleistungen'],
  ['N', 'Sonstige wirtschaftliche Dienstleistungen'],
  ['P', 'Erziehung und Unterricht'],
  ['Q', 'Gesundheits- und Sozialwesen'],
  ['R', 'Kunst, Unterhaltung und Erholung'],
  ['S', 'Sonstige Dienstleistungen'],
].map(([value, label]) => ({ value, label: `${value} – ${label}` }))

const LEGAL_FORMS = ['GmbH', 'GmbH & Co. KG', 'AG', 'SE', 'KG', 'OHG', 'GbR', 'UG (haftungsbeschränkt)', 'e. K.', 'Einzelunternehmen', 'eG', 'Sonstige'].map((value) => ({
  value,
  label: value,
}))

const DISTRICTS = ['Oberbayern', 'Niederbayern', 'Oberpfalz', 'Oberfranken', 'Mittelfranken', 'Unterfranken', 'Schwaben'].map((value) => ({ value, label: value }))

const RELATIONS = ['Kunde', 'Geschäftspartner', 'Lieferant', 'Verband oder Institution', 'Sonstiges'].map((value) => ({ value, label: value }))

const referenceFields = (index: number): QuestionField[] => [
  {
    id: `ref${index}_org`,
    label: `Referenz ${index}: Organisation`,
    type: 'text',
    maxLength: 120,
    span: 'half',
    group: index === 1 ? 'Referenzen' : undefined,
    format: index === 1 ? 'Bis zu drei Kunden oder Partner: Name der Organisation und Art der Beziehung. Bitte keine Namen oder Kontaktdaten von Personen.' : undefined,
  },
  { id: `ref${index}_relation`, label: `Referenz ${index}: Art der Beziehung`, type: 'select', options: RELATIONS, span: 'half' },
]

/** Ausgangsfassung des Fragebogens zum Bayerischen Mittelstandspreis. */
export const BMP_QUESTIONNAIRE: QuestionSection[] = [
  {
    id: 'kontakt',
    step: 'Kontakt',
    heading: 'Informationen: Kontakt',
    fields: [
      {
        id: 'company_name',
        label: 'Name des Unternehmens',
        type: 'text',
        required: true,
        maxLength: 200,
        format: 'Vollständige Firmierung laut Handelsregister, z. B. „Muster GmbH & Co. KG“.',
        group: 'Unternehmen',
      },
      { id: 'industry', label: 'Branche', type: 'select', required: true, options: INDUSTRIES, format: 'Wirtschaftszweig nach WZ 2008 (Abschnitt).', span: 'half' },
      { id: 'legal_form', label: 'Rechtsform', type: 'select', required: true, options: LEGAL_FORMS, span: 'half' },
      {
        id: 'industry_focus',
        label: 'Tätigkeitsschwerpunkt',
        type: 'text',
        required: true,
        maxLength: 80,
        format: 'Stichworte, höchstens 80 Zeichen, z. B. „Präzisionsteile für die Medizintechnik“.',
      },
      { id: 'zip', label: 'Postleitzahl', type: 'zip', required: true, format: 'Fünf Ziffern.', span: 'half' },
      { id: 'city', label: 'Ort', type: 'text', required: true, maxLength: 120, span: 'half' },
      { id: 'district', label: 'Regierungsbezirk', type: 'select', required: true, options: DISTRICTS, span: 'half' },
      { id: 'street', label: 'Straße/Hausnummer', type: 'text', required: true, maxLength: 200, span: 'half' },
      { id: 'phone', label: 'Telefon', type: 'tel', required: true, format: 'Mit Vorwahl, z. B. „+49 89 1234560“.', span: 'half' },
      { id: 'email', label: 'E-Mail', type: 'email', required: true, format: 'Allgemeine Adresse des Unternehmens.', span: 'half' },
      { id: 'website', label: 'Internet', type: 'url', format: 'Webadresse, z. B. „www.unternehmen.de“.' },
      { id: 'contact_name', label: 'Ansprechperson', type: 'text', required: true, maxLength: 120, span: 'half', group: 'Ansprechperson' },
      { id: 'contact_role', label: 'Funktion', type: 'text', required: true, maxLength: 120, span: 'half' },
      { id: 'contact_phone', label: 'Telefon der Ansprechperson', type: 'tel', required: true, format: 'Mit Vorwahl.', span: 'half' },
      { id: 'contact_email', label: 'E-Mail der Ansprechperson', type: 'email', required: true, span: 'half' },
    ],
  },
  {
    id: 'daten',
    step: 'Unternehmensdaten',
    heading: 'Informationen: Unternehmensdaten',
    intro: 'Alle Zahlen beziehen sich auf denselben Stichtag bzw. dieselben Geschäftsjahre, damit die Angaben vergleichbar sind.',
    fields: [
      { id: 'founded', label: 'Gründungsjahr', type: 'year', required: true, format: 'Jahr mit vier Ziffern (JJJJ).', span: 'half', group: 'Größe und Standorte' },
      { id: 'employees', label: 'Anzahl der Mitarbeiter', type: 'integer', required: true, format: 'Köpfe in Voll- und Teilzeit zum 31.12. des letzten abgeschlossenen Geschäftsjahres, ohne Auszubildende.', span: 'half' },
      { id: 'apprentices', label: 'Anzahl der Auszubildenden', type: 'integer', required: true, format: 'Zum selben Stichtag; 0, wenn keine.', span: 'half' },
      { id: 'sites_de', label: 'Standorte Deutschland', type: 'integer', required: true, format: 'Anzahl der Betriebsstätten einschließlich Hauptsitz.', span: 'half' },
      { id: 'sites_abroad', label: 'Standorte Ausland', type: 'integer', required: true, format: 'Anzahl der Betriebsstätten außerhalb Deutschlands; 0, wenn keine.', span: 'half' },
      ...REVENUE_YEARS.map(
        (year, index): QuestionField => ({
          id: `revenue_${year}`,
          label: `Umsatzvolumen ${year}`,
          type: 'money',
          required: true,
          span: 'half',
          group: index === 0 ? 'Umsatzvolumen' : undefined,
          groupNote:
            index === 0
              ? 'Nettoumsatz (ohne Umsatzsteuer) laut Jahresabschluss, in Mio. € auf eine Nachkommastelle gerundet, z. B. „12,5“. Bei abweichendem Geschäftsjahr gilt das Geschäftsjahr, das im jeweiligen Kalenderjahr endet.'
              : undefined,
          format: 'Nettoumsatz in Mio. €, eine Nachkommastelle.',
        }),
      ),
      ...referenceFields(1),
      ...referenceFields(2),
      ...referenceFields(3),
    ],
  },
  {
    id: 'allgemein',
    step: 'Allgemein',
    heading: 'Fragen: allgemein',
    fields: [
      { id: 'q1', label: '1. Was zeichnet Ihr Unternehmen Ihrer Meinung nach aus?', type: 'textarea', required: true, maxLength: GENERAL_LIMIT, format: `Freitext, höchstens ${GENERAL_LIMIT.toLocaleString('de-DE')} Zeichen.` },
      { id: 'q2', label: '2. Wie definieren Sie für Ihr Unternehmen den Begriff „erfolgreich“?', type: 'textarea', required: true, maxLength: GENERAL_LIMIT, format: `Freitext, höchstens ${GENERAL_LIMIT.toLocaleString('de-DE')} Zeichen.` },
      { id: 'q3', label: '3. Beschreiben Sie kurz, wie sich Ihr Unternehmen in den letzten 5 Jahren entwickelt hat.', type: 'textarea', required: true, maxLength: GENERAL_LIMIT, format: `Freitext, höchstens ${GENERAL_LIMIT.toLocaleString('de-DE')} Zeichen.` },
    ],
  },
  {
    id: 'k1',
    step: 'Kriterium 1',
    heading: 'Kriterium 1: Robustheit/Resilienz',
    criterion: {
      number: 1,
      title: 'Robustheit/Resilienz',
      lead: 'Bitte beschreiben Sie, wie robust bzw. reaktionsfähig Ihr Unternehmen gegenüber Störungen und Veränderungen ist.',
      description:
        'Robustheit/Resilienz ist die Widerstandsfähigkeit eines Unternehmens gegenüber Störungen und die Reaktionsfähigkeit auf Veränderungen. Diese können sich in Form eines veränderten Nachfrage- und Kundenverhaltens sowie veränderter Situationen auf dem Arbeits- und Beschaffungsmarkt zeigen. Schafft es Ihr Unternehmen, die organisatorischen Rahmenbedingungen und die Prozesse so zu gestalten, dass es auf die neuen Herausforderungen resilient reagieren kann?',
      guidance: [
        'Wie hat Ihr Unternehmen auf Veränderungen in der Vergangenheit reagiert?',
        'Wie können in Ihrem Unternehmen frühzeitig neue Herausforderungen erkannt und gemanagt werden? Haben Sie hierzu beispielsweise Strukturen, Prozesse oder Instrumente (z. B. ein Risikomanagementsystem) im Einsatz?',
        'Wie sichern Sie in Ihrem Unternehmen die Verbundenheit mit Ihren Stakeholdern, Kunden, Lieferanten und Mitarbeitenden?',
        'Wie ist Ihr Unternehmen finanziell aufgestellt, um Liquiditätsengpässe zu überbrücken und den langfristigen Erfolg zu sichern?',
        'Wie ist Ihr Unternehmen am Standort Bayern, aber auch über die Region hinaus vernetzt? Besteht beispielsweise ein Austausch im Rahmen von Netzwerken, die Zusammenarbeit mit öffentlichen Stellen oder gibt es sonstige Formen der Vernetzung, die helfen, den Standort Bayern zu sichern?',
      ],
    },
    fields: [{ id: 'k1', label: 'Ihre Antwort zu Kriterium 1', type: 'textarea', required: true, maxLength: CRITERION_LIMIT, format: `Freitext, höchstens ${CRITERION_LIMIT.toLocaleString('de-DE')} Zeichen (etwa eine Seite).` }],
  },
  {
    id: 'k2',
    step: 'Kriterium 2',
    heading: 'Kriterium 2: Zukunftsfähigkeit/Innovation',
    criterion: {
      number: 2,
      title: 'Zukunftsfähigkeit/Innovation',
      lead: 'Bitte zeigen Sie auf, wie Zukunftsfähigkeit und Innovationskraft in Ihrem Betrieb sichergestellt werden.',
      description:
        'Um die Überlebens- und Wettbewerbsfähigkeit zu sichern, muss ein Unternehmen flexibel und innovativ auf die Dynamik und Komplexität des Marktes reagieren können. Wie können relevante Trends und Marktveränderungen erkannt, relevante Fähigkeiten aufgebaut, Innovationen und Kooperationen gefördert werden – und dies auch in Kooperation mit anderen?',
      guidance: [
        'Welche Ziele hinsichtlich Innovationen haben Sie in Ihrem Unternehmen formuliert, um Kundenbedarfe zu erkennen?',
        'Wie stellen Sie sicher, dass Sie neue Trends erkennen und in Ihrem Unternehmen umsetzen, um Ihre Wettbewerbsfähigkeit zu sichern?',
        'Wie passiert bei Ihnen Produkt- und/oder Prozess-Innovation, d. h. wie kommen Sie z. B. zu neuen Produkten und Prozessen?',
        'Welche konkreten Maßnahmen bestehen zum Aufbau von innovativen Netzwerken, zur Integration von neuen Partnern und Geschäftsbeziehungen und zur Erweiterung der eigenen Fähigkeiten?',
        'Welche Form von Wissensmanagement und Wissensarbeit besteht bei Ihnen im Unternehmen? Wie wird beispielsweise Wissen unabhängig von Personen gespeichert, wie wird es verarbeitet und priorisiert?',
      ],
    },
    fields: [{ id: 'k2', label: 'Ihre Antwort zu Kriterium 2', type: 'textarea', required: true, maxLength: CRITERION_LIMIT, format: `Freitext, höchstens ${CRITERION_LIMIT.toLocaleString('de-DE')} Zeichen (etwa eine Seite).` }],
  },
  {
    id: 'k3',
    step: 'Kriterium 3',
    heading: 'Kriterium 3: Nachhaltigkeit/Verantwortung',
    criterion: {
      number: 3,
      title: 'Nachhaltigkeit/Verantwortung',
      lead: 'Bitte stellen Sie dar, welche Bedeutung Nachhaltigkeit und Verantwortung in Ihrem Unternehmen haben und wie Sie danach handeln.',
      description:
        'Die Bedeutung von Nachhaltigkeit für den Unternehmenswert nimmt immer mehr zu. Dabei liegt die Verantwortung in den Dimensionen der Ökologie, Ökonomie und des Sozialen. Nur Unternehmen, die sich auf diese Dimensionen einstellen, bleiben attraktiv für Kunden, Mitarbeiter/-innen, Investoren und andere Stakeholder. Nachhaltiges Handeln stärkt die regionale und überregionale Verantwortung eines Unternehmens.',
      guidance: [
        'Welche Aktivitäten zeigen Sie in Bezug auf den nachhaltigen Einsatz von Ressourcen, Rohstoffen und Materialien?',
        'Welche Rolle spielen regionale Lieferanten und regionale Wertschöpfungsketten in Ihrem Unternehmen? Die sog. „Corporate Social Responsibility“ kann sich durch unterschiedliche Aktivitäten im Unternehmen äußern. Mit welchen Aktivitäten kommen Sie der „sozialen und regionalen“ Verantwortung in Ihrem Unternehmen nach?',
        'Welche Aspekte sprechen aus Ihrer Sicht für die Bindung an Ihren Standort? Welche Rollen sehen Sie für sich dabei, die Region zu entwickeln?',
      ],
    },
    fields: [{ id: 'k3', label: 'Ihre Antwort zu Kriterium 3', type: 'textarea', required: true, maxLength: CRITERION_LIMIT, format: `Freitext, höchstens ${CRITERION_LIMIT.toLocaleString('de-DE')} Zeichen (etwa eine Seite).` }],
  },
  {
    id: 'k4',
    step: 'Kriterium 4',
    heading: 'Kriterium 4: Attraktivität',
    criterion: {
      number: 4,
      title: 'Attraktivität',
      lead: 'Bitte beschreiben Sie, wie Sie Ihr Unternehmen attraktiv machen, sowohl für bestehende als auch für neue Mitarbeiterinnen und Mitarbeiter.',
      description:
        'Wissen und der Wissensträger „Mensch“ sind die Ressourcen für den unternehmerischen Erfolg. Unternehmen stehen zunehmend im Wettbewerb, um kompetentes Personal zu gewinnen. Die Attraktivität der Unternehmen für die richtigen Mitarbeiter/-innen – neue und bestehende – ist ein unverzichtbarer Erfolgsfaktor.',
      guidance: [
        'Wie sorgen Sie dafür, dass Ihre Mitarbeiterinnen und Mitarbeiter gerne einen Beitrag für den Erfolg Ihres Unternehmens leisten? Wie sorgen Sie für „Freude an Resultaten“ und Durchhaltevermögen in „schwierigen Zeiten“?',
        'Auf welche Weise wird für Ihre Mitarbeiterinnen und Mitarbeiter der Sinn und Nutzen ihrer täglichen Arbeit erlebbar? Woran erkennen Sie, dass das gelingt?',
        'Welche Möglichkeiten bestehen in Ihrem Unternehmen für die persönliche und fachliche Entwicklung der Mitarbeiterinnen und Mitarbeiter? Inwiefern können diese Einfluss darauf nehmen?',
        'Woran können potenzielle Bewerber/-innen Ihr Unternehmen als exzellenten Arbeitgeber erkennen? Wie stellen Sie sicher, dass dies für die richtigen Bewerber ersichtlich ist?',
        'Woran erkennen Sie, dass Ihre Unternehmenskultur „funktioniert“? Wie stellen Sie sicher, dass Verantwortung, Vertrauen, Leistung, Lernen und Innovation in die Unternehmenskultur einfließen?',
      ],
    },
    fields: [{ id: 'k4', label: 'Ihre Antwort zu Kriterium 4', type: 'textarea', required: true, maxLength: CRITERION_LIMIT, format: `Freitext, höchstens ${CRITERION_LIMIT.toLocaleString('de-DE')} Zeichen (etwa eine Seite).` }],
  },
]

/** Platzhalter-Fragebogen zum Roland-Berger-Zukunftspreis – die Fragen legt die Geschäftsstelle fest. */
const ROLAND_BERGER_QUESTIONNAIRE: QuestionSection[] = [
  {
    id: 'vision',
    step: 'Vision',
    heading: 'Vision und Zukunftsbild',
    intro: 'Platzhalter – die Fragen zum Roland-Berger-Zukunftspreis legt die Geschäftsstelle fest.',
    fields: [
      { id: 'rb_vision', label: 'Welche Vision verfolgt Ihr Unternehmen für die nächsten zehn Jahre?', type: 'textarea', required: true, maxLength: GENERAL_LIMIT, format: `Freitext, höchstens ${GENERAL_LIMIT.toLocaleString('de-DE')} Zeichen.` },
      {
        id: 'rb_horizon',
        label: 'Planungshorizont Ihrer Strategie',
        type: 'select',
        required: true,
        span: 'half',
        options: ['bis 3 Jahre', '3 bis 5 Jahre', '5 bis 10 Jahre', 'mehr als 10 Jahre'].map((value) => ({ value, label: value })),
      },
    ],
  },
  {
    id: 'umsetzung',
    step: 'Umsetzung',
    heading: 'Umsetzung im Unternehmen',
    fields: [
      { id: 'rb_projects', label: 'Mit welchen Projekten setzen Sie Ihre Vision heute um?', type: 'textarea', required: true, maxLength: GENERAL_LIMIT, format: `Freitext, höchstens ${GENERAL_LIMIT.toLocaleString('de-DE')} Zeichen.` },
      { id: 'rb_invest', label: 'Investitionen in Zukunftsprojekte im letzten Geschäftsjahr', type: 'money', required: true, span: 'half', format: 'In Mio. €, eine Nachkommastelle.' },
    ],
  },
]

/** Platzhalter-Fragebogen zum Bavarian Future Award (Unternehmensnachfolge) – die Fragen legt die Geschäftsstelle fest. */
const FUTURE_AWARD_QUESTIONNAIRE: QuestionSection[] = [
  {
    id: 'nachfolge',
    step: 'Nachfolge',
    heading: 'Ihre Nachfolgesituation',
    intro: 'Platzhalter – die Fragen zum Bavarian Future Award legt die Geschäftsstelle gemeinsam mit der HAM fest.',
    fields: [
      {
        id: 'fa_kind',
        label: 'Art der Nachfolge',
        type: 'select',
        required: true,
        span: 'half',
        options: ['Familienintern', 'Management-Buy-out', 'Management-Buy-in', 'Verkauf', 'Stiftung', 'Noch offen'].map((value) => ({ value, label: value })),
      },
      { id: 'fa_year', label: 'Jahr der Übergabe', type: 'year', required: true, span: 'half', format: 'Jahr mit vier Ziffern (JJJJ).' },
      { id: 'fa_story', label: 'Wie haben Sie die Nachfolge vorbereitet und gestaltet?', type: 'textarea', required: true, maxLength: CRITERION_LIMIT, format: `Freitext, höchstens ${CRITERION_LIMIT.toLocaleString('de-DE')} Zeichen.` },
    ],
  },
]

/** Ausgangsfassungen je Preis (Seed). Die gültige Fassung steht im Bestand und kann von der Verwaltung geändert sein. */
export const SEED_QUESTIONNAIRES: Record<PrizeId, QuestionSection[]> = {
  bmp: BMP_QUESTIONNAIRE,
  roland_berger: ROLAND_BERGER_QUESTIONNAIRE,
  future_award: FUTURE_AWARD_QUESTIONNAIRE,
}

export const CONFIRM_KEY = '__confirmed'

/* ── Preise ─────────────────────────────────────────────────────────────── */

export type Prize = { id: PrizeId; title: string; short: string; desc: string }

/** Für welche Preise sich ein Unternehmen bewirbt – einen oder mehrere; je Preis gibt es einen eigenen Fragebogen. */
export const PRIZES: Prize[] = [
  {
    id: 'bmp',
    title: 'Bayerischer Mittelstandspreis',
    short: 'BMP',
    desc: 'Goldene Bavaria – die höchste Auszeichnung des Bayerischen Mittelstandspreises.',
  },
  {
    id: 'roland_berger',
    title: 'Roland-Berger-Zukunftspreis',
    short: 'Roland Berger',
    desc: 'Für visionäre Unternehmensführung und zukunftsorientiertes Denken.',
  },
  {
    id: 'future_award',
    title: 'Bavarian Future Award',
    short: 'Future Award',
    desc: 'Der Sonderpreis der Hochschule für angewandtes Management (HAM) für vorbildlich gestaltete Unternehmensnachfolge.',
  },
]

export const PRIZE_IDS: PrizeId[] = PRIZES.map((prize) => prize.id)

export const prizeById = (id: PrizeId) => PRIZES.find((prize) => prize.id === id)!

/** Gewählte Preise in fester Reihenfolge, unabhängig von der Klickfolge. */
export const sortPrizes = (ids: readonly PrizeId[]) => PRIZE_IDS.filter((id) => ids.includes(id))

export const prizeTitles = (ids: readonly PrizeId[], key: 'title' | 'short' = 'title') =>
  sortPrizes(ids)
    .map((id) => prizeById(id)[key])
    .join(', ')

/* ── Fragebögen im Bestand ──────────────────────────────────────────────── */

export const definitionOf = (data: Pick<PortalData, 'questionnaires'> | null, prize: PrizeId) => data?.questionnaires.find((item) => item.prize === prize) ?? null

/** Preise, deren Fragebogen Bewerber ausfüllen können. */
export const releasedPrizes = (data: Pick<PortalData, 'questionnaires'> | null): PrizeId[] =>
  sortPrizes((data?.questionnaires ?? []).filter((item) => item.status === 'freigeschaltet').map((item) => item.prize))

export const allFields = (sections: readonly QuestionSection[]) => sections.flatMap((section) => section.fields)
export const requiredFields = (sections: readonly QuestionSection[]) => allFields(sections).filter((field) => field.required)

/** Ausgangsbestand: Mittelstandspreis und Zukunftspreis freigeschaltet, Future Award noch im Entwurf. */
export function seedDefinitions(at: string): QuestionnaireDefinition[] {
  const released: PrizeId[] = ['bmp', 'roland_berger']
  return PRIZE_IDS.map((prize) => ({
    prize,
    status: released.includes(prize) ? 'freigeschaltet' : 'entwurf',
    sections: SEED_QUESTIONNAIRES[prize],
    updatedAt: at,
    ...(released.includes(prize) ? { releasedAt: at } : {}),
  }))
}

/* ── Bearbeitung durch die Verwaltung ───────────────────────────────────── */

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Kurzer Text',
  textarea: 'Langer Text',
  select: 'Auswahl',
  integer: 'Ganze Zahl',
  year: 'Jahr',
  zip: 'Postleitzahl',
  email: 'E-Mail-Adresse',
  tel: 'Telefonnummer',
  url: 'Webadresse',
  money: 'Betrag in Mio. €',
}

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABEL) as FieldType[]

/**
 * Ist der Fragebogen vollständig genug zum Freischalten bzw. Speichern? Liefert den ersten Mangel als Satz, sonst
 * `null`. Geprüft werden Pflichttexte, eindeutige IDs und Auswahlmöglichkeiten.
 */
export function definitionProblem(sections: readonly QuestionSection[]): string | null {
  if (sections.length === 0) return 'Der Fragebogen braucht mindestens einen Abschnitt.'
  const sectionIds = new Set<string>()
  const fieldIds = new Set<string>()
  for (const [index, section] of sections.entries()) {
    const name = `Abschnitt ${index + 1}`
    if (!section.id || sectionIds.has(section.id)) return `${name}: Die interne Kennung ist doppelt.`
    sectionIds.add(section.id)
    if (!section.heading.trim()) return `${name}: Bitte geben Sie eine Überschrift ein.`
    if (!section.step.trim()) return `${name}: Bitte geben Sie einen Kurznamen für die Schrittleiste ein.`
    if (section.fields.length === 0) return `${name}: Der Abschnitt braucht mindestens eine Frage.`
    for (const [fieldIndex, field] of section.fields.entries()) {
      const fieldName = `${name}, Frage ${fieldIndex + 1}`
      if (!field.id || fieldIds.has(field.id)) return `${fieldName}: Die interne Kennung ist doppelt.`
      fieldIds.add(field.id)
      if (!field.label.trim()) return `${fieldName}: Bitte geben Sie den Fragetext ein.`
      if (!FIELD_TYPES.includes(field.type)) return `${fieldName}: Unbekanntes Antwortformat.`
      if (field.type === 'select' && (field.options ?? []).filter((option) => option.label.trim()).length < 2)
        return `${fieldName}: Eine Auswahl braucht mindestens zwei Möglichkeiten.`
      if (field.maxLength !== undefined && !(Number.isInteger(field.maxLength) && field.maxLength > 0)) return `${fieldName}: Die Höchstlänge muss eine positive ganze Zahl sein.`
    }
  }
  return null
}

/**
 * Aufbau eines Fragebogens: Abschnitte, Felder, Antwortformate, Pflichtangaben und Auswahlwerte. Nach dem Freischalten
 * muss er gleich bleiben – Texte (Überschriften, Fragen, Hinweise, Bezeichnungen der Auswahl) dürfen sich ändern.
 */
const structureOf = (sections: readonly QuestionSection[]) =>
  JSON.stringify(
    sections.map((section) => [
      section.id,
      section.fields.map((field) => [field.id, field.type, Boolean(field.required), field.maxLength ?? null, (field.options ?? []).map((option) => option.value)]),
    ]),
  )

export const sameStructure = (a: readonly QuestionSection[], b: readonly QuestionSection[]) => structureOf(a) === structureOf(b)

/* ── Prüfung je Antwortformat ───────────────────────────────────────────── */


export const FIELD_ERRORS = {
  required: 'Bitte füllen Sie dieses Feld aus.',
  choose: 'Bitte wählen Sie eine Antwort.',
  zip: 'Bitte geben Sie eine fünfstellige Postleitzahl ein.',
  year: 'Bitte geben Sie ein Jahr mit vier Ziffern ein, z. B. 1998.',
  yearFuture: 'Das Jahr darf nicht in der Zukunft liegen.',
  integer: 'Bitte geben Sie eine ganze Zahl ohne Punkt oder Komma ein, z. B. 120.',
  money: 'Bitte geben Sie den Betrag in Mio. € mit höchstens einer Nachkommastelle an, z. B. 12,5 (für 12,5 Mio. €).',
  moneyHuge: 'Mehr als 5.000 Mio. € – bitte prüfen, ob der Betrag in Mio. € angegeben ist (z. B. 0,9 für 850.000 €).',
  email: 'Diese E-Mail-Adresse ist unvollständig, z. B. name@unternehmen.de.',
  tel: 'Bitte geben Sie die Telefonnummer mit Vorwahl an, z. B. +49 89 1234560.',
  url: 'Bitte geben Sie eine Webadresse ein, z. B. www.unternehmen.de.',
  tooLong: (max: number) => `Bitte kürzen Sie auf höchstens ${max.toLocaleString('de-DE')} Zeichen.`,
  reference: 'Bitte wählen Sie die Art der Beziehung zu dieser Organisation.',
} as const

/** Prüft ein Feld nach seinem Antwortformat; `undefined` = in Ordnung. */
export function validateField(field: QuestionField, raw: string | undefined, answers: QuestionnaireAnswers): string | undefined {
  const value = (raw ?? '').trim()
  if (!value) {
    // Referenz: Organisation ohne Art der Beziehung ist unvollständig.
    if (field.id.endsWith('_relation') && (answers[field.id.replace('_relation', '_org')] ?? '').trim()) return FIELD_ERRORS.reference
    if (!field.required) return undefined
    return field.type === 'select' ? FIELD_ERRORS.choose : FIELD_ERRORS.required
  }
  switch (field.type) {
    case 'zip':
      return /^\d{5}$/.test(value) ? undefined : FIELD_ERRORS.zip
    case 'year':
      if (!/^\d{4}$/.test(value)) return FIELD_ERRORS.year
      return Number(value) > new Date().getFullYear() ? FIELD_ERRORS.yearFuture : undefined
    case 'integer':
      return /^\d{1,6}$/.test(value) ? undefined : FIELD_ERRORS.integer
    case 'money':
      if (!/^\d{1,6}(,\d)?$/.test(value)) return FIELD_ERRORS.money
      // Plausibilität: sehr große Werte sind fast immer Euro statt Mio. €.
      return Number(value.replace(',', '.')) > 5000 ? FIELD_ERRORS.moneyHuge : undefined
    case 'email':
      return isValidSubmissionEmail(value) ? undefined : FIELD_ERRORS.email
    case 'tel':
      return /^\+?[\d\s/()-]{6,30}$/.test(value) ? undefined : FIELD_ERRORS.tel
    case 'url':
      return looksLikeUrl(value) ? undefined : FIELD_ERRORS.url
    case 'select':
      return field.options?.some((option) => option.value === value) ? undefined : FIELD_ERRORS.choose
    default:
      return field.maxLength && value.length > field.maxLength ? FIELD_ERRORS.tooLong(field.maxLength) : undefined
  }
}

export function validateSection(section: QuestionSection, answers: QuestionnaireAnswers) {
  const errors: Record<string, string> = {}
  for (const field of section.fields) {
    const error = validateField(field, answers[field.id], answers)
    if (error) errors[field.id] = error
  }
  return errors
}

/** Lesbarer Wert für Zusammenfassung, Jury und Verwaltung. */
export function displayValue(field: QuestionField, raw: string | undefined) {
  const value = (raw ?? '').trim()
  if (!value) return '–'
  if (field.type === 'money') return `${value} Mio. €`
  if (field.type === 'select') return field.options?.find((option) => option.value === value)?.label ?? value
  return value
}

export const isFilled = (answers: QuestionnaireAnswers, field: QuestionField) => (answers[field.id] ?? '').trim().length > 0

/* ── Demo-Antworten (frei erfunden, als Beispiel gekennzeichnet) ─────────── */

const DEMO_TEXT = 'Beispieltext (Demo): Hier steht die Antwort des Unternehmens.'

/** Beispielwert je Antwortformat – für Felder ohne eigenen Demo-Wert (z. B. von der Verwaltung ergänzte Fragen). */
function demoValue(field: QuestionField): string {
  switch (field.type) {
    case 'select':
      return field.options?.[0]?.value ?? ''
    case 'integer':
      return '10'
    case 'year':
      return '2020'
    case 'zip':
      return '80331'
    case 'email':
      return 'info@beispiel.example'
    case 'tel':
      return '+49 89 1234560'
    case 'url':
      return 'www.beispiel.example'
    case 'money':
      return '1,5'
    default:
      return field.type === 'textarea' ? DEMO_TEXT : 'Beispielangabe (Demo)'
  }
}

/**
 * Ausgefüllter Beispielfragebogen eines Preises für Demo-Szenarien. `upToSection` füllt nur die ersten Abschnitte (in
 * Bearbeitung). Zahlen und Texte sind erfunden und keine Angaben eines echten Unternehmens.
 */
export function demoAnswers(sections: readonly QuestionSection[], company: string, city: string, upToSection = sections.length): QuestionnaireAnswers {
  const known: QuestionnaireAnswers = {
    company_name: company,
    industry: 'M',
    legal_form: 'GmbH',
    industry_focus: 'Beispielschwerpunkt (Demo)',
    zip: '80331',
    city,
    district: 'Oberbayern',
    street: 'Musterstraße 1',
    phone: '+49 89 1234560',
    email: 'info@beispiel.example',
    website: 'www.beispiel.example',
    contact_name: 'Alex Muster',
    contact_role: 'Geschäftsführung',
    contact_phone: '+49 89 1234561',
    contact_email: 'kontakt@beispiel.example',
    founded: '2010',
    employees: '25',
    apprentices: '3',
    sites_de: '1',
    sites_abroad: '0',
    ...Object.fromEntries(REVENUE_YEARS.map((year, index) => [`revenue_${year}`, ['2,0', '2,5', '3,0'][index]])),
    ref1_org: 'Beispielkunde AG (Demo)',
    ref1_relation: 'Kunde',
  }
  const answers: QuestionnaireAnswers = {}
  for (const field of allFields(sections.slice(0, upToSection))) {
    // Freiwillige Referenzen 2 und 3 bleiben leer.
    if (!field.required && !(field.id in known)) continue
    answers[field.id] = known[field.id] ?? demoValue(field)
  }
  return answers
}
