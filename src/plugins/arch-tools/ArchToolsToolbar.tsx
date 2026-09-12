import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton'
import { Box } from '@chakra-ui/react'
import { ListChecks } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import {
  isSequenceEditorOpen,
  subscribeSequenceEditor,
} from '../sequence-editor/uiState'
import {
  closeArchToolsPanel,
  getArchToolsPanel,
  subscribeArchToolsPanel,
  toggleArchToolsPanel,
} from './uiState'

export default function ArchToolsToolbar() {
  const { t } = useTranslation()
  const panel = useSyncExternalStore(subscribeArchToolsPanel, getArchToolsPanel, () => null)
  const sequenceOpen = useSyncExternalStore(
    subscribeSequenceEditor,
    isSequenceEditorOpen,
    () => false
  )
  const linterOpen = panel === 'linter'

  useEffect(() => {
    if (sequenceOpen && panel) closeArchToolsPanel()
  }, [sequenceOpen, panel])

  return (
    <Box display="inline-flex" alignItems="center" data-arch-tools-trigger position="relative">
      <ToolbarIconButton
        onClick={() => toggleArchToolsPanel('linter')}
        disabled={sequenceOpen}
        aria-label={t('linter_title', { defaultValue: 'Linter' })}
        aria-pressed={linterOpen}
        active={linterOpen}
        title={
          sequenceOpen
            ? t('sequence_tools_disabled_while_editing')
            : t('linter_title', { defaultValue: 'Linter' })
        }
        data-testid="arch_tools_linter_toggle"
      >
        <ListChecks size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>
    </Box>
  )
}
