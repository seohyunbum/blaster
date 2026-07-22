import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    // Three 단일 모듈은 500KB를 조금 넘는다. 600KB 경고선과 별개로
    // scripts/check-bundle-size.mjs가 앱/Three/합계의 더 촘촘한 ratchet을 강제한다.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5175,
    open: true,
  },
})
