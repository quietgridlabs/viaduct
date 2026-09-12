/**
 * A container is a service, so its OpenAPI contract belongs in the archive
 * next to its docs and diagrams.
 */
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { unzipSync, strFromU8 } from 'fflate';

const listProjectDocs = jest.fn();
const openapiBuild = jest.fn();

jest.mock('@shared/api', () => ({
  docsApi: {
    listProjectDocs: (...args: unknown[]) => listProjectDocs(...args),
  },
  openapiApi: {
    openapiBuild: (...args: unknown[]) => openapiBuild(...args),
  },
}));

import { exportElementArchive } from '@utils/exportElement';

const CONTAINER_ID = 'ctr-1';

function model(overrides: Partial<FlatC4Model> = {}): FlatC4Model {
  return {
    systems: [{ id: 'sys-1', name: 'Bank', connections: [] }],
    containers: [
      {
        id: CONTAINER_ID,
        systemId: 'sys-1',
        name: 'API Application',
        connections: [],
      },
    ],
    components: [
      {
        id: 'ep-1',
        systemId: 'sys-1',
        containerId: CONTAINER_ID,
        name: 'Get account',
        kind: 'endpoint',
        method: 'GET',
        endpoint: '/api/accounts/:id',
        request: '',
        response: '@response 200 OK',
        connections: [],
      },
    ],
    codeElements: [],
    viewLevel: 'container',
    ...overrides,
  } as unknown as FlatC4Model;
}

/** The zip goes to a download; the test reads it out of the Blob instead. */
function captureArchive() {
  const chunks: BlobPart[] = [];
  const anchor = { href: '', download: '', click: jest.fn() };
  jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'a') return anchor as unknown as HTMLAnchorElement;
    return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  }) as typeof document.createElement);

  const originalBlob = global.Blob;
  class CapturingBlob extends originalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      if (options?.type === 'application/zip') chunks.push(...parts);
    }
  }
  global.Blob = CapturingBlob as unknown as typeof Blob;
  global.URL.createObjectURL = jest.fn(() => 'blob:test');
  global.URL.revokeObjectURL = jest.fn();

  return {
    restore: () => {
      global.Blob = originalBlob;
      jest.restoreAllMocks();
    },
    files: () => unzipSync(new Uint8Array(chunks[0] as ArrayBuffer)),
  };
}

const builtDoc = {
  openapi: '3.1.0',
  info: { title: 'API Application', version: '1.0.0' },
  paths: { '/api/accounts/{id}': { get: { operationId: 'getAccount' } } },
};

describe('element archive: service contract', () => {
  beforeEach(() => {
    listProjectDocs.mockResolvedValue({ docs: [] });
    openapiBuild.mockResolvedValue({ doc: builtDoc });
  });

  afterEach(() => jest.clearAllMocks());

  it('puts the container contract in the archive as swagger.json', async () => {
    const capture = captureArchive();
    try {
      await exportElementArchive({
        model: model(),
        ownerType: 'container',
        ownerId: CONTAINER_ID,
      });
      const files = capture.files();
      expect(Object.keys(files)).toContain('swagger.json');
      expect(JSON.parse(strFromU8(files['swagger.json']))).toEqual(builtDoc);
      const manifest = JSON.parse(strFromU8(files['manifest.json']));
      expect(manifest.serviceContracts).toEqual(['swagger.json']);
    } finally {
      capture.restore();
    }
  });

  it('falls back to the stored document when the API is unreachable', async () => {
    openapiBuild.mockRejectedValue(new Error('offline'));
    const stored = JSON.stringify({ openapi: '3.1.0', info: { title: 'Stored' }, paths: {} });
    const capture = captureArchive();
    try {
      const withStored = model();
      (withStored.containers[0] as unknown as { openapi: string }).openapi = stored;
      await exportElementArchive({
        model: withStored,
        ownerType: 'container',
        ownerId: CONTAINER_ID,
      });
      const files = capture.files();
      expect(JSON.parse(strFromU8(files['swagger.json'])).info.title).toBe('Stored');
    } finally {
      capture.restore();
    }
  });

  it('writes no contract for a container that has neither endpoints nor a document', async () => {
    const capture = captureArchive();
    try {
      await exportElementArchive({
        model: model({ components: [] } as Partial<FlatC4Model>),
        ownerType: 'container',
        ownerId: CONTAINER_ID,
      });
      const files = capture.files();
      expect(Object.keys(files)).not.toContain('swagger.json');
      expect(JSON.parse(strFromU8(files['manifest.json'])).serviceContracts).toBeUndefined();
    } finally {
      capture.restore();
    }
  });

  it('exporting a system subtree carries one contract per service', async () => {
    const two = model();
    two.containers.push({
      id: 'ctr-2',
      systemId: 'sys-1',
      name: 'Reporting API',
      connections: [],
    } as unknown as FlatC4Model['containers'][number]);
    two.components.push({
      id: 'ep-2',
      systemId: 'sys-1',
      containerId: 'ctr-2',
      name: 'List reports',
      kind: 'endpoint',
      method: 'GET',
      endpoint: '/api/reports',
      connections: [],
    } as unknown as FlatC4Model['components'][number]);

    const capture = captureArchive();
    try {
      await exportElementArchive({
        model: two,
        ownerType: 'system',
        ownerId: 'sys-1',
        mode: 'subtree',
      });
      const names = Object.keys(capture.files());
      expect(names).toContain('contracts/API_Application_swagger.json');
      expect(names).toContain('contracts/Reporting_API_swagger.json');
    } finally {
      capture.restore();
    }
  });

  it('a component export carries no contract — only containers are services', async () => {
    const capture = captureArchive();
    try {
      await exportElementArchive({
        model: model(),
        ownerType: 'component',
        ownerId: 'ep-1',
      });
      expect(Object.keys(capture.files())).not.toContain('swagger.json');
    } finally {
      capture.restore();
    }
  });
});
