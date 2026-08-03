import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installWebCrashReporter } from './services/crashReporter';

// Polices auto-hébergées : la CSP du site n'autorise que `font-src 'self'`,
// un chargement depuis Google Fonts serait bloqué.
import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';

import './index.css';

// Branché avant le premier rendu : une erreur au montage doit déjà être captée.
installWebCrashReporter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
