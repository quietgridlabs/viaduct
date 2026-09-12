import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export const ENTITY_LIST_PAGE_SIZE = 40;

/**
 * How far each list was scrolled, and how much of it was revealed.
 *
 * Picking an item remounts the editor around this panel, and a list that jumps
 * back to the top every time makes the bottom of it unusable — you would never
 * get to the second item you were reading. Kept per list, outside React, so it
 * survives that remount.
 */
const listViewState = new Map<
  string,
  { scrollTop: number; visibleCount: number; collapsed?: string[] }
>();

/** A section's identity: the system alone, or a service inside it. */
function sectionKey(group?: string | null, subgroup?: string | null): string {
  return subgroup == null ? `${group ?? ''}` : `${group ?? ''}\u0000${subgroup}`;
}

/** Foldable service sections present in the current rows. */
function collectServiceKeys(items: EntityListPanelItem[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.subgroup != null) keys.add(sectionKey(item.group, item.subgroup));
  }
  return keys;
}

function sectionKeyForItem(item: EntityListPanelItem): string | null {
  return item.subgroup != null ? sectionKey(item.group, item.subgroup) : null;
}

/**
 * First open: every service folded. Opening a concrete page/diagram unfolds
 * only its section so the selection is visible without exploding the whole tree.
 */
function defaultCollapsedKeys(
  items: EntityListPanelItem[],
  selectedId: string | null
): Set<string> {
  const keys = collectServiceKeys(items);
  if (!selectedId) return keys;
  const item = items.find((row) => row.id === selectedId);
  const open = item ? sectionKeyForItem(item) : null;
  if (open) keys.delete(open);
  return keys;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
}

export type EntityListPanelItem = {
  id: string;
  title: string;
  subtitle?: string;
  /** Someone else holds the edit lock — visible, but not selectable. */
  disabled?: boolean;
  /*
   * Section headers, drawn where they change from the item above rather than
   * as a nested structure. The list is paged, so a flat array that carries its
   * own headings keeps `slice` honest: any page starts by restating where it
   * is, and no group can be half-rendered.
   */
  group?: string | null;
  subgroup?: string | null;
};

export type EntityListSortOption = { key: string; label: string };

type Props = {
  /** Already filtered and sorted — each list owns its own rules. */
  items: EntityListPanelItem[];
  /** Before filtering, to tell "nothing here yet" from "nothing matched". */
  totalCount: number;
  selectedId: string | null;
  query: string;
  onQueryChange: (next: string) => void;
  /** Not rendered here — the panel shell wears the sort control — but a new
      order is a new list, so paging and scroll reset on it. */
  sort: string;
  onSelect: (id: string) => void;
  labels: {
    search: string;
    empty: string;
    noMatches: string;
    untitled: string;
    loadMore: (remaining: number) => string;
  };
  /** Prefix for the panel's test ids: `${testId}-search`, `-sort`, `-item-<id>`. */
  testId: string;
};

/**
 * The list that sits to the left of an editor: search, sort, and the entries
 * themselves, revealed a page at a time.
 *
 * Shared on purpose — sequence diagrams and documentation are browsed the same
 * way, and two copies of this would drift apart the first time one of them was
 * touched.
 */
