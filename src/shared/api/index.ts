import { authApi, supportApi } from './auth.api';
import { dataFlowsApi, domainsApi } from './data-flows.api';
import { docsApi } from './docs.api';
import { renderApi, openapiApi } from './render.api';

export * from './types';
export { hasGitlabIdentity, isGuestUser, loginPagePath, onUnauthorized, SUPPORT_MAILTO } from './auth.api';

/** Community facade — local editor only; cloud HTTP APIs removed. */
export const api = {
  ...authApi,
  ...supportApi,
  ...renderApi,
  ...openapiApi,
  ...docsApi,
  ...dataFlowsApi,
  ...domainsApi,
};

export {
  authApi,
  supportApi,
  docsApi,
  dataFlowsApi,
  domainsApi,
  renderApi,
  openapiApi,
};

/** Figma / design-read stay as local stubs when imported. */
export { designReadApi, figmaApi } from './figma.api';
