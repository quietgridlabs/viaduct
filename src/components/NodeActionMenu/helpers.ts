import type { NodeMenuAction, NodeMenuActionSources } from './types';

type Translate = (key: string) => string;

/** What can be attached to this element — docs, a sequence, an OpenAPI file. */
export function buildAddItems(props: NodeMenuActionSources, t: Translate): NodeMenuAction[] {
  const items: NodeMenuAction[] = [];
  if (props.showAddDocumentation && props.onAddDocumentation) {
    items.push({
      value: 'add-documentation',
      testId: 'node-menu-add-docs',
      title: t('menu_add_documentation'),
      hint: t('menu_add_documentation_hint'),
      onClick: props.onAddDocumentation,
    });
  }
  if (props.showAddSequence && props.onAddSequence) {
    items.push({
      value: 'add-sequence',
      testId: 'node-menu-add-sequence',
      title: t('menu_add_sequence'),
      hint: t('menu_add_sequence_hint'),
      onClick: props.onAddSequence,
    });
  }
  if (props.showImportOpenApi && props.onImportOpenApi) {
    items.push({
      value: 'import-openapi',
      testId: 'node-menu-import-openapi',
      title: t('menu_import_openapi'),
      hint: t('menu_import_openapi_hint'),
      onClick: props.onImportOpenApi,
    });
  }
  return items;
}

/** The element on its own, or the element with everything under it. */
export function buildExportItems(props: NodeMenuActionSources, t: Translate): NodeMenuAction[] {
  const items: NodeMenuAction[] = [];
  if (props.onExportElement) {
    items.push({
      value: 'export-element',
      testId: 'node-menu-export-element',
      title: t('menu_export_element'),
      hint: t('menu_export_element_hint'),
      onClick: props.onExportElement,
    });
  }
  if (props.showExportSubtree && props.onExportElementSubtree) {
    items.push({
      value: 'export-element-subtree',
      testId: 'node-menu-export-element-subtree',
      title: t('menu_export_subtree'),
      hint: t('menu_export_subtree_hint'),
      onClick: props.onExportElementSubtree,
    });
  }
  return items;
}
