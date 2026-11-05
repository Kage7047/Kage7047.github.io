import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// User site: served from https://kage7047.github.io/
export default defineConfig({
  base: '/',
  plugins: [react()],
})
