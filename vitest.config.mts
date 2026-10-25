import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Unit-Tests der Geschäftsregeln (src/portal/domain) – ohne Browser.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
