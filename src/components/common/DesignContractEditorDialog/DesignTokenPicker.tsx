import type { DesignTokenRecord } from '@/types/c4Extensions';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { useGlassSurface } from '@theme/glassSurfaces';
import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  Box,
  Button,
  Dialog,
  HStack,
  Input,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Check, LayoutGrid, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  tokens: DesignTokenRecord[];
  selected: string[];
  onChange: (next: string[]) => void;
  systemName?: string;
};

const GROUP_ORDER: Array<DesignTokenRecord['type'] | 'other'> = [
  'color',
  'space',
  'radius',
  'type',
  'shadow',
  'other',
];

function filterTokens(tokens: DesignTokenRecord[], q: string): DesignTokenRecord[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return tokens;
  return tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(needle) ||
      (token.value ?? '').toLowerCase().includes(needle) ||
      (token.description ?? '').toLowerCase().includes(needle)
  );
}

function TokenSwatch({ token }: { token: DesignTokenRecord }) {
  if (token.type === 'color' && token.value) {
    return (
      <Box
        w="10px"
        h="10px"
        borderRadius="3px"
        bg={token.value}
        borderWidth="1px"
        borderColor="border.glass"
        flexShrink={0}
      />
    );
  }
  return null;
}

function TokenChipButton({
  token,
  active,
  onClick,
  testId,
}: {
  token: DesignTokenRecord;
  active?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <Button
      size="xs"
      variant={active ? 'solid' : 'outline'}
      borderRadius="full"
      data-testid={testId}
      onClick={onClick}
      title={token.description || token.value || token.name}
    >
      {active ? <Check size={11} /> : null}
      <TokenSwatch token={token} />
      {token.name}
      {token.value && token.type !== 'color' ? (
        <Box as="span" color="fg.subtle" fontWeight="400">
          {` ${token.value}`}
        </Box>
      ) : null}
    </Button>
  );
}

/**
 * Pick which vocabulary values an element may use.
 *
 * A design system can hold dozens of tokens — dumping the first twelve was how
 * the rest went missing. Search for what you know; open the full list when you
 * don't.
 */
