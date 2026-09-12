import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { trackProductEvent } from '@/metrics';
import type { RenderFormat } from '@shared/api';
import { exportCurrentDiagram } from '@utils/imageExport';

/**
 * Images are drawn by the backend from the model we send — the canvas is not
 * screenshotted, so the export does not depend on what is on screen.
 */
export async function exportDiagramImage(opts: {
  model: FlatC4Model;
  theme: 'light' | 'dark';
  format: RenderFormat;
}): Promise<void> {
  try {
    await exportCurrentDiagram(opts);
    /* Scope says which diagram left the tool — the C4 level, never its name. */
    trackProductEvent('export.image', {
      format: opts.format,
      scope: opts.model.viewLevel,
    });
  } catch (err) {
    trackProductEvent('health.export_failed', { format: opts.format });
    throw err;
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
