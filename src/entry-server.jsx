import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.jsx'

export { ROUTES, NOT_FOUND, SITE } from './routes.js'

export function render(route) {
  return renderToString(
    <StrictMode>
      <App route={route} />
    </StrictMode>,
  )
}
