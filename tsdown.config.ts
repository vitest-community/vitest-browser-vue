import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts', './src/pure.ts'],
  format: ['esm'],
  dts: true,
})
