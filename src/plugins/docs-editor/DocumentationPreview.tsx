import { Box } from '@chakra-ui/react';
import { useMemo } from 'react';
import type { ResolvedChannelRef } from './channelRefs';
import type { ResolvedUiRef } from './uiRefs';
import ChannelEmbed from './ChannelEmbed';
import type { ResolvedEndpointRef } from './endpointRefs';
import EndpointEmbed from './EndpointEmbed';
import UiEmbed from './UiEmbed';
import {
  replaceMarkdownTable,
  splitMarkdownToPreviewBlocks,
  type MarkdownTable,
} from './markdown';
import MarkdownTableView from './MarkdownTableView';
import SequenceDiagramEmbed from './SequenceDiagramEmbed';

export type ResolvedSequenceRef = {
  id: string;
  name: string;
  plantUmlSource: string;
  ownerType: 'container' | 'component';
  ownerId: string;
};

export type { ResolvedChannelRef, ResolvedEndpointRef, ResolvedUiRef };

type Props = {
  markdown: string;
  resolveSequence: (id: string) => ResolvedSequenceRef | null;
  resolveEndpoint: (id: string) => ResolvedEndpointRef | null;
  resolveChannel?: (id: string) => ResolvedChannelRef | null;
  resolveUi?: (id: string) => ResolvedUiRef | null;
  onOpenSequence?: (ref: ResolvedSequenceRef) => void;
  onOpenEndpoint?: (ref: ResolvedEndpointRef) => void;
  onOpenChannel?: (ref: ResolvedChannelRef) => void;
  onOpenUi?: (ref: ResolvedUiRef) => void;
  readOnly?: boolean;
  onMarkdownChange?: (next: string) => void;
};

export default function DocumentationPreview({
  markdown,
  resolveSequence,
  resolveEndpoint,
  resolveChannel,
  resolveUi,
  onOpenSequence,
  onOpenEndpoint,
  onOpenChannel,
  onOpenUi,
  readOnly,
  onMarkdownChange,
}: Props) {
  const blocks = useMemo(() => splitMarkdownToPreviewBlocks(markdown), [markdown]);

  const updateTable = (tableIndex: number, next: MarkdownTable) => {
    if (!onMarkdownChange) return;
    onMarkdownChange(replaceMarkdownTable(markdown, tableIndex, next));
  };

  return (
    <Box
      fontSize="sm"
      color="fg.default"
      lineHeight="1.65"
      css={{
        '& h1': { fontSize: '1.75rem', fontWeight: 800, marginTop: '16px', marginBottom: '8px', lineHeight: 1.25 },
        '& h2': { fontSize: '1.4rem', fontWeight: 700, marginTop: '14px', marginBottom: '6px', lineHeight: 1.3 },
        '& h3': { fontSize: '1.2rem', fontWeight: 700, marginTop: '12px', marginBottom: '6px', lineHeight: 1.35 },
        '& h4': { fontSize: '1.05rem', fontWeight: 700, marginTop: '10px', marginBottom: '4px', lineHeight: 1.4 },
        '& h5': { fontSize: '0.95rem', fontWeight: 700, marginTop: '8px', marginBottom: '4px' },
        '& h6': { fontSize: '0.85rem', fontWeight: 700, marginTop: '8px', marginBottom: '4px', opacity: 0.9 },
        '& p': { marginTop: '6px' },
        '& ul': {
          listStyle: 'disc outside',
          listStyleType: 'disc',
          listStylePosition: 'outside',
          paddingInlineStart: '1.5rem',
          marginTop: '6px',
          marginBottom: '6px',
        },
        '& ol': {
          listStyle: 'decimal outside',
          listStyleType: 'decimal',
          listStylePosition: 'outside',
          paddingInlineStart: '1.5rem',
          marginTop: '6px',
          marginBottom: '6px',
        },
        '& li': {
          display: 'list-item',
          listStyle: 'inherit',
          marginTop: '2px',
        },
        '& ul > li': {
          listStyleType: 'disc',
        },
        '& ol > li': {
          listStyleType: 'decimal',
        },
        '& code': {
          background: 'var(--chakra-colors-bg-muted)',
          padding: '1px 4px',
          borderRadius: '4px',
        },
        '& pre': {
          background: 'var(--chakra-colors-bg-muted)',
          padding: '10px',
          borderRadius: '8px',
          overflowX: 'auto',
        },
        '& a': {
          color: 'var(--chakra-colors-accent-solid)',
          textDecoration: 'underline',
        },
      }}
    >
      {blocks.map((block, index) => {
        if (block.type === 'html') {
          return (
            <Box
              key={`html-${index}`}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }
        if (block.type === 'table') {
          return (
            <MarkdownTableView
              key={`table-${block.tableIndex}-${index}`}
              table={block.table}
              readOnly={readOnly || !onMarkdownChange}
              onChange={
                readOnly || !onMarkdownChange
                  ? undefined
                  : (next) => updateTable(block.tableIndex, next)
              }
            />
          );
        }
        if (block.type === 'endpoint') {
          const resolved = resolveEndpoint(block.id);
          return (
            <EndpointEmbed
              key={`endpoint-${block.id}-${index}`}
              endpoint={resolved}
              missing={!resolved}
              onOpen={
                resolved && onOpenEndpoint
                  ? () => onOpenEndpoint(resolved)
                  : undefined
              }
            />
          );
        }
        if (block.type === 'ui') {
          const resolved = resolveUi?.(block.id) ?? null;
          return (
            <UiEmbed
              key={`ui-${block.id}-${index}`}
              element={resolved}
              missing={!resolved}
              onOpen={resolved && onOpenUi ? () => onOpenUi(resolved) : undefined}
            />
          );
        }
        if (block.type === 'channel') {
          const resolved = resolveChannel?.(block.id) ?? null;
          return (
            <ChannelEmbed
              key={`channel-${block.id}-${index}`}
              channel={resolved}
              missing={!resolved}
              onOpen={
                resolved && onOpenChannel
                  ? () => onOpenChannel(resolved)
                  : undefined
              }
            />
          );
        }
        const resolved = resolveSequence(block.id);
        return (
          <SequenceDiagramEmbed
            key={`seq-${block.id}-${index}`}
            name={resolved?.name}
            plantUmlSource={resolved?.plantUmlSource}
            missing={!resolved}
            onOpen={
              resolved && onOpenSequence
                ? () => onOpenSequence(resolved)
                : undefined
            }
          />
        );
      })}
    </Box>
  );
}
