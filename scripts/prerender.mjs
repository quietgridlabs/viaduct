#!/usr/bin/env node
/**
 * Snapshots the public routes into static HTML after `vite build`.
 *
 * The app is a client-rendered SPA: without this, the first thing a crawler
 * receives is an empty `<div id="root">` and everything depends on it choosing
 * to run our JavaScript. Prerendering hands Google (and the first paint) the
 * finished markup, including the per-route title, meta and JSON-LD that
 * `SeoRouteMeta` writes at runtime.
 *
 * The output still boots the SPA — React replaces the DOM on mount — so this is
 * a delivery optimisation, not a second implementation to keep in sync.
 *
 *   npm run build            # runs this automatically
 *   node scripts/prerender.mjs [--dist dist]
 *
 * Needs Chrome. Without it the step logs and exits 0, so a build on a machine
 * without a browser still produces a working (un-prerendered) bundle.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { PUBLIC_ROUTES, SITE_URL, outputFileFor } from './publicRoutes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const distArg = process.argv.indexOf('--dist');
const DIST = path.resolve(ROOT, distArg > -1 ? process.argv[distArg + 1] : 'dist');

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

/** Static server with the SPA fallback nginx uses in production. */
function serveDist(port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // The app calls /api/me on boot; answer it the way a signed-out visitor
    // would be answered, instead of leaving the request hanging.
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"user":null}');
      return;
    }
    /* Mirrors nginx: `try_files $uri $uri/index.html $uri/ /index.html`, so a
       prerendered route is served here exactly as it will be in production. */
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const candidates = [
      path.join(DIST, rel),
      path.join(DIST, rel, 'index.html'),
      path.join(DIST, 'index.html'),
    ];
    const file = candidates.find((candidate) => {
      try {
        return existsSync(candidate) && path.extname(candidate) !== '';
      } catch {
        return false;
      }
    });
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

/** A single CDP call may not outlive this; the browser can die mid-build. */
const CALL_TIMEOUT_MS = 20_000;

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl, { maxPayload: 256 * 1024 * 1024 });
  const pending = new Map();
  let nextId = 1;
  let sessionId = null;
  let closed = null;

  const ready = new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  /* Without this, a crashed Chrome leaves every request hanging forever and the
     build never finishes — which is exactly what a CI job cannot recover from. */
  const failAll = (reason) => {
    closed = closed || new Error(reason);
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(closed);
    }
    pending.clear();
  };
  ws.on('close', () => failAll('devtools connection closed'));
  ws.on('error', (err) => failAll(`devtools error: ${err.message}`));

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}, useSession = true) =>
    new Promise((resolve, reject) => {
      if (closed) {
        reject(closed);
        return;
      }
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out after ${CALL_TIMEOUT_MS} ms`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      ws.send(
        JSON.stringify({ id, method, params, ...(useSession && sessionId ? { sessionId } : {}) })
      );
    });

  return {
    ready,
    send,
    attach: (id) => {
      sessionId = id;
    },
    fail: failAll,
    close: () => ws.close(),
  };
}

/**
 * Runtime-only nodes and state that must not be frozen into the snapshot: the
 * analytics tag re-injects itself and a stale one would load twice, while
 * `data-page-scroll` belongs to the public page that is mounted right now.
 * Every unknown route falls back to this file, so a baked scroll flag would
 * un-lock the editor's full-height layout and collapse it to its footer.
 */
const CLEAN_SNAPSHOT = `(() => {
  document.querySelectorAll('script[data-c4-analytics]').forEach((n) => n.remove());
  document.documentElement.removeAttribute('data-page-scroll');
  document.documentElement.setAttribute('data-prerendered', 'true');

  /* Emotion inserts its rules straight into the CSSOM, so serializing the
     document keeps the class names and loses every style. Write the rules back
     into their own <style> tags, or the snapshot paints unstyled text until the
     bundle boots. */
  document.querySelectorAll('style[data-emotion]').forEach((tag) => {
    if (tag.textContent) return;
    const sheet = tag.sheet;
    if (!sheet) return;
    let css = '';
    try {
      for (const rule of sheet.cssRules) css += rule.cssText;
    } catch {
      return;
    }
    tag.textContent = css;
  });

  return '<!doctype html>\\n' + document.documentElement.outerHTML;
})()`;

/** One sitemap, generated from the same route list, stamped with the build date. */
function writeSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_ROUTES.map((route) =>
    [
      '  <url>',
      `    <loc>${SITE_URL}${route.path === '/' ? '/' : route.path}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      '  </url>',
    ].join('\n')
  ).join('\n');
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
  writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  console.log(`prerender: sitemap.xml with ${PUBLIC_ROUTES.length} urls`);
}

