import { describe, expect, it } from 'vitest'

import { executeCommand, type CommandContext, type PortalCommand } from '@/portal/domain/commands'
import { actorOf } from '@/portal/domain/permissions'
import { applicantView } from '@/portal/domain/process'
import { CONFIRM_KEY, demoAnswers } from '@/portal/domain/questionnaire'
import { seedData } from '@/portal/domain/seed'
import type { PortalData } from '@/portal/domain/types'
import { visibleTo } from '@/portal/domain/visibility'

// Teilnehmerportal: Geschäftsregeln (domain/commands.ts) und Sichtbarkeit (domain/visibility.ts). Dieselben Regeln
// gelten im Prototyp und später im Backend – diese Tests beschreiben, was beide einhalten müssen.

const NEWEDGE = 'demo-newedge-vorgang'
const VERWALTUNG = 'demo-verwaltung'
const SACHBEARBEITUNG = 'demo-sachbearbeitung'
const UNTERNEHMER = 'demo-newedge'
const JURY = { a: 'demo-jury', b: 'demo-jury-b', c: 'demo-jury-c', d: 'demo-jury-d', e: 'demo-jury-e' }

function context(): CommandContext {
  let tick = 0
  let id = 0
  return {
    now: () => new Date(Date.UTC(2026, 9, 25, 9, 0, tick++)).toISOString(),
    newId: () => `id-${++id}`,
    newReference: () => 'BMP-TEST01',
    newPassword: (kind) => `${kind}-test`,
  }
}

const ctx = context()
const run = (data: PortalData, accountId: string | null, command: PortalCommand) => executeCommand(data, actorOf(data, accountId), command, ctx)

/** Führt Befehle nacheinander aus und erwartet, dass jeder gelingt. */
function steps(data: PortalData, list: Array<[string, PortalCommand]>) {
  return list.reduce((current, [accountId, command]) => {
    const outcome = run(current, accountId, command)
    if (!outcome.ok) throw new Error(`${command.type} als ${accountId}: ${outcome.error.message}`)
    return outcome.data
  }, data)
}

const process = (data: PortalData, id = NEWEDGE) => data.submissions.find((submission) => submission.id === id)!.process
const completeAnswers = () => ({ ...demoAnswers('NEWEDGE', 'München'), [CONFIRM_KEY]: 'ja' })

/** NEWEDGE bis „Fragebogen eingereicht“. */
const throughQuestionnaire = (data: PortalData) =>
  steps(data, [
    [VERWALTUNG, { type: 'review.set', submissionId: NEWEDGE, status: 'geprueft' }],
    [VERWALTUNG, { type: 'payment.invoice', submissionId: NEWEDGE }],
    [VERWALTUNG, { type: 'payment.confirm', submissionId: NEWEDGE }],
    [VERWALTUNG, { type: 'questionnaire.setDeadline', submissionId: NEWEDGE, deadline: '2027-02-15' }],
    [VERWALTUNG, { type: 'questionnaire.release', submissionId: NEWEDGE }],
    [UNTERNEHMER, { type: 'questionnaire.submit', submissionId: NEWEDGE, answers: completeAnswers() }],
  ])

