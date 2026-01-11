import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Initialize PWA Elements (Camera, Toast, etc. for Web)
defineCustomElements(window);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { AuthProvider } from './contexts/AuthContext';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);