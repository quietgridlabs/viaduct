import ThemedSelect from '@components/common/ThemedSelect';
import { Box, Button, Input, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { findItemDeep, isCollapsibleFragment, isExpandFragment } from '../domain/itemsTree';
import {
  ARROW_TYPES,
  PARTICIPANT_KINDS,
  type ArrowType,
  type DelayItem,
  type DividerItem,
  type MessageItem,
  type NoteItem,
  type ParticipantKind,
} from '../domain/sequence-model';
import { useSequenceEditorStore } from '../state/sequence-editor-store';

export default function PropertiesPanel({ readOnly }: { readOnly?: boolean }) {
  const { t } = useTranslation();
  const selection = useSequenceEditorStore((s) => s.selection);
  const model = useSequenceEditorStore((s) => s.model);
  const applyCommand = useSequenceEditorStore((s) => s.applyCommand);
  const setSelection = useSequenceEditorStore((s) => s.setSelection);
  const toggleExpandCollapsed = useSequenceEditorStore((s) => s.toggleExpandCollapsed);
  const collapsedExpandIds = useSequenceEditorStore((s) => s.collapsedExpandIds);

  if (!selection) {
    return (
      <Box p="12px">
        <Text fontSize="sm" color="fg.muted">
          {t('sequence_properties_empty')}
        </Text>
      </Box>
    );
  }

  if (selection.kind === 'participant') {
    const p = model.participants.find((x) => x.id === selection.id);
    if (!p) return null;
    return (
      <VStack align="stretch" gap="10px" p="12px">
        <Text fontWeight="700" color="fg.default">
          {t('sequence_participant')}
        </Text>
        <Box>
          <Text fontSize="xs" mb="4px" color="fg.muted">
            {t('sequence_name')}
          </Text>
          <Input
            size="sm"
            minH="32px"
            h="32px"
            disabled={readOnly}
            value={p.label}
            onChange={(e) =>
              applyCommand(
                { type: 'participant.update', id: p.id, patch: { label: e.target.value } },
                'inspector'
              )
            }
          />
        </Box>
        <Box>
          <Text fontSize="xs" mb="4px" color="fg.muted">
            Alias
          </Text>
          <Input size="sm" minH="32px" h="32px" disabled value={p.id} />
        </Box>
        <ThemedSelect
          size="sm"
          mb={0}
          label="Kind"
          disabled={readOnly}
          value={p.kind}
          options={PARTICIPANT_KINDS.map((k) => ({ value: k, label: k }))}
          onChange={(next) =>
            applyCommand(
              {
                type: 'participant.update',
                id: p.id,
                patch: { kind: next as ParticipantKind },
              },
              'inspector'
            )
          }
        />
        <Button
          size="sm"
          colorPalette="red"
          variant="outline"
          disabled={readOnly}
          onClick={() => {
            applyCommand(
              { type: 'participant.remove', id: p.id, strategy: 'remove-references' },
              'inspector'
            );
            setSelection(null);
          }}
        >
          {t('delete')}
        </Button>
      </VStack>
    );
  }

  if (selection.kind === 'expand') {
    const frag = findItemDeep(model.items, selection.id);
    if (!frag || !isCollapsibleFragment(frag)) return null;
    const collapsed = collapsedExpandIds.includes(frag.id);
    const kindTitle =
      frag.kind === 'group'
        ? t('sequence_expand_group')
        : frag.kind === 'alt'
          ? 'alt'
          : frag.kind === 'loop'
            ? 'loop'
            : frag.kind === 'opt'
              ? 'opt'
              : t('sequence_expand_group');
    return (
      <VStack align="stretch" gap="10px" p="12px">
        <Text fontWeight="700" color="fg.default">
          {kindTitle}
        </Text>
        <Box>
          <Text fontSize="xs" mb="4px" color="fg.muted">
            {t('sequence_name')}
          </Text>
          <Input
            size="sm"
            minH="32px"
            h="32px"
            disabled={readOnly}
            value={frag.label}
            onChange={(e) => {
              const label = e.target.value;
              const patch: Partial<typeof frag> = { label };
              if (frag.kind === 'alt' || frag.kind === 'loop' || frag.kind === 'opt') {
                const branches = frag.branches.map((b, i) =>
                  i === 0 ? { ...b, condition: label.trim() || undefined } : b
                );
                patch.branches = branches;
              }
              applyCommand({ type: 'item.update', id: frag.id, patch }, 'inspector');
            }}
          />
        </Box>
        <Text fontSize="xs" color="fg.muted">
          {frag.kind === 'group'
            ? t('sequence_expand_plantuml_hint')
            : `PlantUML ${frag.kind} — collapse to hide body on canvas`}
        </Text>
        <Button size="sm" variant="outline" onClick={() => toggleExpandCollapsed(frag.id)}>
          {collapsed ? t('sequence_expand_show') : t('sequence_expand_hide')}
        </Button>
        {isExpandFragment(frag) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => {
              applyCommand({ type: 'item.unwrapExpand', fragmentId: frag.id }, 'inspector');
              setSelection(null);
            }}
          >
            {t('sequence_unwrap_expand')}
          </Button>
        ) : null}
        <Button
          size="sm"
          colorPalette="red"
          variant="outline"
          disabled={readOnly}
          onClick={() => {
            applyCommand({ type: 'item.remove', id: frag.id }, 'inspector');
            setSelection(null);
          }}
        >
          {t('delete')}
        </Button>
      </VStack>
    );
  }

  const item = findItemDeep(model.items, selection.id);
  if (!item) {
    return (
      <Box p="12px">
        <Text fontSize="sm" color="fg.muted">
          {t('sequence_properties_empty')}
        </Text>
      </Box>
    );
  }

  const participantOptions = [...model.participants]
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    .map((p) => ({ value: p.id, label: p.label }));

  if (item.type === 'note') {
    const note = item as NoteItem;
    return (
      <VStack align="stretch" gap="10px" p="12px">
        <Text fontWeight="700" color="fg.default">
          {t('sequence_note')}
        </Text>
        <ThemedSelect
          size="sm"
          mb={0}
          label={t('sequence_note_position')}
          disabled={readOnly}
          value={note.position}
          options={[
            { value: 'over', label: 'over' },
            { value: 'left', label: 'left' },
            { value: 'right', label: 'right' },
          ]}
          onChange={(next) =>
            applyCommand(
              {
                type: 'item.update',
                id: note.id,
                patch: { position: next as NoteItem['position'] },
              },
              'inspector'
            )
          }
        />
        <ThemedSelect
          size="sm"
          mb={0}
          label={t('sequence_participant')}
          disabled={readOnly || participantOptions.length === 0}
          value={note.participantIds[0] ?? ''}
          options={participantOptions}
          onChange={(next) =>
            applyCommand(
              {
                type: 'item.update',
                id: note.id,
                patch: { participantIds: [next] } as Partial<NoteItem>,
              },
              'inspector'
            )
          }
        />
        <Box>
          <Text fontSize="xs" mb="4px" color="fg.muted">
            Text
          </Text>
          <Input
            size="sm"
            minH="32px"
            h="32px"
            disabled={readOnly}
            value={note.text}
            onChange={(e) =>
              applyCommand(
                {
                  type: 'item.update',
                  id: note.id,
                  patch: { text: e.target.value } as Partial<NoteItem>,
                },
                'inspector'
              )
            }
          />
        </Box>
        <Button
          size="sm"
          colorPalette="red"
          variant="outline"
          disabled={readOnly}
          onClick={() => {
            applyCommand({ type: 'item.remove', id: note.id }, 'inspector');
            setSelection(null);
          }}
        >
          {t('delete')}
        </Button>
      </VStack>
    );
  }

  if (item.type === 'divider' || item.type === 'delay') {
    const row = item as DividerItem | DelayItem;
    return (
      <VStack align="stretch" gap="10px" p="12px">
        <Text fontWeight="700" color="fg.default">
          {item.type === 'divider' ? t('sequence_divider') : t('sequence_delay')}
        </Text>
        <Box>
          <Text fontSize="xs" mb="4px" color="fg.muted">
            Text
          </Text>
          <Input
            size="sm"
            minH="32px"
            h="32px"
            disabled={readOnly}
            value={row.text}
            onChange={(e) =>
              applyCommand(
                {
                  type: 'item.update',
                  id: row.id,
                  patch: { text: e.target.value },
                },
                'inspector'
              )
            }
          />
        </Box>
        <Button
          size="sm"
          colorPalette="red"
          variant="outline"
          disabled={readOnly}
          onClick={() => {
            applyCommand({ type: 'item.remove', id: row.id }, 'inspector');
            setSelection(null);
          }}
        >
          {t('delete')}
        </Button>
      </VStack>
    );
  }

  if (item.type !== 'message') {
    return (
      <Box p="12px">
        <Text fontSize="sm" color="fg.muted">
          {t('sequence_properties_empty')}
        </Text>
      </Box>
    );
  }

  const msg = item as MessageItem;
  const isTopLevelMessage = model.items.some(
    (it) => it.type === 'message' && it.id === msg.id
  );
  const activateValue = msg.activate ?? '';
  const deactivateValue = msg.deactivate ?? '';

  return (
    <VStack align="stretch" gap="10px" p="12px">
      <Text fontWeight="700" color="fg.default">
        {msg.return ? t('sequence_return') : t('sequence_message')}
      </Text>
      {!msg.return ? (
        <>
          <ThemedSelect
            size="sm"
            mb={0}
            label="From"
            disabled={readOnly}
            value={msg.from}
            options={participantOptions}
            onChange={(next) =>
              applyCommand(
                { type: 'item.update', id: msg.id, patch: { from: next } as Partial<MessageItem> },
                'inspector'
              )
            }
          />
          <ThemedSelect
            size="sm"
            mb={0}
            label="To"
            disabled={readOnly}
            value={msg.to}
            options={participantOptions}
            onChange={(next) =>
              applyCommand(
                { type: 'item.update', id: msg.id, patch: { to: next } as Partial<MessageItem> },
                'inspector'
              )
            }
          />
        </>
      ) : null}
      <Box>
        <Text fontSize="xs" mb="4px" color="fg.muted">
          Text
        </Text>
        <Input
          size="sm"
          minH="32px"
          h="32px"
          disabled={readOnly}
          value={msg.text}
          onChange={(e) =>
            applyCommand(
              {
                type: 'item.update',
                id: msg.id,
                patch: { text: e.target.value } as Partial<MessageItem>,
              },
              'inspector'
            )
          }
        />
      </Box>
      {!msg.return ? (
        <ThemedSelect
          size="sm"
          mb={0}
          label="Arrow"
          disabled={readOnly}
          value={msg.arrow}
          options={ARROW_TYPES.map((a) => ({ value: a, label: a }))}
          onChange={(next) =>
            applyCommand(
              {
                type: 'item.update',
                id: msg.id,
                patch: { arrow: next as ArrowType } as Partial<MessageItem>,
              },
              'inspector'
            )
          }
        />
      ) : null}
      <ThemedSelect
        size="sm"
        mb={0}
        label={t('sequence_activate')}
        disabled={readOnly}
        value={activateValue}
        options={[
          { value: '', label: '—' },
          { value: 'target', label: 'target ++' },
          { value: 'source', label: 'source' },
        ]}
        onChange={(next) =>
          applyCommand(
            {
              type: 'item.update',
              id: msg.id,
              patch: {
                activate: next ? (next as 'source' | 'target') : undefined,
              } as Partial<MessageItem>,
            },
            'inspector'
          )
        }
      />
      <ThemedSelect
        size="sm"
        mb={0}
        label={t('sequence_deactivate')}
        disabled={readOnly}
        value={deactivateValue}
        options={[
          { value: '', label: '—' },
          { value: 'target', label: 'target --' },
          { value: 'source', label: 'source' },
        ]}
        onChange={(next) =>
          applyCommand(
            {
              type: 'item.update',
              id: msg.id,
              patch: {
                deactivate: next ? (next as 'source' | 'target') : undefined,
              } as Partial<MessageItem>,
            },
            'inspector'
          )
        }
      />
      {isTopLevelMessage && !msg.return ? (
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={() =>
            applyCommand(
              { type: 'item.wrapExpand', messageIds: [msg.id], label: 'Expand' },
              'inspector'
            )
          }
        >
          {t('sequence_wrap_expand')}
        </Button>
      ) : null}
      <Button
        size="sm"
        colorPalette="red"
        variant="outline"
        disabled={readOnly}
        onClick={() => {
          applyCommand({ type: 'item.remove', id: msg.id }, 'inspector');
          setSelection(null);
        }}
      >
        {t('delete')}
      </Button>
    </VStack>
  );
}
