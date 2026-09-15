import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'cd ../backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000', url: 'http://127.0.0.1:8000/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
})
