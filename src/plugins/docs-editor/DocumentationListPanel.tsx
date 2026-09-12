import EntityListPanel, { ListSortMenu, PanelCountTitle } from '@components/common/EntityListPanel';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { groupByOwner, resolveOwnerGroup } from '@utils/ownerGrouping';
import { BookOpen } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DOC_LIST_SORT_KEYS,
  filterDocList,
  sortDocList,
  type DocListItem,
  type DocListSortKey,
} from './docsList';

const SORT_LABEL: Record<DocListSortKey, string> = {
  updated: 'sequence_list_sort_updated',
  created: 'sequence_list_sort_created',
  'name-asc': 'sequence_list_sort_name_asc',
  'name-desc': 'sequence_list_sort_name_desc',
};

type Props = {
  items: DocListItem[];
  selectedId: string | null;
  query: string;
  sort: DocListSortKey;
  onQueryChange: (next: string) => void;
  onSortChange: (next: DocListSortKey) => void;
  onSelect: (id: string) => void;
};

/** Every documentation page in the project, in the shared list panel. */
export default function DocumentationListPanel({
  items,
  selectedId,
  query,
  sort,
  onQueryChange,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const model = useFlatC4Store((s) => s.model);

  const rows = useMemo(() => {
    const { pinned, buckets } = groupByOwner(
      filterDocList(items, query),
      (item) => resolveOwnerGroup(model, item),
      (list) => sortDocList(list, sort),
      (item) => Boolean(item.isDraft)
    );

    const toRow = (
      item: DocListItem,
      group: { system: string | null; service: string | null } | null
    ) => {
      const owner = item.ownerName || t(`catalog_kind_${item.ownerType}`);
      return {
        id: item.id,
        title: item.title || t('documentation_untitled'),
        /* The owner again only when it says something the heading did not —
           a page on a component under a service names the component. */
        subtitle: item.isDraft
          ? t('documentation_list_draft')
          : owner === group?.service
            ? undefined
            : owner,
        group: group?.system ?? null,
        subgroup: group?.service ?? null,
      };
    };

    return [
      ...pinned.map((item) => toRow(item, null)),
      ...buckets.flatMap((bucket) => bucket.items.map((item) => toRow(item, bucket))),
    ];
  }, [items, query, sort, model, t]);

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
        search: t('documentation_list_search_placeholder'),
        empty: t('documentation_list_empty'),
        noMatches: t('sequence_list_no_matches'),
        untitled: t('documentation_untitled'),
        loadMore: (remaining) => t('sequence_list_load_more', { remaining }),
      }}
      testId="documentation-list"
    />
  );
}

/** The panel's own header, for the shell to wear: what is listed, and how many. */
export function DocumentationListTitle({ count }: { count: number }) {
  return <PanelCountTitle icon={<BookOpen size={14} />} count={count} />;
}

export function DocumentationListSort({
  sort,
  onSortChange,
}: {
  sort: DocListSortKey;
  onSortChange: (next: DocListSortKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <ListSortMenu
      sort={sort}
      options={DOC_LIST_SORT_KEYS.map((key) => ({ key, label: t(SORT_LABEL[key]) }))}
      onSortChange={(next) => onSortChange(next as DocListSortKey)}
      label={t('sequence_list_sort')}
      testId="documentation-list-sort"
    />
  );
}
