import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on 0.0.0.0 (all network interfaces), not just localhost, so
    // `npm run dev` is reachable from other devices (e.g. a phone) on the
    // same Wi-Fi network. Vite prints the exact LAN URL to use on startup.
    host: true,
  },
})
