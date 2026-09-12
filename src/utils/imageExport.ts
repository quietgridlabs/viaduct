import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { renderApi, type RenderFormat } from '@shared/api';
import { technologies } from '@data/technologies';
import databases from '@data/technologies/databases.json';

/**
 * Image export is a server call: the backend draws the diagram from the model
 * and hands back a file. The client only decides *what* to render and saves the
 * result.
 */

const DATABASE_IDS = new Set((databases as Array<{ id: string }>).map((t) => t.id));

/** The slice of the technology catalog the renderer needs, by id. */
function technologyMap() {
  const map: Record<string, { id: string; name: string; color: string; database: boolean }> = {};
  for (const tech of technologies) {
    map[tech.id] = {
      id: tech.id,
      name: tech.name,
      color: tech.color,
      database: DATABASE_IDS.has(tech.id) || tech.id === 'database-server' || tech.id === 'storage',
    };
  }
  return map;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/** Name the file after the level being looked at, so downloads stay tellable apart. */
function diagramFilename(model: FlatC4Model): string {
  const level = model.viewLevel || 'system';
  const active =
    level === 'container'
      ? model.systems.find((s) => s.id === model.activeSystemId)?.name
      : level === 'component'
        ? model.containers.find((c) => c.id === model.activeContainerId)?.name
        : level === 'code'
          ? model.components.find((c) => c.id === model.activeComponentId)?.name
          : null;
  return slugify(active ? `${active}-${level}` : `c4-${level}`, 'c4-diagram');
}

export async function exportCurrentDiagram(opts: {
  model: FlatC4Model;
  theme: 'light' | 'dark';
  format: RenderFormat;
}): Promise<void> {
  const filename = diagramFilename(opts.model);
  const blob = await renderApi.renderDiagram({
    model: opts.model,
    view: {
      viewLevel: opts.model.viewLevel,
      activeSystemId: opts.model.activeSystemId,
      activeContainerId: opts.model.activeContainerId,
      activeComponentId: opts.model.activeComponentId,
    },
    theme: opts.theme,
    technologies: technologyMap(),
    format: opts.format,
    filename,
  });
  saveBlob(blob, `${filename}.${opts.format}`);
}

export async function exportSequenceDiagram(opts: {
  /** Parsed sequence model — the PlantUML parser stays on the client. */
  model: unknown;
  name: string;
  theme: 'light' | 'dark';
  format: RenderFormat;
}): Promise<void> {
  const filename = slugify(opts.name, 'sequence');
  const blob = await renderApi.renderSequence({
    model: opts.model,
    name: opts.name,
    theme: opts.theme,
    format: opts.format,
    filename,
  });
  saveBlob(blob, `${filename}.${opts.format}`);
}
