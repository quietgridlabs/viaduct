import { TechnologyLevel } from '@archivisio/c4-modelizer-sdk';
import type { PaletteMode } from '@theme/theme';
import { readableAccent } from '@theme/canvasSurfaces';
import cloud from './technologies/cloud.json';
import codes from './technologies/codes.json';
import databases from './technologies/databases.json';
import devops from './technologies/devops.json';
import frameworks from './technologies/frameworks.json';
import gateways from './technologies/gateways.json';
import languages from './technologies/languages.json';
import messageBrokers from './technologies/messageBrokers.json';
import monitoring from './technologies/monitoring.json';
import protocols from './technologies/protocols.json';
import saas from './technologies/saas.json';
import security from './technologies/security.json';
import systems from './technologies/systems.json';

export interface Technology {
  id: string;
  name: string;
  icon: string;
  color: string;
  levels: TechnologyLevel[];
}

export const technologies = [
  ...cloud,
  ...codes,
  ...databases,
  ...devops,
  ...frameworks,
  ...gateways,
  ...languages,
  ...messageBrokers,
  ...monitoring,
  ...saas,
  ...security,
  ...systems,
  ...protocols,
] as Technology[];

export const getTechnologiesByLevel = (level: TechnologyLevel): Technology[] => {
  return technologies.filter(tech => tech.levels.includes(level)).sort((a, b) => a.name.localeCompare(b.name));
};

export const getTechnologyById = (id: string): Technology | undefined => {
  return technologies.find(tech => tech.id === id);
};

/** Datastores are drawn as cylinders on the canvas, C4-style. */
const DATABASE_TECH_IDS = new Set<string>([
  ...databases.map((t) => t.id),
  'database-server',
  'storage',
]);

/** People/actors get the C4 person glyph instead of a plain card. */
const PERSON_TECH_IDS = new Set<string>(['users']);

export function isDatabaseTechnology(id?: string): boolean {
  return Boolean(id && DATABASE_TECH_IDS.has(id));
}

export function isPersonTechnology(id?: string): boolean {
  return Boolean(id && PERSON_TECH_IDS.has(id));
}

/**
 * Technology catalog colors can be near-white (Kafka #f3f3f3) or near-black,
 * so neither reads on both canvases. This keeps the brand hue and moves only
 * its lightness into the legible band for the active theme.
 */
export function canvasSafeTechColor(
  color?: string,
  fallback = '#1f75cb',
  mode: PaletteMode = 'dark'
): string {
  return readableAccent(color ?? fallback, mode);
}
