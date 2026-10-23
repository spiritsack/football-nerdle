/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { SITE_BASE } from './src/pages/GuessThePlayer/constants'
import {
  RESULT_CODES,
  renderFallbackPage,
  renderResultPage,
} from './src/pages/GuessThePlayer/sharePreview'

// Static share-preview pages: `r/<code>/index.html` per daily outcome (OG tags
// unfurlers can read without JS) plus a generic `404.html`. Build output only.
function sharePreviewPages(): Plugin {
  return {
    name: 'share-preview-pages',
    apply: 'build',
    generateBundle() {
      for (const code of RESULT_CODES) {
        this.emitFile({ type: 'asset', fileName: `r/${code}/index.html`, source: renderResultPage(code) })
      }
      this.emitFile({ type: 'asset', fileName: '404.html', source: renderFallbackPage() })
    },
  }
}

export default defineConfig({
  base: SITE_BASE,
  plugins: [react(), tailwindcss(), sharePreviewPages()],
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
