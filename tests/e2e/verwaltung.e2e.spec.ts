import { ACCOUNTS, NEWEDGE_ID, PORTAL, demoPanel, expect, loginAs, openCase, sheet, test } from '../helpers/portal'

// Übersicht der Verwaltung: Trichter nach Phasen, Aufgaben mit Schnellaktionen und die Live-Ansicht einer
// Bewerbung (Use Case 8 der Testanleitung).

test('Verwaltung: Übersicht, Schnellaktionen und Live-Ansicht', async ({ page, context }) => {
  test.setTimeout(120_000)
  const main = page.locator('main')
  await loginAs(page, ACCOUNTS.verwaltung)

  await test.step('Trichter und Aufgaben', async () => {
    const funnel = page.locator('[aria-label="Nach Phase filtern"]')
    for (const text of ['erst angemeldet', 'in der Bewerbung', 'in der Jury', 'eingeladen: 1', 'Neu 1', 'In Prüfung 1', 'Rechnung offen 1', 'Jury 1 1']) {
      await expect(funnel).toContainText(text)
    }
    await expect(main).toContainText('Ihre Aufgaben')
    await expect(main).toContainText('Alle Vorgänge')
    await expect(main).toContainText('Anmeldung prüfen')
  })

  await test.step('Schnellaktionen bis zur Freigabe', async () => {
    await openCase(page, /NEWEDGE/)
    await sheet(page).getByRole('button', { name: 'Prüfung abschließen und vormerken', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(sheet(page)).toBeHidden()
    const task = page.locator('li', { hasText: 'NEWEDGE' }).first()
    await task.getByRole('button', { name: /Rechnung stellen/ }).click()
    await main.getByRole('button', { name: /Zahlung bestätigen\s*:\s*NEWEDGE/ }).click()
    // Die Freigabe braucht eine Frist und läuft deshalb über den Vorgang.
    await expect(main).toContainText('Bewerbung freigeben')
    await openCase(page, /NEWEDGE/)
    await sheet(page).locator('input[type="date"]').fill('2027-02-15')
    await sheet(page).getByRole('button', { name: 'Bewerbung freigeben', exact: true }).click()
    await expect(sheet(page).getByRole('button', { name: 'Freigegeben', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet(page)).toBeHidden()
  })

  await test.step('Live-Ansicht aktualisiert sich ohne Neuladen', async () => {
    // Zweiter Tab: als NEWEDGE-Inhaber den Fragebogen ausfüllen (die Anmeldung gilt für alle Tabs).
    const applicant = await context.newPage()
    await applicant.goto(`${PORTAL}/admin`)
    await applicant.getByRole('button', { name: 'Demo-Steuerung' }).click()
    await demoPanel(applicant).getByRole('button', { name: 'Bewerber', exact: true }).click()
    await applicant.waitForURL('**/portal/vorgang/**')
    // Ohne gewählten Preis führt der Fragebogen-Link zur Preiswahl.
    await applicant.goto(`${PORTAL}/vorgang/${NEWEDGE_ID}/fragebogen`)
    await applicant.waitForURL(/\/preise$/)
    await sheet(applicant).getByText('Bayerischer Mittelstandspreis', { exact: true }).click()
    await sheet(applicant).getByRole('button', { name: 'Auswahl speichern' }).click()
    await applicant.waitForURL(/\/fragebogen\/bmp$/)
    await sheet(applicant).getByLabel('Tätigkeitsschwerpunkt').fill('Live-Test Markenführung')

    await page.bringToFront()
    await main.getByRole('button', { name: /Live ansehen\s*:\s*NEWEDGE/ }).first().click()
    await expect(sheet(page)).toContainText('Live-Test Markenführung')
    await expect(sheet(page)).toContainText('Fragebogen: Bayerischer Mittelstandspreis')
    await expect(sheet(page)).toContainText('0 von 6')

    await applicant.bringToFront()
    await sheet(applicant).getByLabel('Tätigkeitsschwerpunkt').fill('Live-Test geändert')
    await page.bringToFront()
    await expect(sheet(page)).toContainText('Live-Test geändert')
  })
})
