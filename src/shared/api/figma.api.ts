/** Community stubs — Figma / design-system cloud sync is not available. */

export type DesignSystemValues = {
  tokens: unknown[];
  suggestions: unknown[];
  file?: { name?: string; key?: string } | null;
};

export const designReadApi = {
  readDesignNode: async (
    _projectId: string,
    _ownerType: string,
    _ownerId: string,
    _image = false
  ): Promise<never> => {
    throw new Error('Design node sync is Cloud-only');
  },
  readDesignSystemValues: async (
    _projectId: string,
    _system: string
  ): Promise<DesignSystemValues> => {
    throw new Error('Design system sync is Cloud-only');
  },
};

export const figmaApi = {
  getFigmaConnection: async () => ({ connected: false as const }),
  connectFigma: async (_token: string) => ({ connected: false as const }),
  disconnectFigma: async () => ({ connected: false as const }),
};
