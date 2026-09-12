import { pluginLoaders } from './bundle'
import { C4Plugin, registry } from './registry'

const defaultPlugins = [
  '@archivisio/default',
  '@archivisio/arch-tools',
  '@archivisio/sequence-editor',
  '@archivisio/docs-editor',
  '@archivisio/data-flows',
]

async function loadPlugins() {
  // Imported here, not at module scope: the SDK drags React Flow along, and
  // this module is reachable from the entry chunk.
  const { useFlatC4Store } = await import('@archivisio/c4-modelizer-sdk')
  registry.registerMethod('useStore', () => useFlatC4Store)

  const wanted = import.meta.env.VITE_PLUGINS
    ? (import.meta.env.VITE_PLUGINS ?? '').split(',').filter(Boolean)
    : defaultPlugins

  // Sequential so later plugins can override portals (e.g. global-overlay)
  for (const name of wanted) {
    const loader = (pluginLoaders as Record<string, () => Promise<{ default: C4Plugin }>>)[name]
    if (!loader) continue

    try {
      const { default: plugin } = await loader()
      plugin.setup(registry)
      console.info(`[plugin] ${plugin.name}@${plugin.version} loaded`)
    } catch (e) {
      console.error(`[plugin] ${name} load failed`, e)
    }
  }
}

/* ── Readiness store ───────────────────────────────────────────────────────
   Plugins pull in the heavy editor stack (Monaco, React Flow), so they
   are loaded on demand — public routes render without paying for them. */

let bootPromise: Promise<void> | null = null
let ready = false
const listeners = new Set<() => void>()

export function pluginsAreReady() {
  return ready
}

export function subscribeToPlugins(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Load every configured plugin once. Safe to call repeatedly. */
export function ensurePluginsLoaded(): Promise<void> {
  if (!bootPromise) {
    bootPromise = loadPlugins().then(() => {
      ready = true
      for (const listener of listeners) listener()
    })
  }
  return bootPromise
}
