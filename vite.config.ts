import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
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
