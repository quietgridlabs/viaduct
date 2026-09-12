export type DocOwnerFilter = {
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
};

/**
 * Sibling to `['projects', id, 'threads']`. Invalidating `prefix(projectId)`
 * refreshes every docs list for that project without touching thread caches.
 */
export const docsKeys = {
  prefix: (projectId: string) => ['projects', projectId, 'docs'] as const,
  list: (projectId: string, owner?: DocOwnerFilter) =>
    owner
      ? (['projects', projectId, 'docs', owner.ownerType, owner.ownerId] as const)
      : (['projects', projectId, 'docs'] as const),
};

export type ProjectDocsListKey = ReturnType<typeof docsKeys.list>;
