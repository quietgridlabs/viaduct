import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, Dialog, HStack, Portal, Text, VStack, chakra } from '@chakra-ui/react';
import { LayoutGrid, Moon, RotateCw, Settings, Sun } from 'lucide-react';
import { DEFAULT_CANVAS_PREFS, setCanvasPrefs, useCanvasPrefs } from '@/state/canvasPrefs';
import { useState } from 'react';
import CanvasSection from './CanvasSection';
import SettingRow from './SettingRow';

const PlainButton = chakra('button');

const TITLE_ICON_SIZE = 17;
const RAIL_ICON_SIZE = 15;
const ROW_ICON_SIZE = 14;
const DIALOG_MAX_W = '720px';
const DIALOG_MAX_H = '90vh';
const BODY_MIN_H = '320px';
const SECTION_RAIL_W = { base: '132px', sm: '178px' };

type Section = 'appearance' | 'canvas';

function isDefaultCanvasPrefs(prefs: ReturnType<typeof useCanvasPrefs>): boolean {
  return (
    prefs.nodeColors === DEFAULT_CANVAS_PREFS.nodeColors &&
    prefs.edgeColors === DEFAULT_CANVAS_PREFS.edgeColors
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Community settings: light/dark theme + canvas colour prefs. */
export default function SettingsDialog({ open, onClose }: Props) {
  const { mode, setMode } = useColorMode();
  const glass = useGlassSurface();
  const prefs = useCanvasPrefs();
  const [section, setSection] = useState<Section>('appearance');

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) {
          setSection('appearance');
          onClose();
        }
      }}
      size="md"
      placement="center"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} />
        <Dialog.Positioner>
          <Dialog.Content
            color="fg.default"
            maxH={DIALOG_MAX_H}
            w="calc(100% - 32px)"
            maxW={DIALOG_MAX_W}
            {...glass.dialog}
          >
            <Dialog.Header
              borderBottomWidth="1px"
              borderColor="border.glass"
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
              fontWeight="600"
              color="fg.default"
            >
              <Dialog.Title>
                <HStack gap="8px">
                  <Settings size={TITLE_ICON_SIZE} />
                  <Text as="span">Settings</Text>
                </HStack>
              </Dialog.Title>
            </Dialog.Header>

            <Dialog.Body p="0" display="flex" alignItems="stretch" minH={BODY_MIN_H}>
              <VStack
                align="stretch"
                gap="2px"
                w={SECTION_RAIL_W}
                flexShrink={0}
                p="10px"
                borderRightWidth="1px"
                borderColor="border.glass"
              >
                {(
                  [
                    { id: 'appearance' as const, label: 'Appearance', icon: mode === 'light' ? Sun : Moon },
                    { id: 'canvas' as const, label: 'Canvas', icon: LayoutGrid },
                  ] as const
                ).map(({ id, label, icon: Icon }) => {
                  const active = id === section;
                  return (
                    <PlainButton
                      key={id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setSection(id)}
                      display="flex"
                      alignItems="center"
                      gap="10px"
                      w="full"
                      px="10px"
                      py="8px"
                      borderRadius="8px"
                      cursor="pointer"
                      textAlign="left"
                      fontSize="sm"
                      fontWeight={active ? '600' : '500'}
                      color={active ? 'brand.text' : 'fg.muted'}
                      bg={active ? 'bg.brand.subtle' : 'transparent'}
                      _hover={{ bg: active ? 'bg.brand.muted' : 'bg.list.hover' }}
                    >
                      <Icon size={RAIL_ICON_SIZE} />
                      <Text as="span" lineClamp={1}>
                        {label}
                      </Text>
                    </PlainButton>
                  );
                })}
              </VStack>

              <Box flex="1" minW={0} px={DIALOG_PAD.bodyPx} py={DIALOG_PAD.bodyPy} overflowY="auto">
                {section === 'appearance' ? (
                  <SettingRow
                    title="Colour mode"
                    hint="Light or dark chrome for the editor. Saved in this browser."
                  >
                    <HStack gap="10px" role="radiogroup" aria-label="Colour mode">
                      {(
                        [
                          { id: 'light' as const, label: 'Light', icon: Sun },
                          { id: 'dark' as const, label: 'Dark', icon: Moon },
                        ] as const
                      ).map(({ id, label, icon: Icon }) => {
                        const active = mode === id;
                        return (
                          <PlainButton
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setMode(id)}
                            flex="1"
                            minW={0}
                            p="12px"
                            borderRadius="10px"
                            borderWidth="1px"
                            cursor="pointer"
                            borderColor={active ? 'brand.solid' : 'border.default'}
                            bg={active ? 'bg.brand.subtle' : 'transparent'}
                            _hover={{ bg: active ? 'bg.brand.subtle' : 'bg.list.hover' }}
                          >
                            <HStack gap="8px" justify="center">
                              <Icon size={16} />
                              <Text fontSize="sm" fontWeight="600">
                                {label}
                              </Text>
                            </HStack>
                          </PlainButton>
                        );
                      })}
                    </HStack>
                  </SettingRow>
                ) : (
                  <CanvasSection prefs={prefs} mode={mode} />
                )}
              </Box>
            </Dialog.Body>

            <Dialog.Footer
              borderTopWidth="1px"
              borderColor="border.glass"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="space-between"
            >
              <Button
                size="sm"
                variant="ghost"
                color="brand.text"
                visibility={section === 'canvas' && !isDefaultCanvasPrefs(prefs) ? 'visible' : 'hidden'}
                onClick={() => setCanvasPrefs(DEFAULT_CANVAS_PREFS)}
              >
                <RotateCw size={ROW_ICON_SIZE} />
                Reset to defaults
              </Button>
              <Button size="sm" variant="outline" onClick={onClose}>
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
