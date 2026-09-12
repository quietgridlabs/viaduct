import GlobalSearchBar from '@components/GlobalSearchBar';
import ToolsRail from '@components/ToolsRail';
import WorkspaceNavPill from '@components/WorkspaceNavPill';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  CANVAS_CHROME_INSET,
  CANVAS_CHROME_TOP,
  CANVAS_CHROME_Z,
  workspaceChromeRowCss,
} from '@theme/sidePanelLayout';
import { Moon, BookOpen, Settings, Sun } from 'lucide-react';
import { Box, HStack } from '@chakra-ui/react';
import NavDuck from '@components/NavDuck';
import SettingsDialog from '@components/settings';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import PortalTarget from '@slots/PortalTarget';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ToolbarProps } from './types';

const Toolbar = memo(
  ({
    onExport,
    onExportError,
    onImport,
    model,
    projectName,
    projectMode = false,
    importLoading = false,
    onRenameProject,
    onWebhooks,
    viewOnly = false,
    readOnly = false,
    canImport = true,
    center,
    hideTools = false,
    onCanvas = true,
  }: ToolbarProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { mode, toggleColorMode } = useColorMode();
    const glass = useGlassSurface();
    const [settingsOpen, setSettingsOpen] = useState(false);

    const chromePos = onCanvas ? 'absolute' : 'fixed';

    return (
      <>
        <Box
          position={chromePos}
          top={CANVAS_CHROME_TOP}
          left={CANVAS_CHROME_INSET}
          right={CANVAS_CHROME_INSET}
          zIndex={CANVAS_CHROME_Z}
          pointerEvents="none"
          css={workspaceChromeRowCss}
        >
          <HStack justify="space-between" align="flex-start" gap="10px" w="full">
            <Box minW={0} flex="1">
              <WorkspaceNavPill
                projectMode={projectMode}
                projectName={projectName}
                onRenameProject={onRenameProject}
                viewOnly={viewOnly}
                readOnly={readOnly}
                onCanvas={onCanvas}
              />
            </Box>

            <HStack gap="8px" align="center" flexShrink={0} pointerEvents="none">
              <HStack
                gap="0"
                px="4px"
                py="6px"
                pointerEvents="auto"
                align="center"
                {...glass.floatBar}
              >
                {hideTools ? null : <GlobalSearchBar projectName={projectName ?? undefined} />}
                <PortalTarget id="toolbar-actions-after" />
              </HStack>

              <HStack
                gap="4px"
                px="8px"
                py="6px"
                pointerEvents="auto"
                align="center"
                {...glass.floatBar}
              >
                <NavDuck size={22} />

                <PortalTarget id="toolbar-actions-before" />

                <ToolbarIconButton
                  data-testid="toolbar-docs"
                  data-tour="help"
                  onClick={() => {
                    leaveWorkspaceOverlays();
                    const from = `${location.pathname}${location.search}`;
                    try {
                      sessionStorage.setItem('c4-docs-return', from);
                    } catch {
                      /* ignore */
                    }
                    navigate('/docs', { state: { from } });
                  }}
                  aria-label={t('documentation_help')}
                  title={t('documentation_help')}
                >
                  <BookOpen size={TOOLBAR_ICON_SIZE} />
                </ToolbarIconButton>

                <ToolbarIconButton
                  data-tour="theme"
                  onClick={toggleColorMode}
                  aria-label={mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                  title={mode === 'light' ? 'Dark theme' : 'Light theme'}
                >
                  {mode === 'light' ? (
                    <Moon size={TOOLBAR_ICON_SIZE} />
                  ) : (
                    <Sun size={TOOLBAR_ICON_SIZE} />
                  )}
                </ToolbarIconButton>

                <ToolbarIconButton
                  data-testid="toolbar-settings"
                  data-tour="settings"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings size={TOOLBAR_ICON_SIZE} />
                </ToolbarIconButton>

              </HStack>
            </HStack>
          </HStack>
        </Box>

        {center ? (
          <Box
            position={chromePos}
            top={CANVAS_CHROME_TOP}
            left="50%"
            transform="translateX(-50%)"
            zIndex={CANVAS_CHROME_Z}
            maxW="min(420px, calc(100% - 280px))"
            pointerEvents="auto"
            px="12px"
            py="8px"
            {...glass.floatBar}
          >
            {center}
          </Box>
        ) : null}

        {!hideTools && onExport && onImport ? (
          <ToolsRail
            onExport={onExport}
            onImport={onImport}
            model={model}
            importLoading={importLoading}
            onWebhooks={onWebhooks}
            viewOnly={viewOnly}
            readOnly={readOnly}
            canImport={canImport}
            onCanvas={onCanvas}
            onExportError={onExportError}
          />
        ) : null}

        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }
);
Toolbar.displayName = 'Toolbar';

export default Toolbar;
