import { ACCOUNTS, PORTAL, expect, expectNoHorizontalOverflow, loginAs, logout, openArea, openCase, sheet, test, textOf } from '../helpers/portal'

// Jury-Dashboard der Verwaltung und die beiden Jury-Arten (Use Cases 6 und 9 der Testanleitung).

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Jury: anlegen, zuweisen, bewerten (${viewport.width} px)`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(viewport)
    const s = sheet(page)
    const main = page.locator('main')
    const name = `Dr. Test ${viewport.width}`
    const email = `neu.${viewport.width}@jury.example`

    await test.step('Dashboard mit beiden Jury-Arten', async () => {
      await loginAs(page, ACCOUNTS.verwaltung)
      await openArea(page, 'Jury')
      for (const text of ['Jurymitglieder', 'Fragebögen in Jury 1', 'Offene Bewertungen', 'Jury 1 · Ersteinschätzung', 'Jury 2 · Punktevergabe', 'Jurymitglied A', 'Bearbeitet']) {
        await expect(main).toContainText(text)
      }
    })

    let password = ''
    await test.step('Mitglied anlegen und zuweisen', async () => {
      await page.getByRole('button', { name: 'Jurymitglied anlegen' }).click()
      await s.getByRole('button', { name: 'Anlegen' }).click()
      await expect(s).toContainText('Bitte geben Sie einen Namen ein')
      await expect(s).toContainText('Bitte wählen Sie die Jury-Art')
      await s.getByLabel('Name').fill(name)
      await s.getByLabel('E-Mail-Adresse').fill(email)
      await s.getByText('Jury 2 · Punktevergabe', { exact: true }).click()
      await s.getByRole('button', { name: 'Anlegen' }).click()
      await expect(s).toContainText('Jurymitglied angelegt')
      password = (await textOf(s)).match(/jury-[a-z0-9]{6}/)?.[0] ?? ''
      expect(password).not.toBe('')

      await s.getByRole('checkbox', { name: /Frankenkeramik/ }).check()
      await expect(s).toContainText(/Zugewiesen\s*1/)
      // Abgeschlossene Fälle lassen sich nicht mehr umbesetzen.
      await expect(s.getByRole('checkbox', { name: /Alpenländische/ })).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(main).toContainText(name)

      await openCase(page, /Frankenkeramik/)
      await expect(s).toContainText('Jury 1 · Ersteinschätzung')
      await expect(s).toContainText(name)
      await page.keyboard.press('Escape')
      await expect(s).toBeHidden()
      await logout(page)
    })

    await test.step('Neues Jury-2-Mitglied sieht nur die Punktevergabe', async () => {
      await loginAs(page, email, password)
      await expect(page).toHaveURL(/\/portal\/jury$/)
      await expect(main).toContainText(name)
      await expect(main).toContainText('Frankenkeramik')
      await expect(main).toContainText('Punktevergabe beginnt')
      await expect(main.locator('select').first()).toBeVisible()
      await expect(main.locator('input[type=radio]')).toHaveCount(0)
      await logout(page)
    })

    await test.step('Jury 1 stimmt ab, die Verwaltung sieht den Fortschritt', async () => {
      await loginAs(page, ACCOUNTS.jury1)
      await expect(main.locator('select')).toHaveCount(0)
      const item = page.locator('li', { hasText: 'Frankenkeramik' }).first()
      await item.getByText('Ja', { exact: true }).click()
      await expect(item).toContainText('Bewertung gespeichert')
      await expect(item).toContainText('abgegeben')
      await logout(page)

      await loginAs(page, ACCOUNTS.jury2)
      await expect(main).toContainText('Jurymitglied D')
      await logout(page)

      await loginAs(page, ACCOUNTS.verwaltung)
      await page.goto(`${PORTAL}/admin?bereich=jury`)
      await expect(page.locator('tr', { hasText: 'Jurymitglied A' }).first()).toContainText(/100\s*%|50\s*%/)
      await expectNoHorizontalOverflow(page)
    })
  })
}
