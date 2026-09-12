import { z } from 'zod';
import type { SequenceModel } from './sequence-model';

const participantKindSchema = z.enum([
  'actor',
  'participant',
  'boundary',
  'control',
  'entity',
  'database',
  'queue',
  'collections',
]);

const arrowTypeSchema = z.enum(['->', '-->', '->>', '-->>', '->x', '-->x']);

const participantIdSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Invalid participant id');

export const participantSchema = z.object({
  id: participantIdSchema,
  label: z.string().min(1),
  kind: participantKindSchema,
  order: z.number().int().nonnegative(),
  color: z.string().optional(),
  c4EntityId: z.string().optional(),
});

const messageItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('message'),
  from: participantIdSchema,
  to: participantIdSchema,
  text: z.string(),
  arrow: arrowTypeSchema,
  return: z.boolean().optional(),
  activate: z.enum(['source', 'target']).optional(),
  deactivate: z.enum(['source', 'target']).optional(),
});

const noteItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('note'),
  position: z.enum(['left', 'right', 'over']),
  participantIds: z.array(participantIdSchema).min(1).max(2),
  text: z.string(),
});

const delayItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('delay'),
  text: z.string(),
});

const dividerItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('divider'),
  text: z.string(),
});

const activationItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('activation'),
  participantId: participantIdSchema,
  action: z.enum(['activate', 'deactivate']),
});

const fragmentBranchSchema: z.ZodType<{
  id: string;
  condition?: string;
  items: unknown[];
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    condition: z.string().optional(),
    items: z.array(sequenceItemSchema),
  })
);

const fragmentItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('fragment'),
  kind: z.enum(['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group']),
  label: z.string(),
  branches: z.array(fragmentBranchSchema).min(1),
});

export const sequenceItemSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    messageItemSchema,
    noteItemSchema,
    delayItemSchema,
    dividerItemSchema,
    activationItemSchema,
    fragmentItemSchema,
  ])
);

export const sequenceModelSchema = z.object({
  version: z.literal(1),
  title: z.string().optional(),
  participants: z.array(participantSchema),
  items: z.array(sequenceItemSchema),
});

export function validateSequenceModel(model: SequenceModel): SequenceModel {
  const parsed = sequenceModelSchema.parse(model) as SequenceModel;
  const ids = new Set(parsed.participants.map((p) => p.id));
  if (ids.size !== parsed.participants.length) {
    throw new Error('Duplicate participant ids');
  }
  for (const item of parsed.items) {
    assertItemParticipants(item, ids);
  }
  return parsed;
}

function assertItemParticipants(
  item: SequenceModel['items'][number],
  ids: Set<string>
): void {
  if (item.type === 'message') {
    if (!ids.has(item.from) || !ids.has(item.to)) {
      throw new Error(`Message references unknown participant`);
    }
    return;
  }
  if (item.type === 'note') {
    for (const pid of item.participantIds) {
      if (!ids.has(pid)) throw new Error(`Note references unknown participant`);
    }
    return;
  }
  if (item.type === 'activation') {
    if (!ids.has(item.participantId)) {
      throw new Error(`Activation references unknown participant`);
    }
    return;
  }
  if (item.type === 'fragment') {
    for (const branch of item.branches) {
      for (const child of branch.items) {
        assertItemParticipants(child, ids);
      }
    }
  }
}
