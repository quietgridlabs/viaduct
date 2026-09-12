import { AuthProvider } from '@contexts/AuthContext';
import { ColorModeProvider } from '@contexts/ColorModeContext';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import QueryProvider from '@app/providers/QueryProvider';
import './i18n';
import './index.css';
import RootProviderSlot from './RootProviderSlot.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ColorModeProvider>
        <BrowserRouter>
          <AuthProvider>
            <RootProviderSlot>
              <App />
            </RootProviderSlot>
          </AuthProvider>
        </BrowserRouter>
      </ColorModeProvider>
    </QueryProvider>
  </StrictMode>
);
