export {
  useProjectDocs,
  useProjectDocsQuery,
  fetchProjectDocs,
} from './model/docs.queries';

export {
  invalidateProjectDocs,
  useCreateProjectDoc,
  useCreateProjectDocForProject,
  useUpdateProjectDoc,
  useUpdateProjectDocForProject,
  useDeleteProjectDoc,
  useDeleteProjectDocForProject,
} from './model/docs.mutations';

export type { ProjectDocumentation } from './api/docs.api';
