import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useGlassSurface } from '@theme/glassSurfaces';
import { HStack, Slider } from '@chakra-ui/react';
import { useReactFlow, useStore } from '@xyflow/react';
import { Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Zoom chrome — slider + fit, same icon language as ToolsRail. */
export default function CanvasZoomBar() {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { zoomTo, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const minZoom = useStore((s) => s.minZoom);
  const maxZoom = useStore((s) => s.maxZoom);

  return (
    <HStack
      role="toolbar"
      aria-label={t('canvas_zoom_controls')}
      gap="6px"
      px="8px"
      py="6px"
      className="nopan nodrag"
      {...glass.floatBar}
    >
      <Slider.Root
        size="sm"
        min={minZoom}
        max={maxZoom}
        step={0.01}
        value={[zoom]}
        onValueChange={(d) => {
          const next = d.value[0];
          if (typeof next === 'number') void zoomTo(next);
        }}
        w="88px"
        colorPalette="brand"
        aria-label={[t('canvas_zoom_controls')]}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Slider.Control h="28px" display="flex" alignItems="center">
          <Slider.Track h="3px" bg="border.default" borderRadius="full">
            <Slider.Range bg="brand.emphasis" />
          </Slider.Track>
          <Slider.Thumbs
            boxSize="12px"
            bg="brand.emphasis"
            borderWidth="2px"
            borderColor="white"
            shadow="sm"
            _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px var(--chakra-colors-border-brand-emphasis)' }}
          />
        </Slider.Control>
      </Slider.Root>
      <ToolbarIconButton
        title={t('fit_view')}
        aria-label={t('fit_view')}
        onClick={() => void fitView({ padding: 0.2 })}
      >
        <Maximize2 size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>
    </HStack>
  );
}
