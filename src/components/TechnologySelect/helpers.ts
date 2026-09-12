import type { TechnologyLevel } from '@archivisio/c4-modelizer-sdk';
import {
  getTechnologiesByLevel,
  getTechnologyById,
  type Technology,
} from '@data/technologies';
import { LIGHT_ICON_FALLBACK, LIGHT_ICON_LUMINANCE } from './constants';
import type { TechnologyOptionItem } from './types';

/** Very light icon colors disappear on light menu backgrounds. */
export function resolveIconColor(hex: string): string {
  const clean = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > LIGHT_ICON_LUMINANCE ? LIGHT_ICON_FALLBACK : hex;
}

/** Level catalogue, with the current selection kept even if it left the level. */
export function technologiesForSelect(
  level: TechnologyLevel,
  value: string
): Technology[] {
  const compatible = getTechnologiesByLevel(level);
  if (!value) return compatible;
  const selected =
    compatible.find((tech) => tech.id === value) || getTechnologyById(value) || null;
  if (selected && !compatible.some((t) => t.id === selected.id)) {
    return [selected, ...compatible];
  }
  return compatible;
}

export function toOptionItems(options: Technology[]): TechnologyOptionItem[] {
  return options.map((o) => ({
    label: o.name,
    value: o.id,
    color: o.color,
    icon: o.icon || o.id,
  }));
}
