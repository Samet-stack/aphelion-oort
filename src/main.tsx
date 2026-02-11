import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './styles/utilities.css'
import './styles/components.css'

// In dev, a previously installed PWA service worker can cache old assets and make
// the app look "broken" after a refresh. Unregister it to keep local dev stable.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
    })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
)
