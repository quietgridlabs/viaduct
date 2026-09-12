import type {
  OpenApiBuildRequest,
  OpenApiDocumentResponse,
  OpenApiImportedEndpoint,
  RenderDiagramRequest,
  RenderSequenceRequest,
} from './types';

import {
  buildServiceDocument,
  endpointsFromDocument,
  mergeServiceDocument,
  parseServiceDocument,
  resolveDocument,
  serviceDocumentFileName,
} from '@utils/openapiEngine.js';

/** Image render still needs a host — Community ships SVG/PNG via local canvas export. */
export const renderApi = {
  renderDiagram: async (_payload: RenderDiagramRequest): Promise<Blob> => {
    throw new Error('Server diagram render is not available in Community. Use Export → SVG/PNG.');
  },
  renderSequence: async (_payload: RenderSequenceRequest): Promise<Blob> => {
    throw new Error('Server sequence render is not available in Community. Use Export → SVG/PNG.');
  },
};

/**
 * OpenAPI conversion runs in-browser — Community has no /api/openapi.
 * Same pure functions the cloud server uses.
 */
export const openapiApi = {
  openapiBuild: async (payload: OpenApiBuildRequest) => {
    const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : [];
    const doc = buildServiceDocument(endpoints, payload.meta || {}, payload.stored) as OpenApiDocumentResponse;
    const { resolved } = await resolveDocument(doc);
    return { doc, resolved: (resolved ?? doc) as OpenApiDocumentResponse };
  },

  openapiParse: async (payload: { json: string; stored?: string }) => {
    const parsed = parseServiceDocument(payload.json);
    if (!parsed.ok) throw new Error(parsed.error || 'Parse failed');

    let doc = parsed.doc as OpenApiDocumentResponse & Record<string, unknown>;
    if (typeof payload.stored === 'string' && payload.stored.trim()) {
      const base = parseServiceDocument(payload.stored);
      if (base.ok) {
        doc = mergeServiceDocument(base.doc, parsed.doc) as OpenApiDocumentResponse &
          Record<string, unknown>;
      }
    }

    const { resolved, errors } = await resolveDocument(doc);
    return {
      doc: doc as OpenApiDocumentResponse,
      resolved: (resolved ?? doc) as OpenApiDocumentResponse,
      endpoints: endpointsFromDocument(doc, resolved) as unknown as OpenApiImportedEndpoint[],
      ...(errors?.length
        ? { refErrors: errors.map((e: { message?: string }) => e?.message).filter(Boolean) as string[] }
        : {}),
    };
  },

  openapiExport: async (payload: OpenApiBuildRequest) => {
    const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : [];
    const doc = buildServiceDocument(endpoints, payload.meta || {}, payload.stored);
    const filename = serviceDocumentFileName(payload.meta?.title || doc.info?.title);
    const body = `${JSON.stringify(doc, null, 2)}\n`;
    return new File([body], filename, { type: 'application/json' });
  },
};