export default function EntityListPanel({
  items,
  totalCount,
  selectedId,
  query,
  onQueryChange,
  sort,
  onSelect,
  labels,
  testId,
}: Props) {
  const glass = useGlassSurface();
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(
    () => listViewState.get(testId)?.visibleCount ?? ENTITY_LIST_PAGE_SIZE
  );
  /* Which sections are folded away, remembered beside the scroll offset and
     for the same reason: picking an item remounts this panel, and a list that
     unfolds itself every time is a list you have to re-fold every time.
     No prior visit → every service starts folded (catalogue-style). */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const saved = listViewState.get(testId)?.collapsed;
    return saved ? new Set(saved) : defaultCollapsedKeys(items, selectedId);
  });
  const knownSectionsRef = useRef<Set<string>>(collectServiceKeys(items));

  const toggleSection = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  /* New services arrive folded; the selected entry's section stays open so a
     deep-link into one page does not leave it hidden under a chevron. */
  useEffect(() => {
    const keys = collectServiceKeys(items);
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (!knownSectionsRef.current.has(key)) next.add(key);
      }
      for (const key of [...next]) {
        if (!keys.has(key)) next.delete(key);
      }
      if (selectedId) {
        const item = items.find((row) => row.id === selectedId);
        const open = item ? sectionKeyForItem(item) : null;
        if (open) next.delete(open);
      }
      knownSectionsRef.current = keys;
      return sameSet(prev, next) ? prev : next;
    });
  }, [items, selectedId]);

  /* Restore where the reader was. The rows are already there — the revealed
     count is restored with the state above — but the box is measured a frame
     later, so the offset is applied once layout can accept it. */
  useEffect(() => {
    const saved = listViewState.get(testId);
    const root = listRef.current;
    if (!saved?.scrollTop || !root) return;
    let frame = requestAnimationFrame(() => {
      root.scrollTop = saved.scrollTop;
      if (root.scrollTop < saved.scrollTop) {
        frame = requestAnimationFrame(() => {
          root.scrollTop = saved.scrollTop;
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [testId]);

  /* Keep the offset that was stored: on mount the box is still at zero, and
     writing that back here would erase what the restore above is about to use. */
  useEffect(() => {
    const previous = listViewState.get(testId);
    listViewState.set(testId, {
      scrollTop: previous?.scrollTop ?? 0,
      visibleCount,
      collapsed: [...collapsed],
    });
  }, [testId, visibleCount, collapsed]);

  /* A new query or order is a new list — start it from the top. */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setVisibleCount(ENTITY_LIST_PAGE_SIZE);
    if (listRef.current) listRef.current.scrollTop = 0;
    listViewState.set(testId, {
      scrollTop: 0,
      visibleCount: ENTITY_LIST_PAGE_SIZE,
      collapsed: [...collapsed],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- folds outlive a search
  }, [query, sort, testId]);

  useEffect(() => {
    if (!selectedId) return;
    /* Counted among the rows actually on show. An item inside a fold is not
       on show at all, and revealing more of the list would not surface it. */
    const index = items
      .filter(
        (item) =>
          !(
            collapsed.has(sectionKey(item.group)) ||
            (item.subgroup && collapsed.has(sectionKey(item.group, item.subgroup)))
          )
      )
      .findIndex((item) => item.id === selectedId);
    if (index >= visibleCount) setVisibleCount(index + 1);
  }, [items, selectedId, visibleCount, collapsed]);

  /*
   * Headings and rows in one list, folded sections included.
   *
   * A collapsed section still has to draw its own heading — that heading is
   * the only way to open it again — so filtering the items away is not enough
   * on its own. Walking the items once and emitting headings as they change
   * gives both: the fold hides the rows and keeps the handle.
   *
   * Paging counts rows, not headings. `visibleCount` is a budget of entries
   * the reader asked for, and spending it on section titles would make each
   * "show more" reveal less than the last.
   */
  const { rows, remaining } = useMemo(() => {
    type Row =
      | { kind: 'system'; key: string; label: string }
      | { kind: 'service'; key: string; label: string; folded: boolean; count: number }
      | { kind: 'item'; item: EntityListPanelItem };

    /* Counted before anything is folded away, so a service's heading says how
       much is inside it whether or not you can see it. */
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.subgroup) continue;
      const key = sectionKey(item.group, item.subgroup);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const out: Row[] = [];
    let emitted = 0;
    let hidden = 0;
    let system: string | null | undefined;
    let service: string | null | undefined;
    let folded = false;
    /* Not `out.length === 0`: a first row that is folded away or past the page
       budget never reaches the array, and the next one then re-enters this
       branch and prints the heading a second time. */
    let started = false;

    for (const item of items) {
      if (!started || item.group !== system) {
        system = item.group;
        service = undefined;
        folded = false;
        started = true;
        if (item.group) {
          out.push({ kind: 'system', key: `system:${item.group}`, label: item.group });
        }
      }

      if (item.subgroup !== service) {
        service = item.subgroup;
        const key = sectionKey(system, service);
        folded = Boolean(service) && collapsed.has(key);
        if (item.subgroup) {
          out.push({
            kind: 'service',
            key,
            label: item.subgroup,
            folded,
            count: counts.get(key) ?? 0,
          });
        }
      }

      /* A fold hides everything in it, the open page included: a section that
         keeps one row back is not folded, it is broken. Nothing is lost —
         what is open is open in the editor beside this list. */
      if (folded) continue;
      if (emitted >= visibleCount) {
        hidden += 1;
        continue;
      }
      out.push({ kind: 'item', item });
      emitted += 1;
    }

    return { rows: out, remaining: hidden };
  }, [items, collapsed, visibleCount]);

  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || remaining === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((n) => Math.min(n + ENTITY_LIST_PAGE_SIZE, items.length));
      },
      { root, rootMargin: '80px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [remaining, items.length, query, sort]);

  return (
    <Box display="flex" flexDirection="column" flex="1" minH={0} overflow="hidden">
      <Box px="12px" pt="8px" pb="10px" borderBottomWidth="1px" borderColor="border.glass">
        <Box position="relative">
          <Box
            position="absolute"
            left="10px"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
            pointerEvents="none"
          >
            <Search size={14} />
          </Box>
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            pl="32px"
            h="32px"
            minH="32px"
            bg="bg.dialog"
            borderWidth="1px"
            borderColor="border.glass"
            borderRadius="md"
            _focusVisible={{ borderColor: 'border.default', boxShadow: 'none' }}
            data-testid={`${testId}-search`}
          />
        </Box>
      </Box>

      <Box
        ref={listRef}
        flex="1"
        minH={0}
        overflowY="auto"
        p="12px"
        css={glass.scrollbar}
        onScroll={(e) =>
          listViewState.set(testId, {
            scrollTop: (e.target as HTMLDivElement).scrollTop,
            visibleCount,
          })
        }
      >
        {totalCount === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            {labels.empty}
          </Text>
        ) : items.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            {labels.noMatches}
          </Text>
        ) : (
          <VStack align="stretch" gap="4px">
            {rows.map((row) => {
              if (row.kind === 'system') {
                /* States which system you are looking at, and is not foldable,
                   the way the service catalogue does it.
                   Not sticky: pinning it needs an opaque ground for the rows to
                   pass under, and this list is transparent over the panel's
                   glass, so that ground read as a patch of a different colour
                   sitting behind the words. The catalogue this copies scrolls
                   its heading with the content and is none the worse. */
                return (
                  <Text
                    key={`system-${row.key}`}
                    fontSize="xs"
                    fontWeight="700"
                    letterSpacing="0.04em"
                    textTransform="uppercase"
                    color="fg.muted"
                    pt="10px"
                    pb="6px"
                    lineClamp={1}
                    data-testid={`${testId}-system-${row.label}`}
                  >
                    {row.label}
                  </Text>
                );
              }

              if (row.kind === 'service') {
                return (
                  <HStack
                    key={`service-${row.key}`}
                    as="button"
                    w="full"
                    gap="6px"
                    px="4px"
                    py="2px"
                    mx="-4px"
                    borderRadius="6px"
                    color="fg.muted"
                    cursor="pointer"
                    textAlign="left"
                    _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
                    aria-expanded={!row.folded}
                    onClick={() => toggleSection(row.key)}
                    data-testid={`${testId}-section-${row.key}`}
                  >
                    <Box flexShrink={0} lineHeight={0}>
                      {row.folded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </Box>
                    <Text fontSize="xs" fontWeight="600" lineClamp={1}>
                      {row.label}
                    </Text>
                    <Text fontSize="xs" color="fg.subtle">
                      {row.count}
                    </Text>
                  </HStack>
                );
              }

              const item = row.item;
              const selected = selectedId === item.id;
              return (
                <Box
                  key={item.id}
                  textAlign="left"
                  w="full"
                  px="10px"
                  py="8px"
                  borderRadius="8px"
                  borderWidth="1px"
                  borderColor={selected ? 'border.default' : 'transparent'}
                  bg={selected ? 'bg.list.selected' : 'transparent'}
                  opacity={item.disabled ? 0.55 : 1}
                  _hover={
                    item.disabled
                      ? undefined
                      : { bg: selected ? 'bg.list.selected' : 'bg.list.hover' }
                  }
                  cursor={item.disabled ? 'not-allowed' : 'pointer'}
                  onClick={() => {
                    if (item.disabled) return;
                    onSelect(item.id);
                  }}
                  data-testid={`${testId}-item-${item.id}`}
                >
                  <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                    {item.title || labels.untitled}
                  </Text>
                  {item.subtitle ? (
                    <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </Box>
              );
            })}
            {remaining > 0 ? (
              <Button
                ref={sentinelRef}
                size="xs"
                variant="ghost"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + ENTITY_LIST_PAGE_SIZE, items.length))
                }
              >
                {labels.loadMore(remaining)}
              </Button>
            ) : null}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
