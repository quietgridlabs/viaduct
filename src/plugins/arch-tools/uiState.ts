type ArchToolsPanel = 'linter' | null
type Listener = () => void

type ArchToolsUiStore = {
  panel: ArchToolsPanel
  listeners: Set<Listener>
}

/**
 * Must live on globalThis: arch-tools is both statically imported (EditorPage)
 * and dynamically loaded as a plugin. Separate module instances would otherwise
 * fork the panel flag and desync the overlay from EditorPage subscriptions.
 */
const STORE_KEY = '__c4ArchToolsUi__'

function getStore(): ArchToolsUiStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: ArchToolsUiStore }
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      panel: null,
      listeners: new Set(),
    }
  }
  return g[STORE_KEY]
}

function emit() {
  getStore().listeners.forEach((l) => l())
}

export function getArchToolsPanel() {
  return getStore().panel
}

export function openArchToolsPanel(next: ArchToolsPanel) {
  getStore().panel = next
  emit()
}

export function toggleArchToolsPanel(next: Exclude<ArchToolsPanel, null>) {
  const store = getStore()
  store.panel = store.panel === next ? null : next
  emit()
}

export function closeArchToolsPanel() {
  getStore().panel = null
  emit()
}

export function subscribeArchToolsPanel(listener: Listener) {
  const { listeners } = getStore()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
