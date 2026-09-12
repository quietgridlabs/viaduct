import { describe, expect, it } from 'vitest';
import {
  buildGrpcProtoFiles,
  countStoredContractOperations,
  documentProtocolMix,
  parseGrpcRpcPath,
  serviceContractOperationCount,
  serviceContractOwnerForCard,
  viewerOperations,
  type OpenApiDocument,
} from '../serviceContract';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

const sampleDoc = {
  openapi: '3.1.0',
  info: { title: 'Billing', version: '1.0.0' },
  paths: {
    '/api/invoices': {
      get: { summary: 'List invoices', responses: { '200': { description: 'OK' } } },
    },
  },
  'x-grpc': {
    '/billing.v1.InvoiceService/GetInvoice': {
      protocol: 'GRPC',
      streaming: 'unary',
      summary: 'GetInvoice',
      request: {
        name: 'GetInvoiceRequest',
        proto: 'message GetInvoiceRequest {\n  string id = 1;\n}',
      },
      response: {
        name: 'GetInvoiceResponse',
        proto: 'message GetInvoiceResponse {\n  string id = 1;\n}',
      },
    },
  },
} as OpenApiDocument;

describe('serviceContract viewer helpers', () => {
  it('tags operations by protocol kind', () => {
    const ops = viewerOperations(sampleDoc);
    expect(ops.some((o) => o.kind === 'http' && o.method === 'GET')).toBe(true);
    expect(ops.some((o) => o.kind === 'grpc' && o.method === 'GRPC')).toBe(true);
  });

  it('counts protocol mix', () => {
    expect(documentProtocolMix(sampleDoc)).toEqual({ http: 1, websocket: 0, grpc: 1 });
  });

  it('parses /package.Service/Method paths', () => {
    expect(parseGrpcRpcPath('/billing.v1.InvoiceService/GetInvoice')).toEqual({
      packageName: 'billing.v1',
      service: 'InvoiceService',
      method: 'GetInvoice',
    });
  });

  it('builds .proto files with service stubs', () => {
    const files = buildGrpcProtoFiles(sampleDoc);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toMatch(/InvoiceService_GetInvoice\.proto$/);
    expect(files[0].content).toContain('syntax = "proto3"');
    expect(files[0].content).toContain('package billing.v1;');
    expect(files[0].content).toContain('message GetInvoiceRequest');
    expect(files[0].content).toContain(
      'rpc GetInvoice (GetInvoiceRequest) returns (GetInvoiceResponse);'
    );
  });

  it('counts stored OpenAPI ops when the canvas has no endpoints (clone cards)', () => {
    expect(countStoredContractOperations(JSON.stringify(sampleDoc))).toBe(2);
    expect(countStoredContractOperations(undefined)).toBe(0);
    expect(countStoredContractOperations('{')).toBe(0);

    const emptyModel = {
      systems: [],
      containers: [],
      components: [],
      codeElements: [],
    } as FlatC4Model;
    expect(
      serviceContractOperationCount(emptyModel, 'billing', {
        openapi: JSON.stringify(sampleDoc),
      })
    ).toBe(2);
  });

  it('rolls up service contracts for a system projected as a container card', () => {
    const model = {
      systems: [{ id: 'sys', name: 'Billing' }],
      containers: [
        {
          id: 'api',
          name: 'API',
          systemId: 'sys',
          openapi: JSON.stringify(sampleDoc),
        },
        { id: 'db', name: 'DB', systemId: 'sys' },
        {
          id: 'sys-clone',
          name: 'Billing',
          systemId: 'other',
          original: { id: 'sys', type: 'system' },
        },
      ],
      components: [],
      codeElements: [],
    } as unknown as FlatC4Model;

    expect(
      serviceContractOwnerForCard(model, 'sys', { originalType: 'system' })
    ).toEqual({
      containerId: 'api',
      count: 2,
      openapi: JSON.stringify(sampleDoc),
    });
  });
});
