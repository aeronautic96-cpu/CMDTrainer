import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' = 어떤 주소(하위 경로 포함)에 올려도 동작
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 새 버전을 올리면 다음 실행 때 자동 적용
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'aircraft/*.webp'],
      manifest: {
        name: '787-9 Descent Energy Trainer',
        short_name: 'Descent',
        description: 'B787-9 강하 계획 · 에너지 관리 훈련',
        lang: 'ko',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0e1a',
        theme_color: '#0a0e1a',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 전체(코드, 폰트, 이미지)를 미리 저장해서 오프라인에서도 실행
        globPatterns: ['**/*.{js,css,html,webp,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
