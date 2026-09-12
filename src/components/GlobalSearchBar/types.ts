export type GlobalSearchBarProps = {
  projectName?: string;
};

/** An element found in another project of the same workspace. */
export type RelatedHit = {
  id: string;
  name: string;
  type: 'system' | 'container';
  technology: string;
  projectId: string;
  projectName: string;
  domainName: string;
};
