import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'vue',
    browser: {
      enabled: true,
      name: 'chromium',
      headless: true,
      provider: 'playwright',
    },
  },
  optimizeDeps: {
    include: ['vitest-browser-vue'],
  },
})
