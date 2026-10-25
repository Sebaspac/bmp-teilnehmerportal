import { portalContent } from '@/portal/content/portalContent'

import { ACCOUNTS, PORTAL, expect, login, loginAs, logout, test } from '../helpers/portal'

// Testzugänge führen in ihre Ansicht; falsche oder deaktivierte Zugänge bleiben auf der Login-Seite.

const CASES = [
  { email: ACCOUNTS.unternehmer, path: /\/portal$/, sees: 'NEWEDGE' },
  { email: ACCOUNTS.vorschlag, path: /\/portal$/, sees: 'Huber Holzbau KG' },
  { email: ACCOUNTS.verwaltung, path: /\/portal\/admin$/, sees: 'Nächster Schritt' },
  { email: ACCOUNTS.sachbearbeitung, path: /\/portal\/admin$/, sees: 'Nächster Schritt' },
  { email: ACCOUNTS.jury1, path: /\/portal\/jury$/, sees: 'Ihre Bewertung' },
  { email: ACCOUNTS.jury2, path: /\/portal\/jury$/, sees: 'Ihre Bewertung' },
]

test.describe('Teilnehmerportal: Anmeldung und Rollen', () => {
  for (const { email, path, sees } of CASES) {
    test(`${email} landet in der eigenen Ansicht`, async ({ page }) => {
      await loginAs(page, email)
      await expect(page).toHaveURL(path)
      await expect(page.locator('main')).toContainText(sees)
      await expect(page.getByText('Angemeldet als')).toBeVisible()
    })
  }

  test('„Eintragen“ in den Testzugängen füllt das Formular aus', async ({ page }) => {
    await page.goto(`${PORTAL}/anmelden`)
    await page.getByRole('button', { name: /Eintragen.*Verwaltung/ }).click()
    await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(ACCOUNTS.verwaltung)
    await page.getByRole('button', { name: 'Anmelden', exact: true }).last().click()
    await expect(page).toHaveURL(/\/portal\/admin$/)
  })

  test('die Verwaltung hat keine Bewerberseiten und meldet sich ab', async ({ page }) => {
    await loginAs(page, ACCOUNTS.verwaltung)
    await page.goto(PORTAL)
    await expect(page).toHaveURL(/\/portal\/admin$/)
    await logout(page)
    await expect(page.getByText('Willkommen zurück')).toBeVisible()
  })

  test('ein falsches Passwort wird abgelehnt', async ({ page }) => {
    await login(page, ACCOUNTS.jury1, 'falsch')
    await expect(page.getByText(portalContent.auth.errors.wrongCredentials)).toBeVisible()
    await expect(page).toHaveURL(/\/portal\/anmelden$/)
  })
})
