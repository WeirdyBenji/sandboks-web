import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "/bgstats/",
  preview: {
    allowedHosts: ["b.kase-app.fr"],
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://boardgamegeek.com/xmlapi2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: {
          'User-Agent': 'BGStatsApp/1.0',
        },
      },
    },
  },
})
