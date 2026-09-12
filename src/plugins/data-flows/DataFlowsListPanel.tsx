import { MAGIC_FLOW_FG, MAGIC_FLOW_SELECTED, MagicFlowIcon } from '@components/data-flow/MagicFlowMark';
import { ListSortMenu, PanelCountTitle } from '@components/common/EntityListPanel';
import { useGlassSurface } from '@theme/glassSurfaces';
import type { StoredDataFlow } from '@/types/c4Extensions';
import FlowStatusIcon from '@components/data-flow/FlowStatusIcon';
import type { FlowStatus } from '@utils/flowValidation';
import {
  DATA_FLOW_LIST_PAGE_SIZE,
  DATA_FLOW_SORT_KEYS,
  type DataFlowSortKey,
  filterDataFlows,
  sortDataFlows,
} from '@utils/dataFlows';
import { Box, Button, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SORT_LABEL: Record<DataFlowSortKey, string> = {
  updated: 'data_flow_sort_updated',
  created: 'data_flow_sort_created',
  'name-asc': 'data_flow_sort_name_asc',
  'name-desc': 'data_flow_sort_name_desc',
  steps: 'data_flow_sort_steps',
};

type Props = {
  flows: StoredDataFlow[];
  /** Flow id → how it stands against the current model. Absent: not computed. */
  statuses?: Map<string, FlowStatus>;
  selectedId: string | null;
  query: string;
  sort: DataFlowSortKey;
  onQueryChange: (next: string) => void;
  onSortChange: (next: DataFlowSortKey) => void;
  onSelect: (id: string) => void;
};

export default function DataFlowsListPanel({
  flows,
  statuses,
  selectedId,
  query,
  sort,
  onQueryChange,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLButtonElement>(null);
  const [visibleCount, setVisibleCount] = useState(DATA_FLOW_LIST_PAGE_SIZE);

  const filtered = useMemo(
    () => sortDataFlows(filterDataFlows(flows, query), sort),
    [flows, query, sort]
  );

  useEffect(() => {
    setVisibleCount(DATA_FLOW_LIST_PAGE_SIZE);
  }, [query, sort]);

  useEffect(() => {
    if (!selectedId) return;
    const idx = filtered.findIndex((flow) => flow.id === selectedId);
    if (idx >= visibleCount) setVisibleCount(idx + 1);
  }, [filtered, selectedId, visibleCount]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visible.length);

  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || remaining === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((n) => Math.min(n + DATA_FLOW_LIST_PAGE_SIZE, filtered.length));
      },
      { root, rootMargin: '80px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [remaining, filtered.length, query, sort]);

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
            placeholder={t('data_flow_search_placeholder')}
            pl="32px"
            h="32px"
            minH="32px"
            bg="bg.dialog"
            borderWidth="1px"
            borderColor="border.glass"
            borderRadius="md"
            _focusVisible={{ borderColor: 'border.default', boxShadow: 'none' }}
            data-testid="flows-search"
          />
        </Box>
      </Box>
      <Box ref={listRef} flex="1" minH={0} overflowY="auto" p="12px" css={glass.scrollbar}>
        {flows.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            {t('data_flow_empty')}
          </Text>
        ) : filtered.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            {t('data_flow_no_matches')}
          </Text>
        ) : (
          <VStack align="stretch" gap="4px">
            {visible.map((flow) => (
              <Box
                key={flow.id}
                textAlign="left"
                w="full"
                px="10px"
                py="8px"
                borderRadius="8px"
                borderWidth="1px"
                borderColor={selectedId === flow.id ? MAGIC_FLOW_FG : 'transparent'}
                bg={selectedId === flow.id ? MAGIC_FLOW_SELECTED : 'transparent'}
                _hover={{
                  bg: selectedId === flow.id ? MAGIC_FLOW_SELECTED : 'bg.list.hover',
                }}
                cursor="pointer"
                onClick={() => onSelect(flow.id)}
              >
                <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                  {flow.name || t('data_flow_new')}
                </Text>
                <HStack gap="6px" mt="2px">
                  <Text fontSize="xs" color="fg.muted">
                    {t('data_flow_steps_count', { count: flow.steps.length })}
                  </Text>
                  {(() => {
                    const status = statuses?.get(flow.id);
                    if (!status) return null;
                    return (
                      <Box as="span" data-testid={`flow-status-${flow.id}`} data-status={status}>
                        <FlowStatusIcon status={status} hint={t(`data_flow_status_${status}`)} size={14} />
                      </Box>
                    );
                  })()}
                </HStack>
              </Box>
            ))}
            {remaining > 0 ? (
              <Button
                ref={sentinelRef}
                size="xs"
                variant="ghost"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + DATA_FLOW_LIST_PAGE_SIZE, filtered.length))
                }
              >
                {t('data_flow_load_more', { remaining })}
              </Button>
            ) : null}
          </VStack>
        )}
      </Box>
    </Box>
  );
}

/** The panel's own header, for the shell to wear: what is listed, and how many. */
export function DataFlowsListTitle({ count }: { count: number }) {
  return <PanelCountTitle icon={<MagicFlowIcon size={14} />} count={count} />;
}

export function DataFlowsListSort({
  sort,
  onSortChange,
}: {
  sort: DataFlowSortKey;
  onSortChange: (next: DataFlowSortKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <ListSortMenu
      sort={sort}
      options={DATA_FLOW_SORT_KEYS.map((key) => ({ key, label: t(SORT_LABEL[key]) }))}
      onSortChange={(next) => onSortChange(next as DataFlowSortKey)}
      label={t('data_flow_sort')}
      testId="flows-sort"
    />
  );
}
