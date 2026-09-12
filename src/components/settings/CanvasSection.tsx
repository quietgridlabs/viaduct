import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import {
  getNodeSurface,
  neutralAccentColor,
  readableAccent,
} from '@theme/canvasSurfaces';
import { setCanvasPrefs } from '@/state/canvasPrefs';
import ColorOption, { Swatch } from './ColorOption';
import SettingRow from './SettingRow';
import type { CanvasPrefs } from '@/state/canvasPrefs';

const TECH_PREVIEW = ['#f1e05a', '#336791'];
const SWATCH_W = '30px';
const SWATCH_H = '20px';

type CanvasSectionProps = {
  prefs: CanvasPrefs;
  mode: 'light' | 'dark';
};

/** A line the width of a swatch, standing in for a relationship. */
function EdgeSwatch({ color }: { color: string }) {
  return (
    <Box w={SWATCH_W} h={SWATCH_H} display="grid" placeItems="center">
      <Box w={SWATCH_W} h="2px" borderRadius="2px" bg={color} />
    </Box>
  );
}

/** How the board is coloured. Saved per browser, not per project. */
export default function CanvasSection({ prefs, mode }: CanvasSectionProps) {
  return (
    <VStack align="stretch" gap="20px">
      <SettingRow
        title="Element colours"
        hint="Colour cards by the technology they run on, or keep the board colourless. Either way a third-party system still reads as someone else's."
      >
        <HStack gap="10px" align="stretch" role="radiogroup">
          <ColorOption
            active={prefs.nodeColors === 'technology'}
            label="By technology"
            hint="Each card takes its stack colour."
            onSelect={() => setCanvasPrefs({ nodeColors: 'technology' })}
            preview={TECH_PREVIEW.map((color) => {
              const surface = getNodeSurface(readableAccent(color, mode), mode);
              return (
                <Swatch
                  key={color}
                  fill={`linear-gradient(${surface.tint}, ${surface.tint}), ${surface.bg}`}
                  border={surface.border}
                />
              );
            })}
          />
          <ColorOption
            active={prefs.nodeColors === 'neutral'}
            label="Neutral"
            hint="One grey for ours, a lighter one for external."
            onSelect={() => setCanvasPrefs({ nodeColors: 'neutral' })}
            preview={(['own', 'external'] as const).map((role) => {
              const accent = neutralAccentColor(mode, role === 'external');
              const surface = getNodeSurface(accent, mode, 'idle', role);
              return <Swatch key={role} fill={surface.bg} border={surface.border} />;
            })}
          />
        </HStack>
      </SettingRow>

      <SettingRow
        title="Relationship colours"
        hint="The same choice for the arrows between elements, including their labels and arrowheads."
      >
        <HStack gap="10px" align="stretch" role="radiogroup">
          <ColorOption
            active={prefs.edgeColors === 'technology'}
            label="By technology"
            hint="Arrows take the colour of what flows over them."
            onSelect={() => setCanvasPrefs({ edgeColors: 'technology' })}
            preview={TECH_PREVIEW.map((color) => (
              <EdgeSwatch key={color} color={readableAccent(color, mode)} />
            ))}
          />
          <ColorOption
            active={prefs.edgeColors === 'neutral'}
            label="Neutral"
            hint="One quiet grey for every relationship."
            onSelect={() => setCanvasPrefs({ edgeColors: 'neutral' })}
            preview={[0, 1].map((i) => (
              <EdgeSwatch key={i} color={neutralAccentColor(mode)} />
            ))}
          />
        </HStack>
      </SettingRow>

      <Text fontSize="xs" color="fg.muted" lineHeight="1.5">
        Saved in this browser and applied to every project you open here. Technology icons
        stay in place either way.
      </Text>
    </VStack>
  );
}
