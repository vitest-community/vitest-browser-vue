import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'vue',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
        {
          browser: 'chromium',
          name: 'custom-testid',
          include: ['./test/render-selector.test.ts'],
          locators: { testIdAttribute: 'data-custom-test-id' },
        },
      ],
    },
  },
  optimizeDeps: {
    include: ['vitest-browser-vue'],
  },
})
