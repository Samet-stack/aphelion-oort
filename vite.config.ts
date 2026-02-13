/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,ts,tsx}'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                '**/*.config.{js,ts}',
                '**/types.ts',
            ],
        },
    },
    server: {
        // Needed to access the dev server from a phone on the same Wi‑Fi (e.g. iPhone Safari).
        host: true,
        // Avoid CORS issues in dev by proxying API calls through Vite.
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return undefined
                    }
                    if (id.includes('jspdf')) {
                        return 'pdf-core'
                    }
                    if (id.includes('html2canvas')) {
                        return 'canvas-core'
                    }
                    if (id.includes('dompurify')) {
                        return 'sanitize-core'
                    }
                    if (id.includes('framer-motion')) {
                        return 'motion-vendor'
                    }
                    if (
                        id.includes('/react/') ||
                        id.includes('/react-dom/') ||
                        id.includes('react-router-dom') ||
                        id.includes('@tanstack/react-query')
                    ) {
                        return 'react-vendor'
                    }
                    if (id.includes('lucide-react')) {
                        return 'ui-vendor'
                    }
                    return undefined
                },
            },
        },
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo.png'],
            // Workaround: in some environments Workbox SW bundling can crash when
            // minifying via terser ("Unexpected early exit ... (terser) renderChunk").
            // Generating an unminified SW keeps `npm run build` reliable.
            workbox: {
                mode: 'development',
                disableDevLogs: true,
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) => request.destination === 'document',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'siteflow-pages',
                            networkTimeoutSeconds: 3,
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 7 * 24 * 60 * 60,
                            },
                        },
                    },
                    {
                        urlPattern: ({ request }) =>
                            request.destination === 'script' ||
                            request.destination === 'style' ||
                            request.destination === 'worker',
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'siteflow-assets',
                            expiration: {
                                maxEntries: 120,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
            manifest: {
                name: 'SiteFlow Pro',
                short_name: 'SiteFlow',
                description: 'Automated Construction Reporting',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'logo.png',
                        sizes: '1024x1024',
                        type: 'image/png'
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
})
