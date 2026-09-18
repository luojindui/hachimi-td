import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 项目站点部署在 /hachimi-td/ 子路径下（CI 里通过环境变量开启）
  base: process.env.GITHUB_PAGES === 'true' ? '/hachimi-td/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    globals: false,
  },
})
