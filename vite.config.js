import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use an absolute base during production for GitHub Pages.
// In dev we keep the default root so HMR works normally.
export default defineConfig(({ mode }) => ({
  // mode === 'production' when running `vite build`
  base: mode === 'production' ? '/face-tracker/' : '/',
  plugins: [react()],
}))
