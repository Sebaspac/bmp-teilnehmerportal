/**
 * Hilfen für die Browser-Tests des Teilnehmerportals (tests/e2e).
 *
 * Jeder Test läuft in einem eigenen Browserkontext und startet damit mit frischen Demo-Daten (localStorage). Die Tests
 * prüfen die Oberfläche im Prototyp-Modus mit Demo-Steuerung – mit `NEXT_PUBLIC_PORTAL_BACKEND=http` gegen ein echtes
 * Backend müssen sie stattdessen mit eigenen Testdaten arbeiten.
 */

import { expect as baseExpect, test as base, type Locator, type Page } from '@playwright/test'

import { DEMO_PASSWORD, NEWEDGE_REFERENCE } from '@/portal/domain/seed'

export { DEMO_PASSWORD, NEWEDGE_REFERENCE }

export const PORTAL = `${process.env.PORTAL_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`}/portal`

/** ID des NEWEDGE-Vorgangs aus domain/seed.ts. */
export const NEWEDGE_ID = 'demo-newedge-vorgang'

/** Testzugänge aus domain/seed.ts (Passwort: `DEMO_PASSWORD`). */
export const ACCOUNTS = {
  unternehmer: 'unternehmer@demo.bmp',
  vorschlag: 'vorschlag@demo.bmp',
  verwaltung: 'verwaltung@demo.bmp',
  sachbearbeitung: 'sachbearbeitung@demo.bmp',
  jury1: 'jury1@demo.bmp',
  jury2: 'jury2@demo.bmp',
} as const

/** Der Dev-Server übersetzt Seiten beim ersten Aufruf – etwas mehr Geduld als der Standard. */
export const expect = baseExpect.configure({ timeout: 15_000 })

/**
 * Test mit Portal-Grundausstattung: Rückfragen (`window.confirm`) werden bestätigt, und jeder Konsolen- oder
 * Seitenfehler lässt den Test scheitern.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
      page.on('dialog', (dialog) => void dialog.accept())
      await use(errors)
      expect(errors, 'Fehler in der Browserkonsole').toEqual([])
    },
    { auto: true },
  ],
})

/* ── Orte auf der Seite ──────────────────────────────────────────────────── */

/** Die geöffnete Detailseite (Vorgang, Fragebogen, Anmeldung, Jurymitglied …). */
export const sheet = (page: Page) => page.locator('article[data-portal-page]')

export const demoPanel = (page: Page) => page.getByRole('dialog', { name: 'Demo-Steuerung' })

export const adminNav = (page: Page) => page.locator('nav[aria-label="Verwaltungsbereiche"]')

/** Aktive Phase der Zeitleiste. */
export const currentPhase = (page: Page) => page.locator('[aria-current="step"]').first()

/** Normalisierter Text eines Bereichs (für Abfragen, die mehrere Bedingungen verknüpfen). */
export const textOf = async (locator: Locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ')

/* ── Abläufe ─────────────────────────────────────────────────────────────── */

export async function login(page: Page, email: string, password: string = DEMO_PASSWORD) {
  await page.goto(`${PORTAL}/anmelden`)
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).last().click()
}

/** Anmelden und warten, bis die Login-Seite verlassen ist. */
export async function loginAs(page: Page, email: string, password: string = DEMO_PASSWORD) {
  await login(page, email, password)
  await page.waitForURL((url) => !url.pathname.endsWith('/anmelden'))
}

/** Auf kleinen Bildschirmen liegt die Seitenleiste hinter „Menü“ – vor einem Klick darin öffnen. */
export async function openMenuIfCollapsed(page: Page) {
  const menu = page.getByRole('button', { name: 'Menü', exact: true })
  if (await menu.isVisible()) await menu.click()
}

export async function logout(page: Page) {
  await openMenuIfCollapsed(page)
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await page.waitForURL('**/portal/anmelden')
}

export async function openDemoPanel(page: Page) {
  await openMenuIfCollapsed(page)
  await page.getByRole('button', { name: 'Demo-Steuerung' }).click()
  await expect(demoPanel(page)).toBeVisible()
}

/** Perspektive über die Demo-Steuerung wechseln (ohne Passwort). */
export async function switchPerspective(page: Page, label: 'Bewerber' | 'Verwaltung' | 'Jury') {
  await openDemoPanel(page)
  await demoPanel(page).getByRole('button', { name: label, exact: true }).click()
  await expect(demoPanel(page)).toBeHidden()
}

/** NEWEDGE-Szenario der Demo-Steuerung auslösen. */
export async function runScenario(page: Page, title: RegExp) {
  await openDemoPanel(page)
  await demoPanel(page).getByRole('button', { name: title }).click()
  await expect(demoPanel(page)).toBeHidden()
}

/** In der Verwaltung einen Vorgang über seinen Namen öffnen. */
export async function openCase(page: Page, company: RegExp) {
  await page.locator('main').getByRole('button', { name: new RegExp(`Öffnen\\s*:\\s*${company.source}`) }).first().click()
  await expect(sheet(page)).toBeVisible()
}

/** Aus dem Vorgang der Verwaltung in die Sicht des Bewerbers wechseln (Demo). */
export async function openApplicantView(page: Page) {
  await sheet(page).getByRole('button', { name: /^(Bewerberansicht öffnen|Ansicht der vorschlagenden Person öffnen|Ansicht öffnen)$/ }).click()
  await page.waitForURL('**/portal/vorgang/**')
  await expect(sheet(page)).toBeVisible()
}

/** Einen Steuerungsbutton im Vorgang der Verwaltung drücken. */
export async function control(page: Page, name: string) {
  const button = sheet(page).getByRole('button', { name, exact: true })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

/** Bereich der Seitenleiste – der Name kann eine Zahl offener Vorgänge tragen („Jury 1 offen“). */
export const navLink = (page: Page, name: string, includeHidden = false) =>
  adminNav(page).getByRole('link', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s?\\d+\\s?offen)?$`), includeHidden })

export async function openArea(page: Page, name: string) {
  await openMenuIfCollapsed(page)
  await navLink(page, name).click()
  // Mobil schließt die Schublade nach dem Klick – die Leiste ist dann verborgen, aber weiter maßgeblich.
  await expect(navLink(page, name, true)).toHaveAttribute('aria-current', 'page')
}

/** Kein seitliches Scrollen der Seite. */
export async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
}
