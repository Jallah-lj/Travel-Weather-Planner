import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
 testDir:'./e2e-supabase',timeout:30000,workers:1,
 use:{baseURL:'http://127.0.0.1:5174'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
 webServer:{command:'VITE_AUTH_PROVIDER=supabase VITE_SUPABASE_URL=https://auth.example.test VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture npm run dev -- --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:false},
})
