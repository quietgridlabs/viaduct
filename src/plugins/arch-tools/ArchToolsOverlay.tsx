import { useEffect, useRef, useSyncExternalStore } from 'react'
import LinterPanel from './linter/LinterPanel'
import {
  closeArchToolsPanel,
  getArchToolsPanel,
  subscribeArchToolsPanel,
} from './uiState'

export default function ArchToolsOverlay() {
  const panel = useSyncExternalStore(subscribeArchToolsPanel, getArchToolsPanel, () => null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!panel) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (panelRef.current?.contains(target)) return
      if (target.closest('[data-arch-tools-trigger]')) return
      /* The finding dialog is portalled out of the panel's subtree. */
      if (target.closest('[data-arch-tools-dialog]')) return
      closeArchToolsPanel()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeArchToolsPanel()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [panel])

  if (!panel) return null

  return panel === 'linter' ? (
    <LinterPanel onClose={closeArchToolsPanel} panelRef={panelRef} />
  ) : null
}
