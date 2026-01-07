import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on 0.0.0.0
    port: 80,
    watch: {
      usePolling: true, // Necessary for Docker on some systems to catch file changes
    },
  },
})
