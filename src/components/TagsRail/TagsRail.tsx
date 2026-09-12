import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import {
  Box,
  Button,
  HStack,
  Input,
  Menu,
  Portal,
  Tag,
  Text,
} from '@chakra-ui/react';
import {
  setTagColor,
  TAG_PALETTE,
  tagChipColors,
  useTagColors,
} from '@/features/tags/tagColors';
import { normalizeTag } from '@/types/c4Extensions';
import ElementTag from '@components/common/ElementTag';
import GlassMenuContent from '@components/common/GlassMenuContent';
import ConfirmDialog from '@components/common/ConfirmDialog';
import { useColorMode } from '@contexts/ColorModeContext';
import { GLASS_RADIUS_BAR, useGlassSurface } from '@theme/glassSurfaces';
import { declareTag, undeclareTag, useDeclaredTags } from '@/features/tags/declaredTags';
import { removeTagFromModel } from '@utils/tagCatalog';
import { highlightTag, getHighlightedTag, subscribeHighlightedTag } from '@/features/tags/uiState';
import { Crosshair, RotateCcw, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import MenuRow from './MenuRow';
import {
  TAG_COLOR_MENU_MAX_HEIGHT,
  TAG_COLOR_MENU_MIN_WIDTH,
  TAG_MENU_ICON_SIZE,
  TAG_MENU_MIN_WIDTH,
  TAGS_PANEL_MAX_HEIGHT,
  TAGS_PANEL_WIDTH,
  TAG_SWATCH_ICON_SIZE,
  TAG_SWATCH_SIZE,
} from './constants';
import { isClickAway, mergeDeclaredUsage } from './helpers';
import type { TagsRailProps } from './types';

/**
 * The tag catalogue for the model, as a rail beside the version pill.
 *
 * Tags are set one element at a time in the edit panel, which makes them easy
 * to create and impossible to survey: nothing showed what the model's tags
 * actually were, or let you retire one without visiting every card wearing it.
 */
export default function TagsRail({ canWrite = false }: TagsRailProps) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { chrome, mode } = useColorMode();
  const tagColor = useTagColors();
  const model = useFlatC4Store((s) => s.model);
  const setModel = useFlatC4Store((s) => s.setModel);

  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const highlighted = useSyncExternalStore(subscribeHighlightedTag, getHighlightedTag);
  const declared = useDeclaredTags();
  const usage = useMemo(() => mergeDeclaredUsage(model, declared), [model, declared]);

  const usageKeys = useMemo(
    () => new Set(usage.map((entry) => entry.tag.toLowerCase())),
    [usage]
  );

  const commitDraft = () => {
    const tag = normalizeTag(draft);
    if (!tag || usageKeys.has(tag.toLowerCase())) {
      setDraft('');
      return;
    }
    declareTag(tag);
    setDraft('');
  };

  /* Click-away: the panel floats over the canvas, so it must close on the next
     click elsewhere. Capture phase is required — React Flow pans with d3-zoom,
     which calls stopImmediatePropagation() on pointerdown at the pane; a
     bubble-phase listener on document never hears a click on empty canvas. */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (isClickAway(event.target as HTMLElement | null, rootRef.current)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  /* A highlight is about what is on screen; changing level or closing the rail
     leaves it pointing at nothing. */
  useEffect(() => {
    if (!open) {
      highlightTag(null);
      setDraft('');
    }
  }, [open]);
  useEffect(() => () => highlightTag(null), []);
  useEffect(() => {
    highlightTag(null);
  }, [model.viewLevel]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (highlighted === pendingDelete) highlightTag(null);
    setModel(removeTagFromModel(model, pendingDelete));
    /* Both halves, or a tag that nothing wore would be stripped from a model
       that never had it and come straight back from the declared list. */
    undeclareTag(pendingDelete);
    setPendingDelete(null);
  };

  const deleting = usage.find((u) => u.tag === pendingDelete);

  return (
    <Box position="relative" ref={rootRef}>
      {open ? (
        <Box
          position="absolute"
          bottom="calc(100% + 8px)"
          left="0"
          w={TAGS_PANEL_WIDTH}
          maxH={TAGS_PANEL_MAX_HEIGHT}
          overflowY="auto"
          p="10px"
          {...glass.panel}
          borderRadius="14px"
          css={glass.scrollbar}
          data-testid="tags-rail-panel"
        >
          {/*
            Chips stay outside any TagsInput control. Putting them inside one
            made every chip click focus the "add" field and scrollIntoView it —
            unusable once the list scrolled past a screenful.
          */}
          <HStack gap="6px" flexWrap="wrap" alignItems="flex-start">
            {usage.length === 0 && !canWrite ? (
              <Text fontSize="sm" color={chrome.textMuted} py="4px" pe="4px">
                {t('tags_rail_empty')}
              </Text>
            ) : null}
            {usage.map((entry) => {
              const active = highlighted === entry.tag;
              const color = tagColor(entry.tag);
              const chip = tagChipColors(color, mode, active);
              return (
                <Menu.Root key={entry.tag} positioning={{ placement: 'top' }}>
                  <Menu.Trigger asChild>
                    <ElementTag
                      tag={entry.tag}
                      tagSize="rail"
                      active={active}
                      asChild
                      cursor="pointer"
                      _hover={{ bg: chip.hoverBg }}
                      data-testid={`tag-chip-${entry.tag}`}
                    >
                      <button type="button" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <Tag.Label>
                          <HStack gap="6px">
                            <Text>{entry.tag}</Text>
                            {/* On this level, since that is what highlighting can
                                reach; the delete dialog names the wider total. */}
                            <Text fontSize="11px" opacity={0.7}>
                              {entry.onLevel}
                            </Text>
                          </HStack>
                        </Tag.Label>
                      </button>
                    </ElementTag>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <GlassMenuContent minW={TAG_MENU_MIN_WIDTH}>
                        <Menu.Item
                          value="focus"
                          cursor="pointer"
                          onClick={() => highlightTag(active ? null : entry.tag)}
                        >
                          <MenuRow mark={<Crosshair size={TAG_MENU_ICON_SIZE} />}>
                            {active ? t('tags_rail_unfocus') : t('tags_rail_focus')}
                          </MenuRow>
                        </Menu.Item>
                        <Menu.Root positioning={{ placement: 'top-start', gutter: 4 }}>
                          <Menu.TriggerItem cursor="pointer">
                            <MenuRow
                              mark={
                                <Box
                                  w={TAG_SWATCH_SIZE}
                                  h={TAG_SWATCH_SIZE}
                                  borderRadius="3px"
                                  bg={color}
                                />
                              }
                            >
                              {t('tags_rail_color')}
                            </MenuRow>
                          </Menu.TriggerItem>
                          <Portal>
                            <Menu.Positioner>
                              <GlassMenuContent
                                minW={TAG_COLOR_MENU_MIN_WIDTH}
                                maxH={TAG_COLOR_MENU_MAX_HEIGHT}
                                overflowY="auto"
                              >
                                <Menu.Item
                                  value="color-auto"
                                  cursor="pointer"
                                  onClick={() => setTagColor(entry.tag, null)}
                                >
                                  <MenuRow mark={<RotateCcw size={TAG_SWATCH_ICON_SIZE} />}>
                                    {t('tags_rail_color_auto')}
                                  </MenuRow>
                                </Menu.Item>
                                {TAG_PALETTE.map((swatch) => (
                                  <Menu.Item
                                    key={swatch.id}
                                    value={`color-${swatch.id}`}
                                    cursor="pointer"
                                    onClick={() => setTagColor(entry.tag, swatch.hex)}
                                    data-testid={`tag-swatch-${swatch.id}`}
                                  >
                                    <MenuRow
                                      mark={
                                        <Box
                                          w={TAG_SWATCH_SIZE}
                                          h={TAG_SWATCH_SIZE}
                                          borderRadius="3px"
                                          bg={swatch.hex}
                                        />
                                      }
                                    >
                                      {t(`tag_color_${swatch.id}`)}
                                    </MenuRow>
                                  </Menu.Item>
                                ))}
                              </GlassMenuContent>
                            </Menu.Positioner>
                          </Portal>
                        </Menu.Root>
                        {canWrite ? (
                          <Menu.Item
                            value="delete"
                            cursor="pointer"
                            color="red.400"
                            onClick={() => setPendingDelete(entry.tag)}
                          >
                            <MenuRow mark={<Trash2 size={TAG_MENU_ICON_SIZE} />}>{t('delete')}</MenuRow>
                          </Menu.Item>
                        ) : null}
                      </GlassMenuContent>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              );
            })}
            {canWrite ? (
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  commitDraft();
                }}
                onBlur={commitDraft}
                placeholder={t('tags_rail_add_placeholder')}
                flex="1"
                minW="120px"
                h="26px"
                minH="26px"
                px="8px"
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="border.default"
                borderRadius="6px"
                bg="transparent"
                fontSize="sm"
                data-testid="tags-rail-add-input"
              />
            ) : null}
          </HStack>
        </Box>
      ) : null}

      <HStack px="8px" py="6px" minH="40px" align="center" {...glass.floatBar}>
        <Button
          variant="ghost"
          size="xs"
          h="28px"
          minH="28px"
          px="8px"
          borderRadius={GLASS_RADIUS_BAR}
          aria-expanded={open}
          aria-label={t('tags_rail_title')}
          fontSize="sm"
          fontWeight="500"
          color={highlighted ? 'brand.text' : 'fg.muted'}
          bg={open ? 'bg.list.selected' : 'transparent'}
          _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
          onClick={() => setOpen((v) => !v)}
          data-testid="tags-rail-trigger"
        >
          <HStack gap="6px" minW={0}>
            <Box flexShrink={0} lineHeight={0} color="fg.subtle">
              <TagIcon size={TAG_MENU_ICON_SIZE} />
            </Box>
            <Text as="span">{t('tags_rail_title')}</Text>
            {usage.length ? (
              <Text as="span" fontSize="11px" color="fg.muted">
                {usage.length}
              </Text>
            ) : null}
          </HStack>
        </Button>
      </HStack>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('tags_rail_delete_title')}
        content={t('tags_rail_delete_confirm', {
          tag: pendingDelete ?? '',
          count: deleting?.total ?? 0,
        })}
        confirmText={t('delete')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
