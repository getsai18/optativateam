import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initTheme } from './shared/lib/theme';

initTheme();

// Clickjacking: S3 no envía X-Frame-Options y la CSP por <meta> ignora frame-ancestors.
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try {
    if (window.top) window.top.location.href = window.self.location.href;
  } catch {
    /* el padre es de otro origen: la página queda oculta */
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
