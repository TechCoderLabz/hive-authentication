import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { HiveSignerCallback } from './components/HiveSignerCallback.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/hivesignerlogin" element={<HiveSignerCallback />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
