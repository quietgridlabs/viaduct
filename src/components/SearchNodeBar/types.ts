/** An element found in another domain or project of the workspace. */
export type RemoteHit = {
  id: string;
  name: string;
  type: 'system' | 'container';
  technology: string;
  projectId: string;
  projectName: string;
  domainId: string;
  domainName: string;
  description?: string;
  systemId?: string;
};

/** What is written onto the source element to point at the new clone. */
export type NewConnectionData = {
  targetId: string;
  description: string;
  sourceHandle?: string;
  targetHandle?: string;
};
