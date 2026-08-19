import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { ConfirmProvider } from './context/ConfirmContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>
);
