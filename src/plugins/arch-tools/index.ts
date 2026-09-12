import type { C4Plugin } from '../registry'
import { createElement } from 'react'
import ArchToolsOverlay from './ArchToolsOverlay'
import ArchToolsToolbar from './ArchToolsToolbar'

const plugin: C4Plugin = {
  name: 'arch-tools',
  version: '0.1.0',
  setup(registry) {
    registry.registerPortal('toolbar-actions-after', createElement(ArchToolsToolbar))
    registry.registerPortal('global-overlay', createElement(ArchToolsOverlay))
  },
}

export default plugin
