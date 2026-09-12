import { isUiElement, type UiExtras } from '@/types/c4Extensions';

/**
 * Which technologies build an interface.
 *
 * A design system belongs to a front end, and only to a front end: offering
 * the field on a Kafka broker or a Postgres container is a row that never
 * fills. There is no "front-end-ness" in the C4 model to read, so it is read
 * off the technology — the same way the ER schema editor decides a container
 * is a database.
 *
 * Deliberately not on languages that build both sides. Kotlin is an Android
 * app as often as it is a Spring service, and guessing wrong in either
 * direction is worse than the rule below: a container that already carries a
 * design system or a designed element keeps its field whatever it is built
 * with, so nothing that exists is ever hidden.
 */
const UI_TECH_IDS = new Set([
  'react',
  'angular',
  'vue',
  'nextjs',
  'nuxtjs',
  'svelte',
  'gatsby',
  'ember',
  'bootstrap',
  'tailwind',
  'flutter',
  'swiftui',
  'swift',
  'dart',
]);

export function isUiTechnology(technologyId?: string | null): boolean {
  if (!technologyId) return false;
  return UI_TECH_IDS.has(technologyId.trim().toLowerCase());
}

/** Whether a container is offered the design-system field. */
export function containerTakesDesign(
  container: { technology?: string } & UiExtras & { id?: string },
  componentsInside: unknown[] = []
): boolean {
  if (isUiTechnology(container?.technology)) return true;
  if (container?.designSystem?.trim()) return true;
  return componentsInside.some((component) => isUiElement(component));
}

/**
 * Whether a component is offered the Design contract row.
 *
 * A design system on the parent front end must not open Design on every child
 * — a Python helper next to a React screen is not a UI element. Already-UI
 * elements and UI technologies keep the row; blank technology inside a UI
 * container still gets it so a new screen can be marked before tech is set.
 */
export function componentTakesDesign(
  component: { technology?: string } & UiExtras,
  inUiContainer = false
): boolean {
  if (isUiElement(component)) return true;
  if (isUiTechnology(component.technology)) return true;
  if (component.technology?.trim()) return false;
  return inUiContainer;
}
