import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
// @ts-expect-error — plain ESM, shared with the prerenderer and the sitemap.
import { PUBLIC_ROUTES } from './scripts/publicRoutes.mjs';

/**
 * Hands the boot script in index.html the list of routes that actually get a
 * prerendered file, so it can tell "this document belongs here" from "this is
 * the landing fallback" without the list drifting out of step.
 */
function prerenderedRoutes(): Plugin {
  const paths = JSON.stringify((PUBLIC_ROUTES as Array<{ path: string }>).map((r) => r.path));
  return {
    name: 'prerendered-routes',
    transformIndexHtml(html: string) {
      return html.replace('__PRERENDERED_ROUTES__', paths);
    },
  };
}

/** Package name a module id belongs to, or null for first-party sources. */
function packageOf(id: string): string | null {
  const marker = 'node_modules/';
  const at = id.lastIndexOf(marker);
  if (at < 0) return null;
  const parts = id.slice(at + marker.length).split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

/**
 * Heavy libraries the public pages must never download, plus the shared React
 * runtime. React needs an explicit home: left to Rollup it is folded into
 * whichever vendor chunk claims it first, and every chunk then depends on that
 * one — which is how the entry ended up importing the 9.6 MB icon set.
 */
const VENDOR_CHUNKS: Record<string, string> = {
  react: 'react',
  'react-dom': 'react',
  scheduler: 'react',
  'use-sync-external-store': 'react',

  'monaco-editor': 'monaco',
  '@monaco-editor/loader': 'monaco',
  '@monaco-editor/react': 'monaco',
  'state-local': 'monaco',

  '@xyflow/react': 'reactflow',
  '@xyflow/system': 'reactflow',

  'devicons-react': 'devicons',

  'react-syntax-highlighter': 'syntax-highlighter',
  refractor: 'syntax-highlighter',
  prismjs: 'syntax-highlighter',
  highlight: 'syntax-highlighter',
  lowlight: 'syntax-highlighter',

  '@tanstack/react-query': 'query',
  '@tanstack/query-core': 'query',
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), prerenderedRoutes()],
  base: '/',
  /*
   * Build-time constants instead of `import.meta.env` at the call site.
   *
   * The metrics module is imported by contexts that unit tests mount, and
   * `import.meta` is syntax the test runner cannot parse — so the value is
   * injected here and read through a plain identifier, with a fallback for
   * environments where it was never defined.
   */
  define: {
    __METRICS_DISABLED__: JSON.stringify(process.env.VITE_METRICS_DISABLED ?? '1'),
    __DEV_BUILD__: JSON.stringify(mode !== 'production'),
    'import.meta.env.VITE_EDITION': JSON.stringify(
      process.env.VITE_EDITION ?? 'community'
    ),
  },
  build: {
    /* Size reporting keeps the whole bundle graph in memory at the end —
       skip it in CI; the numbers are noise on the runner anyway. */
    reportCompressedSize: false,
    rollupOptions: {
      /* Cap parallel file reads so slim CI runners do not thrash (looks like a
         hang on "transforming…") or get OOM-killed (exit 137). Override with
         VITE_MAX_PARALLEL=N when the host has headroom. */
      maxParallelFileOps: Math.max(
        1,
        Number.parseInt(process.env.VITE_MAX_PARALLEL || '3', 10) || 3
      ),
      output: {
        /* Without this, modules shared by two async plugin chunks (Monaco is
           imported by both the docs and sequence editors) get hoisted into the
           entry chunk — which is how the landing page ended up shipping 16 MB. */
        manualChunks(id) {
          const normalized = id.split(path.sep).join('/');
          /* Shared runtime helpers must get their own chunk: if they land in a
             vendor chunk, every other chunk starts depending on it and the
             entry drags Monaco and the icon set back in. */
          if (
            normalized.includes('commonjsHelpers') ||
            normalized.includes('vite/preload-helper') ||
            normalized.includes('vite/modulepreload-polyfill')
          ) {
            return 'runtime';
          }
          const pkg = packageOf(normalized);
          return pkg ? VENDOR_CHUNKS[pkg] : undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@entities': path.resolve(__dirname, './src/entities'),
      '@features': path.resolve(__dirname, './src/features'),
      '@widgets': path.resolve(__dirname, './src/widgets'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@data': path.resolve(__dirname, './src/data'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@icons': path.resolve(__dirname, './src/icons'),
      '@locales': path.resolve(__dirname, './src/locales'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@plugins': path.resolve(__dirname, './src/plugins'),
      '@slots': path.resolve(__dirname, './src/slots'),
      '@theme': path.resolve(__dirname, './src/theme'),
      'monaco-editor/esm/vs/editor/editor.api.js': 'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.api': 'monaco-editor',
    },
  },
}))
