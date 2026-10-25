import { defineConfig, devices } from '@playwright/test'

/**
 * Browser-Tests des Teilnehmerportals (tests/e2e). Ein laufender Dev-Server wird mitbenutzt, sonst startet die
 * Konfiguration `pnpm dev`. Port über `PORT` (Standard 3000).
 *
 * Browser einmalig installieren: `pnpm exec playwright install chromium`. Alternativ zeigt `PORTAL_CHROMIUM_PATH` auf
 * ein vorhandenes Chromium.
 */
const port = process.env.PORT ?? '3000'
const executablePath = process.env.PORTAL_CHROMIUM_PATH

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: executablePath ? { ...devices['Desktop Chrome'], launchOptions: { executablePath } } : { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    reuseExistingServer: true,
    url: `http://localhost:${port}/portal`,
    timeout: 180_000,
  },
})
