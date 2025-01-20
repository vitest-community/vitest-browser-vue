import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'vue',
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
  optimizeDeps: {
    include: ['vitest-browser-vue'],
  },
})
