import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { About } from './About.tsx'

const isAbout = location.pathname.replace(/\/$/, '') === '/about'
if (isAbout) document.title = 'About cloudtally'

createRoot(document.getElementById('root')!).render(<StrictMode>{isAbout ? <About /> : <App />}</StrictMode>)
