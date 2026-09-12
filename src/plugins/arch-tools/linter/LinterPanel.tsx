import { useDialogs } from '@contexts/DialogContext'
import { useColorMode } from '@contexts/ColorModeContext'
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk'
import SidePanelShell, {
  PanelEmptyState,
  PanelListItem,
} from '@components/common/SidePanelShell'
import { Badge, HStack, Text } from '@chakra-ui/react'
import type { Ref } from 'react'
import { LintIssue, LintSeverity, runArchitectureLinter, summarizeIssues } from './runLinter'

const severityPalette: Record<LintSeverity, 'red' | 'orange' | 'blue'> = {
  error: 'red',
  warning: 'orange',
  info: 'blue',
}

type Props = {
  onClose: () => void
  panelRef?: Ref<HTMLDivElement>
}

export default function LinterPanel({ onClose, panelRef }: Props) {
  const { chrome } = useColorMode()
  const model = useFlatC4Store((s) => s.model)
  const setViewLevel = useFlatC4Store((s) => s.setViewLevel)
  const setActiveSystem = useFlatC4Store((s) => s.setActiveSystem)
  const setActiveContainer = useFlatC4Store((s) => s.setActiveContainer)
  const setActiveComponent = useFlatC4Store((s) => s.setActiveComponent)
  const { openEditDialog } = useDialogs()

  const issues = runArchitectureLinter(model)
  const summary = summarizeIssues(issues)

  const handleOpen = (issue: LintIssue) => {
    if (issue.navigate) {
      const nav = issue.navigate
      if (nav.activeSystemId) setActiveSystem(nav.activeSystemId)
      else if (nav.viewLevel === 'system') setActiveSystem(undefined)
      if (nav.activeContainerId) setActiveContainer(nav.activeContainerId)
      else setActiveContainer(undefined)
      if (nav.activeComponentId) setActiveComponent(nav.activeComponentId)
      else setActiveComponent(undefined)
      setViewLevel(nav.viewLevel)
    }
    if (issue.entityId && issue.entityType) {
      openEditDialog(issue.entityId, issue.entityType === 'container')
    }
  }

  return (
    <SidePanelShell
      panelRef={panelRef}
      data-panel="arch-linter"
      title="Architecture linter"
      width="380px"
      onClose={onClose}
      headerMeta={
        <HStack gap="8px" flexWrap="wrap">
          <Badge colorPalette="red" variant={summary.errors ? 'solid' : 'outline'}>
            {summary.errors} errors
          </Badge>
          <Badge colorPalette="orange" variant={summary.warnings ? 'solid' : 'outline'}>
            {summary.warnings} warnings
          </Badge>
          <Badge colorPalette="blue" variant={summary.infos ? 'solid' : 'outline'}>
            {summary.infos} info
          </Badge>
        </HStack>
      }
    >
      {issues.length === 0 ? (
        <PanelEmptyState>No issues found. Nice.</PanelEmptyState>
      ) : (
        issues.map((issue) => (
          <PanelListItem
            key={issue.id}
            onClick={() => handleOpen(issue)}
            meta={
              <>
                <Badge
                  size="sm"
                  colorPalette={severityPalette[issue.severity]}
                  textTransform="uppercase"
                  fontSize="11px"
                >
                  {issue.severity}
                </Badge>
                {issue.entityType ? (
                  <Text fontSize="xs" color={chrome.textMuted}>
                    {issue.entityType}
                  </Text>
                ) : null}
              </>
            }
            title={issue.message}
          />
        ))
      )}
    </SidePanelShell>
  )
}