export default function DesignTokenPicker({ tokens, selected, onChange, systemName }: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { chrome } = useColorMode();
  const inputStyles = fieldSurfaceFlatStyles(chrome);

  const [query, setQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const byName = useMemo(() => {
    const map = new Map<string, DesignTokenRecord>();
    for (const token of tokens) map.set(token.name, token);
    return map;
  }, [tokens]);

  const searchHits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [] as DesignTokenRecord[];
    return filterTokens(tokens, query)
      .filter((token) => !selectedSet.has(token.name))
      .slice(0, 8);
  }, [query, tokens, selectedSet]);

  const browseGroups = useMemo(() => {
    const filtered = filterTokens(tokens, browseQuery);
    const map = new Map<string, DesignTokenRecord[]>();
    for (const token of filtered) {
      const key = token.type ?? 'other';
      map.set(key, [...(map.get(key) ?? []), token]);
    }
    return GROUP_ORDER.filter((type) => map.has(type ?? 'other')).map((type) => ({
      type: type ?? 'other',
      tokens: map.get(type ?? 'other') ?? [],
    }));
  }, [browseQuery, tokens]);

  const toggle = (name: string) => {
    if (selectedSet.has(name)) onChange(selected.filter((token) => token !== name));
    else onChange([...selected, name]);
  };

  const add = (name: string) => {
    if (selectedSet.has(name)) return;
    onChange([...selected, name]);
    setQuery('');
  };

  return (
    <VStack align="stretch" gap="8px">
      <HStack gap="6px" align="center">
        <Box position="relative" flex="1" minW={0}>
          <Box
            position="absolute"
            left="10px"
            top="50%"
            transform="translateY(-50%)"
            color="fg.subtle"
            pointerEvents="none"
            lineHeight={0}
          >
            <Search size={13} />
          </Box>
          <Input
            size="sm"
            value={query}
            placeholder={t('design_tokens_search')}
            data-testid="design-tokens-search"
            pl="30px"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !searchHits[0]) return;
              e.preventDefault();
              add(searchHits[0].name);
            }}
            {...inputStyles}
          />
        </Box>
        {tokens.length ? (
          <Button
            size="sm"
            variant="outline"
            flexShrink={0}
            data-testid="design-tokens-browse"
            onClick={() => {
              setBrowseQuery('');
              setBrowseOpen(true);
            }}
          >
            <LayoutGrid size={13} />
            {t('design_tokens_browse')}
          </Button>
        ) : null}
      </HStack>

      {searchHits.length ? (
        <HStack gap="6px" flexWrap="wrap">
          {searchHits.map((token) => (
            <TokenChipButton
              key={token.name}
              token={token}
              testId={`design-token-add-${token.name}`}
              onClick={() => add(token.name)}
            />
          ))}
        </HStack>
      ) : query.trim() && tokens.length ? (
        <Text fontSize="xs" color="fg.subtle">
          {t('design_tokens_none_match')}
        </Text>
      ) : null}

      {selected.length ? (
        <HStack gap="6px" flexWrap="wrap">
          {selected.map((name) => {
            const token = byName.get(name) ?? { name };
            return (
              <Button
                key={name}
                size="xs"
                variant="subtle"
                borderRadius="full"
                data-testid={`design-token-selected-${name}`}
                onClick={() => toggle(name)}
                title={t('design_tokens_remove')}
              >
                <TokenSwatch token={token} />
                {name}
                <X size={11} />
              </Button>
            );
          })}
        </HStack>
      ) : null}

      <Dialog.Root
        open={browseOpen}
        onOpenChange={(d) => {
          if (!d.open) setBrowseOpen(false);
        }}
        placement="center"
        size="lg"
      >
        <Portal>
          <Dialog.Backdrop bg={glass.backdrop} zIndex={1890} />
          <Dialog.Positioner zIndex={1900}>
            <Dialog.Content
              data-testid="design-tokens-browse-dialog"
              color="fg.default"
              maxW="640px"
              w="calc(100% - 32px)"
              maxH="min(720px, calc(100dvh - 48px))"
              display="flex"
              flexDirection="column"
              {...glass.dialog}
            >
              <Dialog.Header pb={DIALOG_PAD.headerPb}>
                <VStack align="stretch" gap="4px">
                  <Dialog.Title>
                    {systemName
                      ? t('design_tokens_browse_title', { system: systemName })
                      : t('design_tokens_browse_title_plain')}
                  </Dialog.Title>
                  <Text fontSize="sm" color="fg.muted">
                    {t('design_tokens_browse_hint', { count: selected.length })}
                  </Text>
                </VStack>
              </Dialog.Header>

              <Dialog.Body overflowY="auto">
                <VStack align="stretch" gap="14px">
                  <Box position="relative">
                    <Box
                      position="absolute"
                      left="10px"
                      top="50%"
                      transform="translateY(-50%)"
                      color="fg.subtle"
                      pointerEvents="none"
                      lineHeight={0}
                    >
                      <Search size={13} />
                    </Box>
                    <Input
                      size="sm"
                      value={browseQuery}
                      placeholder={t('design_tokens_search')}
                      data-testid="design-tokens-browse-search"
                      pl="30px"
                      autoFocus
                      onChange={(e) => setBrowseQuery(e.target.value)}
                      {...inputStyles}
                    />
                  </Box>

                  {browseGroups.length === 0 ? (
                    <Text fontSize="sm" color="fg.subtle">
                      {t('design_tokens_none_match')}
                    </Text>
                  ) : (
                    browseGroups.map((group) => (
                      <VStack key={group.type} align="stretch" gap="8px">
                        <Text fontSize="xs" fontWeight="600" color="fg.muted" textTransform="uppercase">
                          {t(`design_token_group_${group.type}`)}
                        </Text>
                        <HStack gap="6px" flexWrap="wrap">
                          {group.tokens.map((token) => (
                            <TokenChipButton
                              key={token.name}
                              token={token}
                              active={selectedSet.has(token.name)}
                              testId={`design-token-browse-${token.name}`}
                              onClick={() => toggle(token.name)}
                            />
                          ))}
                        </HStack>
                      </VStack>
                    ))
                  )}
                </VStack>
              </Dialog.Body>

              <Dialog.Footer>
                <HStack justify="flex-end" w="full">
                  <Button
                    size="sm"
                    data-testid="design-tokens-browse-done"
                    onClick={() => setBrowseOpen(false)}
                  >
                    {t('design_tokens_browse_done')}
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
}
