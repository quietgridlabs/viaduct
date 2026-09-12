export const pluginLoaders = {
  '@archivisio/default': () => import('./oss-default'),
  '@archivisio/arch-tools': () => import('./arch-tools'),
  '@archivisio/sequence-editor': () => import('./sequence-editor'),
  '@archivisio/docs-editor': () => import('./docs-editor'),
  '@archivisio/data-flows': () => import('./data-flows'),
}
