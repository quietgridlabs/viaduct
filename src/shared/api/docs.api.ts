import type { ProjectDocumentation } from './types';

/**
 * Community: docs live in the flat model / localStorage.
 * No-ops so cloud-era callers never hit `/api/projects/.../docs`.
 */
export const docsApi = {
  listProjectDocs: async (
    _projectId: string,
    _ownerType?: string,
    _ownerId?: string
  ): Promise<{ docs: ProjectDocumentation[] }> => ({ docs: [] }),

  createProjectDoc: async (
    projectId: string,
    payload: {
      id?: string;
      ownerType: 'system' | 'container' | 'component' | 'code';
      ownerId: string;
      title: string;
      markdown: string;
    }
  ): Promise<{ doc: ProjectDocumentation }> => {
    const now = new Date().toISOString();
    return {
      doc: {
        id: payload.id || crypto.randomUUID(),
        project_id: projectId,
        owner_type: payload.ownerType,
        owner_id: payload.ownerId,
        title: payload.title,
        markdown: payload.markdown,
        created_at: now,
        updated_at: now,
      },
    };
  },

  updateProjectDoc: async (
    projectId: string,
    docId: string,
    payload: {
      title?: string;
      markdown?: string;
      ownerType?: 'system' | 'container' | 'component' | 'code';
      ownerId?: string;
    }
  ): Promise<{ doc: ProjectDocumentation }> => {
    const now = new Date().toISOString();
    return {
      doc: {
        id: docId,
        project_id: projectId,
        owner_type: payload.ownerType || 'system',
        owner_id: payload.ownerId || '',
        title: payload.title || '',
        markdown: payload.markdown || '',
        created_at: now,
        updated_at: now,
      },
    };
  },

  deleteProjectDoc: async (_projectId: string, _docId: string) => ({ ok: true as const }),
};
