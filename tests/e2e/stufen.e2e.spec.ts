import { ACCOUNTS, NEWEDGE_ID, PORTAL, adminNav, demoPanel, expect, loginAs, navLink, openApplicantView, openArea, openCase, openDemoPanel, sheet, test } from '../helpers/portal'

// Ausbaustufen (A, A + B, A + B + C, Gesamt) und die Fragebögen der Preise in der Verwaltung – Use Cases 15 und 16 der
// Testanleitung. Die Stufe wechselt hier über die Demo-Steuerung; im echten System über NEXT_PUBLIC_PORTAL_STAGE.

/** Ausbaustufe über die Demo-Steuerung wählen. */
async function chooseStage(page: import('@playwright/test').Page, label: string) {
  await openDemoPanel(page)
  await demoPanel(page).getByRole('button', { name: label, exact: true }).click()
  await expect(demoPanel(page).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(demoPanel(page)).toBeHidden()
}

test('Ausbaustufe A: nur Anmeldung und Prüfung', async ({ page }) => {
  const s = sheet(page)
  await loginAs(page, ACCOUNTS.verwaltung)
  await chooseStage(page, 'Phase A · Anmeldung')

  // Verwaltung: nur die Bereiche der Stufe – Runde, Exporte und Rechte gibt es immer.
  for (const visible of ['Übersicht', 'Anmeldungen', 'Runde', 'Exporte', 'Rechte & Benutzer']) await expect(navLink(page, visible)).toHaveCount(1)
  for (const hidden of ['Zahlungen', 'Bewerbungen', 'Fragebögen', 'Jury', 'Ergebnisse', 'Gewinnerunterlagen']) await expect(navLink(page, hidden)).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Nach Phase filtern' }).getByRole('button')).toHaveCount(1)

  // Der Vorgang endet mit der Prüfung; Rechnung und Bewerbung gibt es noch nicht.
  await openCase(page, /NEWEDGE/)
  await expect(s.getByRole('button', { name: 'Rechnung als gestellt markieren' })).toHaveCount(0)
  await s.getByRole('button', { name: 'Prüfung abschließen und vormerken', exact: true }).click()
  await openApplicantView(page)
  await expect(s).toContainText('Anmeldung geprüft')
  await expect(s).toContainText('informieren wir Sie per E-Mail')
  await expect(s).not.toContainText('Rechnung & Zahlung')
  await expect(s).not.toContainText('Ergebnis & Einladung')

  // Rechte: ohne Jury-Rollen und -Rechte; Demo-Steuerung ohne Juryperspektive.
  await page.goto(`${PORTAL}/admin?bereich=rechte`)
  await expect(page.locator('main')).not.toContainText('Jury 1')
  await openDemoPanel(page)
  await expect(demoPanel(page).getByRole('button', { name: 'Jury', exact: true })).toHaveCount(0)
  await expect(demoPanel(page).getByRole('button', { name: /Juryprüfung/ })).toHaveCount(0)
})

test('Ausbaustufe A + B: Bewerbung ohne Jury', async ({ page }) => {
  await loginAs(page, ACCOUNTS.verwaltung)
  await chooseStage(page, 'Phase A + B · Bewerbung')
  for (const visible of ['Zahlungen', 'Bewerbungen', 'Fragebögen']) await expect(navLink(page, visible)).toHaveCount(1)
  for (const hidden of ['Jury', 'Ergebnisse', 'Gewinnerunterlagen']) await expect(navLink(page, hidden)).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Nach Phase filtern' }).getByRole('button')).toHaveCount(2)
  // Eine eingereichte Bewerbung ist in dieser Stufe das Ende des Ablaufs.
  await page.goto(`${PORTAL}/admin/vorgang/demo-franken`)
  await expect(sheet(page).getByRole('heading', { name: 'Juryorganisation' })).toHaveCount(0)
  await expect(sheet(page)).toContainText('Bewerbung: Freigabe & Frist')

  // Zurück zur Gesamtversion: alle Bereiche wieder da.
  await chooseStage(page, 'Gesamt')
  await expect(navLink(page, 'Gewinnerunterlagen')).toHaveCount(1)
})

test('Fragebögen der Preise: bearbeiten, freischalten, Bewerber sieht ihn', async ({ page }) => {
  test.setTimeout(120_000)
  const s = sheet(page)
  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Fragebögen')
  const main = page.locator('main')
  await expect(main).toContainText('Bayerischer Mittelstandspreis')
  await expect(main.locator('li', { hasText: 'Bavarian Future Award' })).toContainText('Entwurf')
  // Begonnene Fragebögen lassen sich nicht mehr zurückziehen.
  await expect(main.getByRole('button', { name: /Zurückziehen\s*:\s*Bayerischer Mittelstandspreis/ })).toBeDisabled()

  await main.getByRole('button', { name: /Bearbeiten\s*:\s*Bavarian Future Award/ }).click()
  await expect(s).toContainText('Fragebogen: Bavarian Future Award')
  await s.getByLabel('Überschrift').first().fill('Nachfolge im Unternehmen')
  await s.getByRole('button', { name: /Frage hinzufügen/ }).first().click()
  const newField = s.locator('li', { hasText: 'Frage 4' })
  await newField.getByLabel('Fragetext').fill('Wie viele Generationen führen das Unternehmen bisher?')
  await newField.getByLabel('Antwortformat').selectOption('integer')
  await newField.getByLabel('Pflichtangabe').check()
  await s.getByRole('button', { name: 'Änderungen speichern' }).click()
  await expect(s).toContainText('Gespeichert')

  // Vorschau: so sehen Bewerber den Fragebogen.
  await s.getByRole('button', { name: 'Vorschau', exact: true }).click()
  await expect(s.getByLabel('Wie viele Generationen führen das Unternehmen bisher?')).toBeVisible()
  await s.getByRole('button', { name: 'Zurück zur Liste' }).click()

  await expect(main.locator('li', { hasText: 'Bavarian Future Award' })).toContainText('4 Fragen')
  await main.getByRole('button', { name: /Freischalten\s*:\s*Bavarian Future Award/ }).click()
  await expect(main.locator('li', { hasText: 'Bavarian Future Award' })).toContainText('Freigeschaltet')

  // Freigeschaltet: nur noch Texte änderbar.
  await main.getByRole('button', { name: /Ansehen und Texte korrigieren\s*:\s*Bavarian Future Award/ }).click()
  await expect(s.getByRole('button', { name: /Frage hinzufügen/ })).toHaveCount(0)
  await expect(s.getByLabel('Antwortformat').first()).toBeDisabled()
  await s.getByRole('button', { name: 'Zurück zur Liste' }).click()

  // Bewerber: Der Future Award ist jetzt ohne „Fragebogen folgt“ wählbar.
  await openDemoPanel(page)
  await demoPanel(page).getByRole('button', { name: /Bewerbung freigeschaltet/ }).click()
  await page.waitForURL(`**/portal/admin/vorgang/${NEWEDGE_ID}`)
  await openApplicantView(page)
  await s.getByRole('button', { name: 'Zur Bewerbung' }).click()
  await s.getByRole('button', { name: 'Preise wählen' }).click()
  await expect(s.locator('label', { hasText: 'Bavarian Future Award' })).not.toContainText('Fragebogen folgt')
  await s.getByText('Bavarian Future Award', { exact: true }).click()
  await s.getByRole('button', { name: 'Auswahl speichern' }).click()
  await page.waitForURL(/\/fragebogen\/future_award$/)
  await expect(s).toContainText('Nachfolge im Unternehmen')
})

test('Jury sieht je Unternehmen alle sechs Unterlagen', async ({ page }) => {
  await loginAs(page, ACCOUNTS.jury1)
  const item = page.locator('li', { hasText: 'Frankenkeramik' }).first()
  await expect(item).toContainText('Unterlagen (6)')
  for (const name of ['Unternehmenspraesentation_Demo.pptx', 'Kennzahlen_Demo.xlsx', 'Referenzschreiben_Demo.docx']) await expect(item).toContainText(name)
  await expect(item).toContainText('Excel')
  await expect(adminNav(page)).toHaveCount(0)
})
