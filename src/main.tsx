import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { queryClient } from './lib/query-client'
import './index.css'
import './styles/utilities.css'
import './styles/components.css'
import './styles/visual-overhaul.css'

declare global {
    interface Window {
        __siteflowViewportSyncInitialized?: boolean
    }
}

const syncViewportHeight = () => {
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    document.documentElement.style.setProperty('--app-vh', `${Math.round(viewportHeight)}px`)
}

if (typeof window !== 'undefined' && !window.__siteflowViewportSyncInitialized) {
    window.__siteflowViewportSyncInitialized = true
    syncViewportHeight()
    window.addEventListener('resize', syncViewportHeight, { passive: true })
    window.addEventListener('orientationchange', syncViewportHeight)
    window.visualViewport?.addEventListener('resize', syncViewportHeight)
}

// In dev, a previously installed PWA service worker can cache old assets and make
// the app look "broken" after a refresh. Unregister it to keep local dev stable.
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
    })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
)
