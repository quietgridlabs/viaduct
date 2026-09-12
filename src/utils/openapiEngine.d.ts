/** Browser-side OpenAPI conversion (ported from the cloud server). */

export const OPENAPI_VERSION: string;

export function isWebSocketMethod(method: string): boolean;
export function isGrpcMethod(method: string): boolean;
export function toOpenApiPath(path: string): string;

export function buildServiceDocument(
  endpoints: unknown[],
  meta?: { title?: string; version?: string; description?: string } | null,
  stored?: string
): {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

export function parseServiceDocument(raw: unknown):
  | { ok: true; doc: Record<string, unknown> & { openapi: string; info: unknown; paths: Record<string, unknown> } }
  | { ok: false; error: string };

export function resolveDocument(doc: unknown): Promise<{
  resolved: unknown;
  errors: Array<{ message?: string }>;
}>;

export function endpointsFromDocument(doc: unknown, resolved?: unknown): unknown[];

export function mergeServiceDocument(
  base: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown>;

export function serviceDocumentFileName(title: string): string;
