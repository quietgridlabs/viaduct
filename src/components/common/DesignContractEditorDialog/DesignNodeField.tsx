import DesignSourceKindIcon from '@components/common/DesignSourceKindIcon';
import ThemedSelect from '@components/common/ThemedSelect';
import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import type { ModelWithDesignSystems } from '@/types/c4Extensions';
import {
  buildNodeRef,
  listFigmaSystems,
  parseFigmaUrl,
  readNodeValue,
  resolveNodeHref,
  systemFileKey,
} from '@utils/designNodeRef';
import { Box, HStack, IconButton, Input, Text } from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The value that means "not one of the recorded files — I have a link". */
const LINK_MODE = '__link';

const ROW_H = '40px';

type Props = {
  model: ModelWithDesignSystems;
  /** The contract's `@design`, in whichever form it is written. */
  value: string;
  /** The system this element already answers to, offered first. */
  preferredSystem?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
};

/**
 * Which frame an element is built from, named rather than pasted.
 *
 * A Figma link is mostly file key, slug and tracking parameters, identical
 * across every element of one front end, with four digits at the end that
 * differ. Making somebody paste the whole thing each time is asking them to
 * carry the constant part by hand — and it is the part that goes wrong, since
 * a link copied from the wrong tab points at the wrong file and nothing here
 * would know.
 *
 * So the file is chosen once, from the design systems the project already
 * records, and what gets typed is the node id. What is stored is
 * `public-web#7:25`, which the server resolves back to a link.
 *
 * A link still works: pasting one is the fastest way to fill both halves, and
 * if its file is a system this project knows, it collapses into the short form
 * on the spot. A link to a file nobody has recorded stays a link, because
 * inventing a system name for it would be a lie.
 */
export default function DesignNodeField({
  model,
  value,
  preferredSystem,
  disabled,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  /* One height for the whole row. The select and the input come from
     different recipes whose defaults do not agree, and two controls side by
     side at different heights read as a bug rather than as two sizes. */
  const inputStyles = { ...fieldSurfaceFlatStyles(chrome), h: ROW_H, minH: ROW_H };

  const systems = useMemo(() => listFigmaSystems(model), [model]);

  /*
   * The node id is held as typed. Reading it back out of the stored value on
   * every keystroke would round-trip it through a form that cannot hold a
   * half-written id — `7:` is not a node, so it would serialise to nothing and
   * the field would erase itself mid-word.
   */
  const [nodeText, setNodeText] = useState('');
  const [system, setSystem] = useState('');
  /* What this field last wrote out. Re-reading our own value would replace the
     text under the caret with its normalized form mid-word — `7-` becomes
     `7:`, the caret jumps, and the next keystroke lands in the wrong place. */
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    if (emitted.current === value) return;
    const next = readNodeValue(model, value);
    setSystem(next.link ? LINK_MODE : next.system || preferredSystem || systems[0]?.name || '');
    setNodeText(next.link || next.nodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const linkMode = system === LINK_MODE || !systems.length;

  const options = useMemo(
    () => [
      ...systems.map((entry) => ({
        value: entry.name,
        label: entry.name,
        icon: <DesignSourceKindIcon kind="figma" size={13} />,
      })),
      { value: LINK_MODE, label: t('design_node_link_mode') },
    ],
    [systems, t]
  );

  /** Store whatever the two halves currently say. */
  const commit = (nextSystem: string, nextText: string) => {
    const next =
      nextSystem === LINK_MODE || !nextSystem
        ? nextText.trim()
        : buildNodeRef(model, nextSystem, nextText);
    emitted.current = next;
    onChange(next);
  };

  /*
   * A pasted link fills both halves at once. If its file is one of ours, the
   * link disappears into the short form — which is the whole point of the
   * field — and if it is not, it stays a link and says so by switching mode.
   */
  const takeNode = (raw: string) => {
    const target = parseFigmaUrl(raw);
    if (!target) {
      setNodeText(raw);
      commit(system, raw);
      return;
    }
    const owner = systems.find((entry) => systemFileKey(entry) === target.fileKey);
    if (owner && target.nodeId) {
      setSystem(owner.name);
      setNodeText(target.nodeId);
      commit(owner.name, target.nodeId);
      return;
    }
    setSystem(LINK_MODE);
    setNodeText(raw.trim());
    commit(LINK_MODE, raw.trim());
  };

  const href = resolveNodeHref(model, value);

  return (
    <HStack gap="8px" align="stretch" w="full">
      {systems.length ? (
        <Box flex="0 0 200px" minW={0}>
          <ThemedSelect
            size="sm"
            controlHeight={ROW_H}
            options={options}
            value={system}
            disabled={disabled}
            ariaLabel={t('design_node_file')}
            placeholder={t('design_node_file')}
            data-testid="design-node-system"
            onChange={(next) => {
              setSystem(next);
              commit(next, nodeText);
            }}
          />
        </Box>
      ) : null}

      <Input
        size="sm"
        flex="1"
        minW={0}
        autoFocus={!disabled}
        disabled={disabled}
        value={nodeText}
        placeholder={linkMode ? t('design_node_placeholder') : t('design_node_id_placeholder')}
        fontFamily={linkMode ? undefined : 'mono'}
        data-testid="design-node"
        onChange={(e) => takeNode(e.target.value)}
        {...inputStyles}
      />

      {/* Proof that the two halves add up to somewhere real. It is also the
          fastest way to check a node id that was typed rather than pasted. */}
      <IconButton
        variant="ghost"
        h={ROW_H}
        w={ROW_H}
        minW={ROW_H}
        aria-label={t('design_node_open')}
        title={t('design_node_open')}
        disabled={!href}
        asChild={Boolean(href)}
        flexShrink={0}
      >
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={14} />
          </a>
        ) : (
          <Text as="span" lineHeight={0}>
            <ExternalLink size={14} />
          </Text>
        )}
      </IconButton>
    </HStack>
  );
}
