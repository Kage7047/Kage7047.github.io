import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import { routeFor } from './routes.js'
import './styles.css'

const root = document.getElementById('root')
const app = (
  <StrictMode>
    <App route={routeFor(window.location.pathname)} />
  </StrictMode>
)
// prerendered pages hydrate; `npm run dev` serves an empty root and renders from scratch
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
