import {
  PORTAL,
  control,
  currentPhase,
  expect,
  expectNoHorizontalOverflow,
  loginAs,
  ACCOUNTS,
  openApplicantView,
  openCase,
  runScenario,
  sheet,
  switchPerspective,
  test,
} from '../helpers/portal'

// Kerndurchlauf: NEWEDGE durch alle vier Phasen – jeder Verwaltungsschritt wird in der Bewerbersicht gegengeprüft.
// Die Bewerbung besteht aus je einem Fragebogen pro gewähltem Preis und sechs Unterlagen. Use Cases 3–7 der Testanleitung.

/** Testdatei für das Hochladen – Inhalt egal, der Prototyp speichert nur Name und Größe. */
const file = (name: string) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(`Testinhalt ${name}`) })

test.describe('Teilnehmerportal: Ablauf eines Vorgangs', () => {
  test('NEWEDGE von der Anmeldung bis zur Einladung', async ({ page }) => {
    test.setTimeout(240_000)
    const s = sheet(page)
    const releaseButton = s.getByRole('button', { name: 'Bewerbung freigeben', exact: true })

    await test.step('Phase 01: neue Anmeldung', async () => {
      await page.goto(`${PORTAL}/anmelden`)
      await expect(page.getByText('Willkommen zurück')).toBeVisible()
      await switchPerspective(page, 'Bewerber')
      await expect(s).toContainText('NEWEDGE')
      await expect(currentPhase(page)).toContainText('Anmeldung läuft')
      await expect(s).toContainText('Neu eingegangen')
      await expect(s).toContainText('Noch nicht freigeschaltet')
      await expect(s.getByRole('button', { name: 'Anmeldung ansehen' })).toBeVisible()
      await expect(s).not.toContainText('Fragebogen einreichen')
      await page.keyboard.press('Escape')
      await expect(s).toBeHidden()
      await expect(page).toHaveURL(/\/portal$/)
    })

    await test.step('Prüfung und Rückfrage', async () => {
      await switchPerspective(page, 'Verwaltung')
      await expect(page.getByText('Ihre Aufgaben')).toBeVisible()
      await expect(page.locator('main')).toContainText('Nächster Schritt')
      await expect(page.locator('main')).toContainText('Anmeldung prüfen')
      await openCase(page, /NEWEDGE/)
      await control(page, 'In Prüfung setzen')
      await openApplicantView(page)
      await expect(s).toContainText('In Prüfung')
      await expect(currentPhase(page)).toContainText('Anmeldung läuft')

      // Eine Rückfrage ist ein Wartezustand, keine Sackgasse.
      await switchPerspective(page, 'Verwaltung')
      await control(page, 'Rückfrage erforderlich')
      await openApplicantView(page)
      await expect(s).toContainText('meldet sich')
      await expect(s).toContainText('Kein Handlungsbedarf')
      await expect(s).not.toContainText('Unternehmensdaten prüfen')
    })

    await test.step('Phase 02: Rechnung, Zahlung, Frist, Freigabe', async () => {
      await switchPerspective(page, 'Verwaltung')
      await expect(releaseButton).toBeDisabled()
      await control(page, 'Prüfung abschließen und vormerken')
      await control(page, 'Rechnung als gestellt markieren')
      await expect(releaseButton).toBeDisabled()
      await openApplicantView(page)
      await expect(s).toContainText('Rechnung offen')
      await expect(s).toContainText('Rechnung begleichen')
      await expect(s).toContainText('sobald Ihre Zahlung eingegangen ist')

      await switchPerspective(page, 'Verwaltung')
      await control(page, 'Zahlung als eingegangen markieren')
      // Ohne Frist keine Freigabe.
      await expect(releaseButton).toBeDisabled()
      await s.locator('input[type="date"]').fill('2027-02-15')
      await releaseButton.click()
      await expect(s.getByRole('button', { name: 'Freigegeben', exact: true })).toBeVisible()
      await openApplicantView(page)
      await expect(currentPhase(page)).toContainText('Fragebogen wird freigeschaltet')
      await expect(s).toContainText('Bewerbung freigeschaltet')
      await expect(s.getByRole('button', { name: 'Zur Bewerbung' })).toBeVisible()
    })

    await test.step('Bewerbung: Preiswahl und Fragebogen zum Mittelstandspreis', async () => {
      await s.getByRole('button', { name: 'Zur Bewerbung' }).click()
      await s.getByRole('button', { name: 'Preise wählen' }).click()
      await page.waitForURL(/\/preise$/)
      await expect(s).toContainText('Für welche Preise bewerben Sie sich?')
      // Der Future Award ist noch im Entwurf – „Fragebogen folgt“.
      await expect(s.locator('label', { hasText: 'Bavarian Future Award' })).toContainText('Fragebogen folgt')
      await s.getByRole('button', { name: 'Auswahl speichern' }).click()
      await expect(s).toContainText('Bitte wählen Sie mindestens einen Preis')
      await s.getByText('Roland-Berger-Zukunftspreis', { exact: true }).click()
      await s.getByText('Bayerischer Mittelstandspreis', { exact: true }).click()
      await s.getByRole('button', { name: 'Auswahl speichern' }).click()
      // Danach direkt in den ersten offenen Fragebogen – je Preis ein eigener.
      await page.waitForURL(/\/fragebogen\/bmp$/)
      await expect(s).toContainText('NEWEDGE · Bayerischer Mittelstandspreis')
      await expect(s).toContainText('Gewählte Preise: Bayerischer Mittelstandspreis, Roland-Berger-Zukunftspreis')
      await expect(s.getByLabel('Name des Unternehmens')).toHaveValue('NEWEDGE')

      await s.getByLabel('Branche').selectOption('M')
      await s.getByLabel('Rechtsform').selectOption('GmbH')
      await s.getByLabel('Tätigkeitsschwerpunkt').fill('Markenführung (Test)')
      await s.getByLabel('Regierungsbezirk').selectOption('Oberbayern')
      await s.getByLabel('Telefon', { exact: true }).fill('+49 89 1234560')
      await s.getByLabel('E-Mail', { exact: true }).fill('info@beispiel.example')
      await s.getByLabel('Telefon der Ansprechperson').fill('+49 89 1234561')
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()

      await s.getByLabel('Anzahl der Mitarbeiter').fill('25')
      await s.getByLabel('Anzahl der Auszubildenden').fill('3')
      await s.getByLabel('Standorte Deutschland').fill('1')
      await s.getByLabel('Standorte Ausland').fill('0')
      await s.getByLabel('Umsatzvolumen 2023').fill('12.5')
      await expect(s.getByLabel('Umsatzvolumen 2023')).toHaveValue('12,5')
      await s.getByLabel('Umsatzvolumen 2024').fill('13,47')
      await s.getByLabel('Umsatzvolumen 2025').fill('850.000')
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()
      // Falsche Formate werden gemeldet, nicht still geändert.
      await expect(s).toContainText('höchstens einer Nachkommastelle')
      await expect(s.getByLabel('Umsatzvolumen 2024')).toHaveValue('13,47')
      await expect(s.getByLabel('Umsatzvolumen 2025')).toHaveValue('850.000')
      await s.getByLabel('Umsatzvolumen 2024').fill('13,4')
      await s.getByLabel('Umsatzvolumen 2025').fill('14')
      await s.getByRole('button', { name: 'Zwischenspeichern' }).click()
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()

      await s.getByLabel(/^1\. Was zeichnet/).fill('Beispieltext: Was uns auszeichnet.')
      await s.getByRole('button', { name: 'Zurück', exact: true }).click()
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()
      await expect(s.getByLabel(/^1\. Was zeichnet/)).toHaveValue(/auszeichnet/)
      await s.getByLabel(/^2\. Wie definieren/).fill('Beispieltext: Erfolg.')
      await s.getByLabel(/^3\. Beschreiben Sie/).fill('Beispieltext: Entwicklung.')
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()
      for (const n of [1, 2, 3, 4]) {
        await s.getByLabel(`Ihre Antwort zu Kriterium ${n}`).fill(`Beispieltext: Antwort zu Kriterium ${n}.`)
        await s.getByRole('button', { name: 'Weiter', exact: true }).click()
      }

      await expect(s).toContainText('12,5 Mio. €')
      await s.getByRole('button', { name: 'Fragebogen einreichen' }).click()
      await expect(s).toContainText('Bitte bestätigen Sie Ihre Angaben')
      await s.getByRole('checkbox').check()
      await s.getByRole('button', { name: 'Fragebogen einreichen' }).click()
      await expect(s).toContainText('Simulierte Einreichung')
      // Die Bewerbung ist erst vollständig mit dem zweiten Fragebogen und den Unterlagen.
      await expect(s).toContainText('Für die vollständige Bewerbung fehlt noch: Fragebogen Roland-Berger-Zukunftspreis, 6 Unterlagen')
      await s.getByRole('button', { name: 'Zurück zum Vorgang' }).last().click()
      await page.waitForURL(/\/portal\/vorgang\/demo-newedge-vorgang$/)
      await expect(s).toContainText('Ihre Bewerbung ist in Bearbeitung')
      await expect(s).toContainText('Fragebögen 1 von 2 eingereicht · Unterlagen 0 von 6')
    })

    await test.step('Bewerbung: zweiter Fragebogen und sechs Unterlagen', async () => {
      await s.getByRole('button', { name: /Ausfüllen\s*:\s*Fragebogen Roland-Berger/ }).click()
      await page.waitForURL(/\/fragebogen\/roland_berger$/)
      await s.getByLabel(/Welche Vision verfolgt/).fill('Beispieltext: Vision.')
      await s.getByLabel('Planungshorizont Ihrer Strategie').selectOption('5 bis 10 Jahre')
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()
      await s.getByLabel(/Mit welchen Projekten/).fill('Beispieltext: Projekte.')
      await s.getByLabel(/Investitionen in Zukunftsprojekte/).fill('0,8')
      await s.getByRole('button', { name: 'Weiter', exact: true }).click()
      await s.getByRole('checkbox').check()
      await s.getByRole('button', { name: 'Fragebogen einreichen' }).click()
      await expect(s).toContainText('Für die vollständige Bewerbung fehlt noch: 6 Unterlagen')
      await s.getByRole('button', { name: 'Zurück zum Vorgang' }).last().click()
      await page.waitForURL(/\/portal\/vorgang\/demo-newedge-vorgang$/)

      const uploads = s.locator('#vorgang-bewerbung input[type="file"]')
      await expect(uploads).toHaveCount(6)
      // Andere Formate lehnt das Portal schon vor dem Hochladen ab.
      await uploads.nth(0).setInputFiles(file('programm.exe'))
      await expect(s).toContainText('Dieses Format wird nicht angenommen')
      const names = ['Praesentation.pptx', 'Jahresabschluesse.pdf', 'Kennzahlen.xlsx', 'Handelsregister.pdf', 'Organigramm.png', 'Referenz.docx']
      for (const [index, name] of names.entries()) {
        await uploads.nth(index).setInputFiles(file(name))
        await expect(s).toContainText(name)
      }
      await expect(s).toContainText('Excel')
      await expect(s).toContainText('Word')
      await expect(s).toContainText('Bewerbung eingereicht')
      await expect(s).toContainText('Fragebögen 2 von 2 eingereicht · Unterlagen 6 von 6')
      // Bis zur Juryprüfung lassen sich Dateien austauschen.
      await expect(s.getByText('Austauschen').first()).toBeVisible()
    })

    await test.step('Phase 03: Jury 1 und Jury 2, vertraulich', async () => {
      await switchPerspective(page, 'Verwaltung')
      await control(page, 'Der Jury zuweisen')
      await control(page, 'Jury 1 starten')
      await switchPerspective(page, 'Jury')
      await expect(page.getByText('Vertraulich').first()).toBeVisible()
      const juryItem = page.locator('li', { hasText: 'NEWEDGE' }).first()
      await juryItem.getByText('Ja', { exact: true }).click()
      await expect(juryItem).toContainText('Bewertung gespeichert')
      // Alle sechs Unterlagen des Unternehmens stehen offen, die Fragebögen beider Preise lassen sich aufklappen.
      await expect(juryItem).toContainText('Unterlagen (6)')
      await expect(juryItem).toContainText('Kennzahlen.xlsx')
      await expect(juryItem).toContainText('Referenz.docx')
      await juryItem.getByText('Fragebögen lesen (2)').click()
      await expect(juryItem).toContainText('12,5 Mio. €')
      await expect(juryItem).toContainText('Fragebogen: Roland-Berger-Zukunftspreis')
      await expect(juryItem).toContainText('Bayerischer Mittelstandspreis, Roland-Berger-Zukunftspreis')

      await page.goto(`${PORTAL}/admin`)
      await openCase(page, /NEWEDGE/)
      // Jury 2 erst, wenn alle zugewiesenen Stimmen der Jury 1 da sind.
      await expect(s.getByRole('button', { name: 'Jury 2 starten', exact: true })).toBeDisabled()
      await s.getByRole('button', { name: 'Übrige Stimmen simulieren (Demo)' }).click()
      await control(page, 'Jury 2 starten')
      await s.getByRole('button', { name: 'Übrige Stimmen simulieren (Demo)' }).click()
      await expect(s.getByRole('button', { name: 'Juryprüfung abschließen', exact: true })).toBeEnabled()
      await openApplicantView(page)
      await expect(currentPhase(page)).toContainText('Auditsitzung der Jury')
      await expect(s).not.toContainText(/Vielleicht|Jurymitglied|Punkte|Jury 1|Jury 2/)
    })

    await test.step('Phase 04: vorbereitete Einladung bleibt unsichtbar, freigegebene erscheint', async () => {
      await switchPerspective(page, 'Verwaltung')
      await control(page, 'Juryprüfung abschließen')
      await control(page, 'Einladung vorbereiten (intern)')
      await openApplicantView(page)
      await expect(s).toContainText('Entscheidung ausstehend')
      await expect(s).not.toContainText('Herzlichen Glückwunsch')

      await switchPerspective(page, 'Verwaltung')
      await control(page, 'Einladung freigeben')
      await openApplicantView(page)
      await expect(s).toContainText('Einladung liegt vor')
      await expect(s).toContainText('liegt eine Einladung zur Gala')
      await expect(s).not.toContainText('Herzlichen Glückwunsch')
      await s.getByRole('button', { name: 'Einladung ansehen' }).first().click()
      await expect(page.getByText('Sehr geehrte Damen und Herren,')).toBeVisible()
    })

    await test.step('Abschluss ohne Einladung und Szenario „in Bearbeitung“', async () => {
      await runScenario(page, /Keine Einladung/)
      await expect(s).toContainText('Verfahren abgeschlossen')
      await expect(s).toContainText('Vielen Dank für Ihre Teilnahme')
      await expect(s).not.toContainText('Einladung ansehen')

      await runScenario(page, /Bewerbung in Bearbeitung/)
      await expect(s).toContainText('Bewerbung fortsetzen')
      await expect(s).toContainText('Unterlagen 3 von 6')
    })
  })

  test('Konto erstellen und ein anderes Unternehmen vorschlagen', async ({ page }) => {
    test.setTimeout(120_000)
    const s = sheet(page)
    await page.goto(`${PORTAL}/anmelden`)
    await page.getByRole('tab', { name: 'Konto erstellen' }).click()
    await page.waitForURL('**/portal/registrieren')
    await page.getByLabel('E-Mail-Adresse').fill('test.person@beispiel.de')
    await page.getByLabel('Passwort', { exact: true }).fill('prototyp2026')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Konto erstellen' }).last().click()

    // Direkt zu den Stammdaten.
    await s.getByLabel('Vorname').fill('Test')
    await s.getByLabel('Nachname').fill('Person')
    await s.getByText('Privatperson', { exact: true }).click()
    await s.getByRole('button', { name: 'Stammdaten speichern' }).click()
    await expect(s).toBeHidden()

    await page.getByRole('button', { name: 'Neue Anmeldung' }).click()
    await s.getByText('Fremdnominierung', { exact: true }).click()
    await s.getByRole('button', { name: 'Weiter', exact: true }).click()
    // Zeichenweise tippen: Die erste Eingabe legt den Entwurf an – Text und Fokus bleiben erhalten.
    await s.getByLabel('Firmenname').pressSequentially('Isartal Medizintechnik GmbH', { delay: 30 })
    await expect(s.getByLabel('Firmenname')).toHaveValue('Isartal Medizintechnik GmbH')
    await expect(s.getByLabel('Firmenname')).toBeFocused()
    await expect(page).toHaveURL(/entwurf=/)
    await s.getByLabel('Ort in Bayern').fill('Freising')
    await s.getByLabel('Warum verdient dieses Unternehmen den Preis?').fill('Beispieltext: innovative Medizintechnik aus der Region.')
    await s.getByRole('button', { name: 'Weiter', exact: true }).click()
    await expect(s).toContainText('Für Sie als vorschlagende Person entstehen keine Kosten')
    await s.getByRole('checkbox').check()
    await s.getByRole('button', { name: 'Anmeldung einreichen' }).click()
    await expect(s).toContainText('Ihre Fremdnominierung ist eingegangen')
    await s.getByRole('button', { name: 'Zurück zum Portal' }).click()
    await expect(page).toHaveURL(/\/portal\?neu=/)
    await expect(page.locator('main')).toContainText('Isartal Medizintechnik GmbH')
    await expect(page.locator('main')).toContainText('Neu eingegangen')

    // Die vorschlagende Person bekommt keine Zahlungsaufforderung.
    await switchPerspective(page, 'Verwaltung')
    await openCase(page, /Isartal/)
    await control(page, 'Prüfung abschließen und vormerken')
    await control(page, 'Rechnung als gestellt markieren')
    await openApplicantView(page)
    await expect(s).toContainText('Isartal Medizintechnik GmbH')
    await expect(s).toContainText('Kein Handlungsbedarf')
    await expect(s).not.toContainText('Rechnung begleichen')
  })

  test('Verwaltung: Phasenfilter, Bereiche und Hilfe', async ({ page }) => {
    await loginAs(page, ACCOUNTS.verwaltung)
    await page.getByRole('group', { name: 'Nach Phase filtern' }).getByRole('button', { name: /Phase 04/ }).click()
    await page.getByRole('button', { name: /Filter aufheben/ }).click()
    await page.goto(`${PORTAL}/admin?bereich=zahlungen`)
    await expect(page.locator('main')).toContainText('Lechtal')
    await expect(page.locator('main')).not.toContainText('Huber Holzbau')

    await switchPerspective(page, 'Bewerber')
    await expect(sheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/portal$/)
    await page.getByRole('link', { name: 'Hilfe' }).click()
    await expect(page.getByText('Häufige Fragen')).toBeVisible()
  })

  test('mobil (390 px): Verwaltung, Vorgang und Fragebogen ohne seitliches Scrollen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginAs(page, ACCOUNTS.verwaltung)
    await expectNoHorizontalOverflow(page)
    await openCase(page, /NEWEDGE/)
    await expectNoHorizontalOverflow(page)
    await openApplicantView(page)
    await expect(currentPhase(page)).toContainText('Anmeldung läuft')
    await runScenario(page, /Bewerbung freigeschaltet/)
    await sheet(page).getByRole('button', { name: 'Zur Bewerbung' }).click()
    await expectNoHorizontalOverflow(page)
    await sheet(page).getByRole('button', { name: 'Preise wählen' }).click()
    await expect(sheet(page)).toContainText('Für welche Preise bewerben Sie sich?')
    await expectNoHorizontalOverflow(page)
  })
})
