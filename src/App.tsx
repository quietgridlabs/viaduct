import PluginBoot from '@components/PluginBoot';
import SeoRouteMeta from '@components/SeoRouteMeta';
import RouteFallback from '@components/RouteFallback';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { syncPageScroll } from '@hooks/usePageScroll';

/* The editor pulls in the whole modelling stack (Monaco, React Flow) and
   the plugin registry. Public routes must not pay for any of it, so everything
   below is split out and loaded on demand. */
const EditorPage = lazy(() => import('./pages/EditorPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const WorkspaceProviders = lazy(() => import('@components/WorkspaceProviders'));

/** Editor routes additionally need the plugin registry and their providers. */
function Workspace({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <PluginBoot fallback={<RouteFallback />}>
        <WorkspaceProviders>{children}</WorkspaceProviders>
      </PluginBoot>
    </Suspense>
  );
}

function Public({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function App() {
  const { pathname } = useLocation();

  /* Runs after the route's own effects, so a public page has already staked its
     claim by now and only a stale flag — inherited from prerendered HTML or a
     page that never unmounted cleanly — gets cleared. */
  useEffect(() => {
    syncPageScroll();
  }, [pathname]);

  return (
    <>
      <SeoRouteMeta />
      <Routes>
        {/* Community MVP: land in the local editor */}
        <Route path="/" element={<Navigate to="/editor" replace />} />
        <Route path="/editor" element={<Workspace><EditorPage /></Workspace>} />
        <Route path="/catalog" element={<Workspace><EditorPage initialOverlay="catalog" /></Workspace>} />
        <Route path="/flows" element={<Workspace><EditorPage initialOverlay="flows" /></Workspace>} />
        <Route path="/docs" element={<Public><DocsPage /></Public>} />
        <Route path="/terms" element={<Public><TermsPage /></Public>} />
        <Route path="/privacy" element={<Public><PrivacyPage /></Public>} />
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </>
  );
}

export default App;
