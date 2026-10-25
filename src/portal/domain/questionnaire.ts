/**
 * Bewerbungsfragebogen – Fragen aus dem BMP-Fragebogen 2025 (Vorlage der Geschäftsstelle), ohne Antworten.
 *
 * Wo der bisherige Fragebogen freie Angaben zuließ (z. B. „Umsatzvolumen“, „Anzahl der Mitarbeiter“, „Branche“), legt
 * dieses Schema ein festes Antwortformat fest – Einheit, Stichtag, Auswahl oder Länge –, damit alle Bewerbungen nach
 * denselben Maßstäben vergleichbar sind. Die Formate stehen als Hinweis direkt am Feld.
 */

import { isValidSubmissionEmail } from '@/shared/formSubmission'
import { looksLikeUrl } from '@/portal/domain/registration'

import type { QuestionnaireAnswers } from '@/portal/domain/types'

/** Wettbewerbsrunde des Prototyps. Umsatzjahre wie 2025 (Runde 2025 → 2021–2023): Runde − 4 bis Runde − 2. */
export const ROUND_YEAR = 2027
const REVENUE_YEARS = [ROUND_YEAR - 4, ROUND_YEAR - 3, ROUND_YEAR - 2]

export type FieldType = 'text' | 'textarea' | 'select' | 'integer' | 'year' | 'zip' | 'email' | 'tel' | 'url' | 'money'

export type QuestionField = {
  id: string
  label: string
  type: FieldType
  required?: boolean
  /** Verbindliches Antwortformat, am Feld angezeigt. */
  format?: string
  options?: ReadonlyArray<{ value: string; label: string }>
  maxLength?: number
  placeholder?: string
  /** Breite im Raster: ganze Zeile oder halbe Zeile. */
  span?: 'full' | 'half'
  /** Zwischenüberschrift vor diesem Feld. */
  group?: string
  /** Gemeinsame Formatvorgabe unter der Zwischenüberschrift (gilt für die ganze Gruppe). */
  groupNote?: string
}

export type Criterion = {
  number: number
  title: string
  lead: string
  description: string
  guidance: string[]
}

export type QuestionSection = {
  id: string
  step: string
  heading: string
  intro?: string
  criterion?: Criterion
  fields: QuestionField[]
}

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

export const QUESTIONNAIRE: QuestionSection[] = [
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

export const ALL_FIELDS = QUESTIONNAIRE.flatMap((section) => section.fields)
export const REQUIRED_FIELDS = ALL_FIELDS.filter((field) => field.required)
export const CONFIRM_KEY = '__confirmed'

/* ── Preiswahl vor dem Fragebogen ───────────────────────────────────────── */

/**
 * Für welche Preise sich das Unternehmen bewirbt – eine oder mehrere. Vorerst hat nur der Bayerische Mittelstandspreis
 * einen Fragebogen; für die übrigen folgt er.
 */
export type PrizeId = 'bmp' | 'roland_berger' | 'future_award'
export type Prize = { id: PrizeId; title: string; short: string; desc: string; hasQuestionnaire: boolean }

/** Ausgewählte Preise, kommagetrennt in den Antworten gespeichert (z. B. „bmp,roland_berger“). */
export const PRIZE_KEY = '__prize'
export const PRIZES: Prize[] = [
  {
    id: 'bmp',
    title: 'Bayerischer Mittelstandspreis',
    short: 'BMP',
    desc: 'Goldene Bavaria – die höchste Auszeichnung des Bayerischen Mittelstandspreises.',
    hasQuestionnaire: true,
  },
  {
    id: 'roland_berger',
    title: 'Roland-Berger-Zukunftspreis',
    short: 'Roland Berger',
    desc: 'Für visionäre Unternehmensführung und zukunftsorientiertes Denken.',
    hasQuestionnaire: false,
  },
  {
    id: 'future_award',
    title: 'Bavarian Future Award',
    short: 'Future Award',
    desc: 'Der Sonderpreis der Hochschule für angewandtes Management (HAM) für vorbildlich gestaltete Unternehmensnachfolge.',
    hasQuestionnaire: false,
  },
]

export const prizesOf = (answers: QuestionnaireAnswers) => {
  const ids = (answers[PRIZE_KEY] ?? '').split(',')
  return PRIZES.filter((prize) => ids.includes(prize.id))
}

/** In fester Reihenfolge speichern, unabhängig von der Klickfolge. */
export const encodePrizes = (ids: PrizeId[]) =>
  PRIZES.filter((prize) => ids.includes(prize.id))
    .map((prize) => prize.id)
    .join(',')

export const prizeTitles = (prizes: Prize[], key: 'title' | 'short' = 'title') => prizes.map((prize) => prize[key]).join(', ')

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

/**
 * Ausgefüllter Beispielfragebogen für Demo-Szenarien. `upToSection` füllt nur die ersten Abschnitte (in Bearbeitung).
 * Zahlen und Texte sind erfunden und keine Angaben eines echten Unternehmens.
 */
export function demoAnswers(company: string, city: string, upToSection = QUESTIONNAIRE.length, prizes: PrizeId[] = ['bmp']): QuestionnaireAnswers {
  const values: QuestionnaireAnswers = {
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
    q1: DEMO_TEXT,
    q2: DEMO_TEXT,
    q3: DEMO_TEXT,
    k1: DEMO_TEXT,
    k2: DEMO_TEXT,
    k3: DEMO_TEXT,
    k4: DEMO_TEXT,
  }
  const allowed = new Set(QUESTIONNAIRE.slice(0, upToSection).flatMap((section) => section.fields.map((field) => field.id)))
  return { [PRIZE_KEY]: encodePrizes(prizes), ...Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key))) }
}
