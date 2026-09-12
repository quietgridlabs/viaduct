import EntityListPanel, { ListSortMenu, PanelCountTitle } from '@components/common/EntityListPanel';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { groupByOwner, resolveOwnerGroup } from '@utils/ownerGrouping';
import { GitBranch } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SEQUENCE_LIST_SORT_KEYS,
  filterSequenceList,
  sortSequenceList,
  type SequenceListItem,
  type SequenceListSortKey,
} from './sequenceList';

const SORT_LABEL: Record<SequenceListSortKey, string> = {
  updated: 'sequence_list_sort_updated',
  created: 'sequence_list_sort_created',
  'name-asc': 'sequence_list_sort_name_asc',
  'name-desc': 'sequence_list_sort_name_desc',
};

type Props = {
  items: SequenceListItem[];
  selectedId: string | null;
  query: string;
  sort: SequenceListSortKey;
  onQueryChange: (next: string) => void;
  onSortChange: (next: SequenceListSortKey) => void;
  onSelect: (id: string) => void;
  /** When set, item is non-interactive (peer holds edit lock). */
  isLocked?: (item: SequenceListItem) => boolean;
  lockLabel?: (item: SequenceListItem) => string | null;
};

/** The project's sequence diagrams, in the shared list panel. */
export default function SequenceDiagramsListPanel({
  items,
  selectedId,
  query,
  sort,
  onQueryChange,
  onSelect,
  isLocked,
  lockLabel,
}: Props) {
  const { t } = useTranslation();
  const model = useFlatC4Store((s) => s.model);

  const rows = useMemo(() => {
    const { pinned, buckets } = groupByOwner(
      filterSequenceList(items, query),
      (item) => resolveOwnerGroup(model, item),
      (list) => sortSequenceList(list, sort),
      (item) => Boolean(item.isDraft)
    );

    const toRow = (
      item: SequenceListItem,
      group: { system: string | null; service: string | null } | null
    ) => {
      const owner = item.ownerName || t('sequence_list_unbound');
      /* A lock says who is holding the diagram and outranks anything the
         heading already shows. */
      const locked = lockLabel?.(item);
      return {
        id: item.id,
        title: item.name || t('sequence_diagram_name'),
        subtitle:
          locked ||
          (item.isDraft
            ? t('sequence_list_draft')
            : owner === group?.service
              ? undefined
              : owner),
        disabled: Boolean(isLocked?.(item)),
        group: group?.system ?? null,
        subgroup: group?.service ?? null,
      };
    };

    return [
      ...pinned.map((item) => toRow(item, null)),
      ...buckets.flatMap((bucket) => bucket.items.map((item) => toRow(item, bucket))),
    ];
  }, [items, query, sort, isLocked, lockLabel, model, t]);

  return (
    <EntityListPanel
      items={rows}
      totalCount={items.length}
      selectedId={selectedId}
      query={query}
      onQueryChange={onQueryChange}
      sort={sort}
      onSelect={onSelect}
      labels={{
        search: t('sequence_list_search_placeholder'),
        empty: t('sequence_diagrams_empty'),
        noMatches: t('sequence_list_no_matches'),
        untitled: t('sequence_diagram_name'),
        loadMore: (remaining) => t('sequence_list_load_more', { remaining }),
      }}
      testId="sequence-list"
    />
  );
}

/** The panel's own header, for the shell to wear: what is listed, and how many. */
export function SequenceListTitle({ count }: { count: number }) {
  return <PanelCountTitle icon={<GitBranch size={14} />} count={count} />;
}

export function SequenceListSort({
  sort,
  onSortChange,
}: {
  sort: SequenceListSortKey;
  onSortChange: (next: SequenceListSortKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <ListSortMenu
      sort={sort}
      options={SEQUENCE_LIST_SORT_KEYS.map((key) => ({ key, label: t(SORT_LABEL[key]) }))}
      onSortChange={(next) => onSortChange(next as SequenceListSortKey)}
      label={t('sequence_list_sort')}
      testId="sequence-list-sort"
    />
  );
}
