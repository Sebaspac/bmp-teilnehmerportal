import { readFile } from 'node:fs/promises'

import {
  ACCOUNTS,
  PORTAL,
  adminNav,
  expect,
  expectNoHorizontalOverflow,
  login,
  loginAs,
  logout,
  openApplicantView,
  openArea,
  openCase,
  sheet,
  test,
  textOf,
} from '../helpers/portal'

// Verwaltungsbereiche Runde, Exporte, Rechte und Gewinnerunterlagen (Use Cases 10–13 der Testanleitung) sowie der
// Hinweis, wenn das Backend eine Aktion ablehnt.

test('Runde: geschlossene Anmeldung sperrt neue Anmeldungen', async ({ page }) => {
  const main = page.locator('main')
  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Runde')
  await expect(main).toContainText('Status der Wettbewerbsrunde 2027')
  await expect(main).toContainText('möglich')
  await page.getByRole('button', { name: 'Anmeldung schließen' }).click()
  await expect(main).toContainText('gesperrt')
  await logout(page)

  await loginAs(page, ACCOUNTS.unternehmer)
  await expect(main).toContainText('derzeit geschlossen')
  await expect(page.getByRole('button', { name: 'Neue Anmeldung' })).toBeDisabled()
  await logout(page)

  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Runde')
  await page.getByRole('button', { name: 'Anmeldung wieder öffnen' }).click()
  await expect(main).toContainText('möglich')
})

test('Exporte: CSV-Dateien für Excel und Mailinglisten', async ({ page }) => {
  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Exporte & Rechte')

  const [all] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV herunterladen\s*:\s*Alle Teilnehmenden/ }).click()])
  expect(all.suggestedFilename()).toMatch(/^bmp-2027_mailing_alle_\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = await readFile((await all.path())!, 'utf8')
  // UTF-8 mit BOM und Semikolon – so öffnet Excel die Datei mit Umlauten richtig.
  expect(csv.startsWith('﻿')).toBe(true)
  expect(csv).toContain('Anrede;Vorname;Nachname;E-Mail')
  expect(csv).toContain('NEWEDGE')

  const [jury] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /CSV herunterladen\s*:\s*Jury-Auswertung/ }).click()])
  const juryCsv = await readFile((await jury.path())!, 'utf8')
  expect(juryCsv).toContain('Jury 1 Ja')
  expect(juryCsv).toContain('Jury 2 Ø Punkte')

  await openArea(page, 'Anmeldungen')
  const [list] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Liste exportieren (CSV)' }).click()])
  expect(list.suggestedFilename()).toContain('liste-anmeldungen')

  await openArea(page, 'Ergebnisse')
  await expect(page.getByRole('button', { name: 'Mailingliste Eingeladene (CSV)' })).toBeVisible()
})

