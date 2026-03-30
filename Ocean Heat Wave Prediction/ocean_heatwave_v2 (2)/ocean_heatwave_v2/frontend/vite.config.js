import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy NOAA ERDDAP calls to avoid CORS in local dev
      '/erddap': {
        target: 'https://coastwatch.pfeg.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/erddap/, '/erddap'),
        secure: true,
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})