/** Whole-step budget: prerendering is a nice-to-have, never a reason to hang a build. */
const TOTAL_BUDGET_MS = Number(process.env.PRERENDER_TIMEOUT_MS || 120_000);

async function main() {
  if (process.env.PRERENDER === '0') {
    console.warn('prerender: disabled by PRERENDER=0');
    return;
  }
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error(`prerender: ${path.relative(ROOT, DIST)}/index.html not found — run vite build first`);
    process.exit(1);
  }

  writeSitemap();

  const chrome = CHROME_CANDIDATES.find((bin) => existsSync(bin));
  if (!chrome) {
    console.warn('prerender: no Chrome found (set CHROME_BIN) — shipping the SPA without static HTML');
    return;
  }

  const port = 4173 + Math.floor(Math.random() * 400);
  const server = await serveDist(port);
  const debugPort = port + 1000;
  const profile = path.join(tmpdir(), `viaduct-prerender-${port}`);

  const browser = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      '--window-size=1280,900',
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      /* Docker gives /dev/shm 64 MB by default; Chrome runs out of it and dies
         mid-render unless it is told to use /tmp instead. */
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--mute-audio',
    ],
    { stdio: 'ignore' }
  );

  let browserExit = null;
  browser.on('exit', (code, signal) => {
    browserExit = `chrome exited (code ${code}, signal ${signal})`;
  });

  let wsUrl = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      wsUrl = (await res.json()).webSocketDebuggerUrl;
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!wsUrl) {
    browser.kill();
    server.close();
    console.warn('prerender: Chrome did not start — shipping the SPA without static HTML');
    return;
  }

  const cdp = connect(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }, false);
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }, false);
  cdp.attach(sessionId);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  // The app falls back to the dark theme when the visitor has no preference;
  // snapshot the same one so the static paint matches the default.
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let written = 0;
  for (const route of PUBLIC_ROUTES) {
    if (Date.now() > deadline) {
      console.warn(`prerender: out of time after ${written} route(s) — the rest ship as SPA`);
      break;
    }
    if (browserExit) {
      console.warn(`prerender: ${browserExit} — remaining routes ship as SPA`);
      break;
    }

    let html;
    try {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}${route.path}` });
      // Wait for the route to settle: auth resolves, lazy chunk loads, meta lands.
      await sleep(2500);

      const res = await cdp.send('Runtime.evaluate', {
        expression: CLEAN_SNAPSHOT,
        returnByValue: true,
        awaitPromise: true,
      });
      html = res.result?.value;
    } catch (err) {
      console.warn(`prerender: ${route.path} failed — ${err.message}`);
      if (browserExit || /closed|timed out/.test(err.message)) break;
      continue;
    }
    if (typeof html !== 'string' || !html.includes('id="root"')) {
      console.warn(`prerender: ${route.path} produced no usable markup — left as SPA`);
      continue;
    }
    if (!/<h1|<main/i.test(html)) {
      console.warn(`prerender: ${route.path} rendered without content — left as SPA`);
      continue;
    }

    const out = path.join(DIST, outputFileFor(route.path));
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, html);
    written += 1;
    console.log(`prerender: ${route.path} → ${path.relative(ROOT, out)} (${Math.round(html.length / 1024)} kB)`);
  }

  cdp.close();
  browser.kill('SIGKILL');
  server.close();
  console.log(`prerender: ${written}/${PUBLIC_ROUTES.length} routes written`);
}

/* Last line of defence: whatever happens — a wedged browser, a socket that
   never closes — the step ends and the build moves on. */
const watchdog = setTimeout(
  () => {
    console.warn('prerender: watchdog fired, giving up and shipping the SPA');
    process.exit(0);
  },
  TOTAL_BUDGET_MS + 60_000
);
watchdog.unref();

main()
  .catch((err) => {
    // A failed snapshot must not fail the build: the SPA still works.
    console.warn('prerender: skipped —', err.message);
  })
  .finally(() => {
    clearTimeout(watchdog);
    // Handles the static server or Chrome may still hold open must not keep the
    // build waiting on an otherwise finished step.
    process.exit(0);
  });
