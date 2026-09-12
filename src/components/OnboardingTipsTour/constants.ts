import type { TipsTourStep } from './types';

export const TIPS_TOUR_STORAGE_KEY = 'c4-tips-tour-v1';

/** Card geometry: width, and the breathing room between card and spotlight. */
export const TIPS_TOUR_CARD_WIDTH = 320;
export const TIPS_TOUR_CARD_GAP = 14;

/** Guest editor tour — left rail, canvas nav, top toolbar buttons. */
export const GUEST_TIPS_TOUR_STEPS: TipsTourStep[] = [
  {
    titleKey: 'tips_tour_welcome_title',
    bodyKey: 'tips_tour_welcome_body',
  },
  {
    target: 'tools-rail',
    titleKey: 'tips_tour_rail_title',
    bodyKey: 'tips_tour_rail_body',
    placement: 'right',
  },
  {
    target: 'add-block',
    titleKey: 'tips_tour_add_title',
    bodyKey: 'tips_tour_add_body',
    placement: 'right',
  },
  {
    target: 'export',
    titleKey: 'tips_tour_export_title',
    bodyKey: 'tips_tour_export_body',
    placement: 'right',
  },
  {
    target: 'import',
    titleKey: 'tips_tour_import_title',
    bodyKey: 'tips_tour_import_body',
    placement: 'right',
  },
  {
    titleKey: 'tips_tour_nav_title',
    bodyKey: 'tips_tour_nav_body',
  },
  {
    target: 'top-toolbar',
    titleKey: 'tips_tour_top_title',
    bodyKey: 'tips_tour_top_body',
    placement: 'bottom',
  },
  {
    target: 'help',
    titleKey: 'tips_tour_help_title',
    bodyKey: 'tips_tour_help_body',
    placement: 'bottom',
  },
  {
    target: 'docs',
    titleKey: 'tips_tour_docs_title',
    bodyKey: 'tips_tour_docs_body',
    placement: 'bottom',
  },
  {
    target: 'sequence',
    titleKey: 'tips_tour_sequence_title',
    bodyKey: 'tips_tour_sequence_body',
    placement: 'bottom',
  },
  {
    target: 'theme',
    titleKey: 'tips_tour_theme_title',
    bodyKey: 'tips_tour_theme_body',
    placement: 'bottom',
  },
  {
    target: 'catalog',
    titleKey: 'tips_tour_catalog_title',
    bodyKey: 'tips_tour_catalog_body',
    placement: 'bottom',
  },
  {
    target: 'flows',
    titleKey: 'tips_tour_flows_title',
    bodyKey: 'tips_tour_flows_body',
    placement: 'bottom',
  },
  {
    target: 'sign-in',
    titleKey: 'tips_tour_signin_title',
    bodyKey: 'tips_tour_signin_body',
    placement: 'bottom',
  },
  {
    titleKey: 'tips_tour_done_title',
    bodyKey: 'tips_tour_done_body',
  },
];