describe('Teilnehmerportal: Ablauf eines Vorgangs', () => {
  it('führt NEWEDGE von der Anmeldung bis zu geprüften Gewinnerunterlagen', () => {
    let data = throughQuestionnaire(seedData())
    expect(applicantView(process(data), 'eigenbewerbung').status.label).toBe('Fragebogen eingereicht')

    data = steps(data, [
      [VERWALTUNG, { type: 'jury.assign', submissionId: NEWEDGE }],
      [VERWALTUNG, { type: 'jury.start', submissionId: NEWEDGE, stage: 'jury1' }],
      [JURY.a, { type: 'jury.vote', submissionId: NEWEDGE, jurorId: 'a', vote: 'ja' }],
      [JURY.b, { type: 'jury.vote', submissionId: NEWEDGE, jurorId: 'b', vote: 'vielleicht' }],
      [JURY.c, { type: 'jury.vote', submissionId: NEWEDGE, jurorId: 'c', vote: 'ja' }],
      [VERWALTUNG, { type: 'jury.start', submissionId: NEWEDGE, stage: 'jury2' }],
      [JURY.d, { type: 'jury.points', submissionId: NEWEDGE, jurorId: 'd', points: 9 }],
      [JURY.e, { type: 'jury.points', submissionId: NEWEDGE, jurorId: 'e', points: 7 }],
      [VERWALTUNG, { type: 'jury.finish', submissionId: NEWEDGE }],
      [VERWALTUNG, { type: 'result.set', submissionId: NEWEDGE, result: 'einladung' }],
      [VERWALTUNG, { type: 'documents.request', submissionId: NEWEDGE }],
    ])
    expect(applicantView(process(data), 'eigenbewerbung').next.action).toBe('uploadDocuments')

    data = steps(data, [
      [UNTERNEHMER, { type: 'documents.submit', submissionId: NEWEDGE, key: 'logo', fileName: 'logo.svg' }],
      [UNTERNEHMER, { type: 'documents.submit', submissionId: NEWEDGE, key: 'foto', fileName: 'foto.jpg' }],
      [UNTERNEHMER, { type: 'documents.submit', submissionId: NEWEDGE, key: 'portraet', value: 'Kurzporträt (Test).' }],
      [UNTERNEHMER, { type: 'documents.submit', submissionId: NEWEDGE, key: 'pressekontakt', value: 'Presse, presse@test.de' }],
      ...(['logo', 'foto', 'portraet', 'pressekontakt'] as const).map(
        (key): [string, PortalCommand] => [SACHBEARBEITUNG, { type: 'documents.review', submissionId: NEWEDGE, key, status: 'geprueft' }],
      ),
    ])
    const view = applicantView(process(data), 'eigenbewerbung')
    expect(view.phase).toBe(4)
    expect(view.status.label).toBe('Einladung liegt vor')
    expect(view.next.action).toBe('viewInvitation')
    // Jeder Schritt steht im Verlauf – mit dem auslösenden Konto.
    expect(process(data).log.at(-1)).toMatchObject({ text: 'Unterlage „Pressekontakt“: geprüft', by: SACHBEARBEITUNG })
  })

  it('legt einen Entwurf an und vergibt beim Einreichen die Eingangsnummer', () => {
    let data = seedData()
    data = steps(data, [[UNTERNEHMER, { type: 'draft.create', draft: { id: 'entwurf-1', type: 'fremdvorschlag' } }]])
    const incomplete = run(data, UNTERNEHMER, { type: 'draft.submit', submissionId: 'entwurf-1' })
    expect(incomplete).toMatchObject({ ok: false, error: { code: 'invalid_input', field: 'companyName' } })

    data = steps(data, [
      [UNTERNEHMER, { type: 'draft.update', submissionId: 'entwurf-1', patch: { nomination: { companyName: 'Muster AG', city: 'Passau', reason: 'Vorbild.', website: '', industry: '', relationship: '' } } }],
    ])
    const submitted = run(data, UNTERNEHMER, { type: 'draft.submit', submissionId: 'entwurf-1' })
    expect(submitted).toMatchObject({ ok: true, result: { reference: 'BMP-TEST01' } })
    if (!submitted.ok) return
    expect(submitted.data.submissions.find((item) => item.id === 'entwurf-1')).toMatchObject({ status: 'eingereicht', accountId: UNTERNEHMER })
    expect(run(submitted.data, UNTERNEHMER, { type: 'draft.update', submissionId: 'entwurf-1', patch: { step: 1 } })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
  })
})

describe('Teilnehmerportal: Voraussetzungen', () => {
  it('gibt den Fragebogen erst nach Prüfung, Zahlung und Frist frei', () => {
    const data = steps(seedData(), [[VERWALTUNG, { type: 'review.set', submissionId: NEWEDGE, status: 'geprueft' }]])
    expect(run(data, VERWALTUNG, { type: 'questionnaire.release', submissionId: NEWEDGE })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
    const paid = steps(data, [
      [VERWALTUNG, { type: 'payment.invoice', submissionId: NEWEDGE }],
      [VERWALTUNG, { type: 'payment.confirm', submissionId: NEWEDGE }],
    ])
    expect(run(paid, VERWALTUNG, { type: 'questionnaire.release', submissionId: NEWEDGE })).toMatchObject({ ok: false, error: { message: 'Bitte setzen Sie zuerst eine Frist.' } })
  })

  it('startet Jury 2 erst, wenn alle zugewiesenen Stimmen der Jury 1 da sind', () => {
    const data = steps(throughQuestionnaire(seedData()), [
      [VERWALTUNG, { type: 'jury.assign', submissionId: NEWEDGE }],
      [VERWALTUNG, { type: 'jury.start', submissionId: NEWEDGE, stage: 'jury1' }],
      [JURY.a, { type: 'jury.vote', submissionId: NEWEDGE, jurorId: 'a', vote: 'ja' }],
    ])
    expect(run(data, VERWALTUNG, { type: 'jury.start', submissionId: NEWEDGE, stage: 'jury2' })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
    expect(run(data, VERWALTUNG, { type: 'result.set', submissionId: NEWEDGE, result: 'einladung' })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
  })

  it('nimmt keine neuen Anmeldungen an, solange die Anmeldung geschlossen ist', () => {
    const closed = steps(seedData(), [[VERWALTUNG, { type: 'round.setStatus', status: 'anmeldung_geschlossen' }]])
    expect(run(closed, UNTERNEHMER, { type: 'draft.create', draft: { id: 'neu' } })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
  })
})

describe('Teilnehmerportal: Rechte', () => {
  it('lässt die Sachbearbeitung Zahlungen buchen, aber weder Jury noch Ergebnis, Runde oder Zugänge steuern', () => {
    const data = steps(seedData(), [[VERWALTUNG, { type: 'review.set', submissionId: NEWEDGE, status: 'geprueft' }]])
    expect(run(data, SACHBEARBEITUNG, { type: 'payment.invoice', submissionId: NEWEDGE }).ok).toBe(true)
    const forbidden: PortalCommand[] = [
      { type: 'jury.assign', submissionId: 'demo-franken' },
      { type: 'result.set', submissionId: 'demo-alpen', result: 'keine_einladung' },
      { type: 'round.setStatus', status: 'anmeldung_geschlossen' },
      { type: 'staff.create', name: 'Neu', email: 'neu@bmp.example', role: 'verwaltung' },
    ]
    for (const command of forbidden) expect(run(data, SACHBEARBEITUNG, command), command.type).toMatchObject({ ok: false, error: { code: 'forbidden' } })
  })

  it('erlaubt Bewerbern nur Aktionen an eigenen Vorgängen', () => {
    const data = seedData()
    expect(run(data, UNTERNEHMER, { type: 'payment.invoice', submissionId: NEWEDGE })).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(run(data, 'demo-vorschlag', { type: 'questionnaire.save', submissionId: NEWEDGE, answers: {}, step: 0 })).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(run(data, null, { type: 'profile.save', profile: data.accounts[0].profile })).toMatchObject({ ok: false, error: { code: 'unauthenticated' } })
  })

  it('lässt Jurymitglieder nur in eigenem Namen bewerten', () => {
    expect(run(seedData(), JURY.a, { type: 'jury.vote', submissionId: 'demo-franken', jurorId: 'b', vote: 'nein' })).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(run(seedData(), JURY.a, { type: 'jury.vote', submissionId: 'demo-franken', jurorId: 'a', vote: 'ja' }).ok).toBe(true)
  })

  it('lehnt doppelte E-Mail-Adressen ab und schützt den eigenen Zugang', () => {
    const data = seedData()
    expect(run(data, VERWALTUNG, { type: 'juror.create', name: 'Doppelt', email: 'JURY1@demo.bmp', jurorType: 'jury1' })).toMatchObject({ ok: false, error: { code: 'conflict', field: 'email' } })
    expect(run(data, VERWALTUNG, { type: 'staff.setActive', accountId: VERWALTUNG, active: false })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
    // Die Jury-Art lässt sich nur ohne Zuweisungen ändern (A ist Frankenkeramik zugewiesen).
    expect(run(data, VERWALTUNG, { type: 'juror.update', jurorId: 'a', name: 'Jurymitglied A', email: 'jury1@demo.bmp', jurorType: 'jury2' })).toMatchObject({ ok: false, error: { code: 'invalid_state' } })
  })
})

describe('Teilnehmerportal: Sichtbarkeit', () => {
  it('zeigt Bewerbern nur eigene Vorgänge – ohne Stimmen, Verlauf, vorbereitetes Ergebnis und Zugangsdaten', () => {
    const data = steps(seedData(), [[VERWALTUNG, { type: 'result.set', submissionId: 'demo-alpen', result: 'vorbereitet' }]])
    const sample = visibleTo(data, actorOf(data, 'demo-beispiele'))
    const alpen = sample.submissions.find((item) => item.id === 'demo-alpen')!
    expect(alpen.process).toMatchObject({ jury1: {}, jury2: {}, log: [], result: 'ausstehend', assigned: { jury1: [], jury2: [] } })
    expect(sample.submissions.every((item) => item.accountId === 'demo-beispiele')).toBe(true)
    expect(sample.accounts).toHaveLength(1)
    expect(sample.jurors).toEqual([])

    const own = visibleTo(data, actorOf(data, UNTERNEHMER))
    expect(own.accounts[0]).toMatchObject({ id: UNTERNEHMER, passwordHash: '' })
    expect(own.accounts[0].demoPassword).toBeUndefined()
  })

  it('zeigt Jurymitgliedern nur zugewiesene Fragebögen und nur die eigene Bewertung', () => {
    const data = seedData()
    const view = visibleTo(data, actorOf(data, JURY.b))
    expect(view.submissions.map((item) => item.id).sort()).toEqual(['demo-alpen', 'demo-franken'])
    expect(view.submissions.find((item) => item.id === 'demo-franken')!.process.jury1).toEqual({ b: 'ja' })
    expect(view.jurors.map((juror) => juror.id)).toEqual(['b'])
  })

  it('zeigt Testpasswörter nur der Verwaltung, nicht der Sachbearbeitung', () => {
    const data = seedData()
    expect(visibleTo(data, actorOf(data, VERWALTUNG)).accounts.find((item) => item.id === JURY.a)?.demoPassword).toBeTruthy()
    expect(visibleTo(data, actorOf(data, SACHBEARBEITUNG)).accounts.some((item) => item.demoPassword)).toBe(false)
  })
})