test('Rechte: Benutzer anlegen, Sachbearbeitung eingeschränkt, Zugang deaktivieren', async ({ page }) => {
  test.setTimeout(90_000)
  const main = page.locator('main')
  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Exporte & Rechte')
  await expect(main).toContainText('Rollen und Rechte')
  await expect(main).toContainText('Interne Zugänge')
  await expect(main).toContainText(ACCOUNTS.jury1)

  await page.getByRole('button', { name: 'Anlegen', exact: true }).click()
  await expect(main).toContainText('Bitte wählen Sie eine Rolle')
  await page.getByLabel('Name', { exact: true }).fill('Petra Test')
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('petra.test@bmp.example')
  await page.getByLabel('Rolle', { exact: true }).selectOption('sachbearbeitung')
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click()
  const row = page.locator('tr', { hasText: 'petra.test@bmp.example' })
  await expect(row).toContainText(/team-[a-z0-9]{6}/)
  const password = (await textOf(row)).match(/team-[a-z0-9]{6}/)![0]
  await logout(page)

  await loginAs(page, 'petra.test@bmp.example', password)
  await expect(page).toHaveURL(/\/portal\/admin$/)
  const nav = adminNav(page)
  await expect(nav).toContainText('Zahlungen')
  for (const hidden of ['Runde', 'Jury', 'Ergebnisse']) await expect(nav.getByRole('button', { name: hidden, exact: true })).toHaveCount(0)
  await openCase(page, /Frankenkeramik/)
  await expect(sheet(page)).toContainText('Nur lesen')
  await expect(sheet(page).getByRole('button', { name: 'Jury 2 starten', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toBeHidden()
  await openArea(page, 'Exporte & Rechte')
  await expect(main).toContainText('Exporte')
  await expect(main).not.toContainText('Rollen und Rechte')
  await logout(page)

  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Exporte & Rechte')
  await page.locator('tr', { hasText: 'petra.test@bmp.example' }).getByRole('checkbox').uncheck()
  await logout(page)
  await login(page, 'petra.test@bmp.example', password)
  await expect(main).toContainText('deaktiviert')
  await expect(page).toHaveURL(/\/portal\/anmelden$/)
})

test('Gewinnerunterlagen: anfordern, einreichen, prüfen', async ({ page }) => {
  test.setTimeout(90_000)
  const s = sheet(page)
  await loginAs(page, ACCOUNTS.verwaltung)
  await openArea(page, 'Gewinnerunterlagen')
  await expect(page.locator('main')).toContainText('Alpenländische')
  await expect(page.locator('main')).toContainText('nicht angefordert')
  await page.locator('main').getByRole('button', { name: /Unterlagen anfordern\s*:\s*Alpenländische/ }).click()
  // Danach ist das Unternehmen am Zug: Der Vorgang verlässt die offene Arbeit der Verwaltung und steht unter „Erledigte“.
  await expect(page.locator('main')).toContainText('Keine Vorgänge für diese Auswahl')
  await page.getByRole('button', { name: 'Erledigte einblenden' }).click()
  await expect(page.locator('main')).toContainText('0 von 4 geprüft')

  await openCase(page, /Alpenländische/)
  await openApplicantView(page)
  await expect(s).toContainText('Unterlagen für Gala und Presse einreichen')
  await s.getByRole('button', { name: 'Unterlagen einreichen' }).first().click()
  await s.locator('input[type="file"]').first().setInputFiles({ name: 'logo-alpen.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await s.getByRole('button', { name: /Einreichen\s*:\s*Logo/ }).click()
  await s.locator('textarea').first().fill('Beispieltext Kurzporträt (Test).')
  await s.getByRole('button', { name: /Einreichen\s*:\s*Kurzporträt/ }).click()
  await expect(s).toContainText('logo-alpen.svg')
  await expect(s).toContainText('Beispieltext Kurzporträt (Test).')

  await page.goto(`${PORTAL}/admin/vorgang/demo-alpen`)
  const media = s.locator('section', { hasText: 'Gewinnerunterlagen & Medienstatus' }).last()
  await media.locator('li', { hasText: 'Logo' }).getByRole('button', { name: 'Geprüft', exact: true }).click()
  await media.locator('li', { hasText: 'Kurzporträt' }).getByRole('button', { name: 'Nachbesserung', exact: true }).click()
  await expect(media).toContainText('1 von 4 geprüft')
  await expect(media).toContainText('Nachbesserung erbeten')
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`abgelehnte Aktion zeigt einen Hinweis (${viewport.width} px)`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await loginAs(page, ACCOUNTS.verwaltung)
    await page.goto(`${PORTAL}/admin?bereich=runde`)
    // Ein leerer Anmeldeschluss ist kein gültiges Datum – der Befehl round.setSettings lehnt ab.
    await page.getByLabel('Anmeldeschluss').fill('')
    const notice = page.getByRole('alert').filter({ hasText: 'Aktion nicht ausgeführt' })
    await expect(notice).toContainText('Bitte wählen Sie ein gültiges Datum.')
    await expect(page.getByLabel('Anmeldeschluss')).toHaveValue('2027-01-31')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Hinweis schließen' }).click()
    await expect(notice).toHaveCount(0)
  })
}
