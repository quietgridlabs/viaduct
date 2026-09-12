import {
  parseHttpContract,
  serializeHttpContract,
  type HttpContractSide,
} from '@components/common/HttpContract';

/**
 * Following `$ref` on the reading side, in the browser.
 *
 * The server resolves documents with @scalar/openapi-parser, which is the right
 * tool there: it handles every OpenAPI version, external files and validation.
 * It is the wrong tool here — it is async and pulls megabytes into the bundle,
 * and a documentation embed needs neither. What it needs is one small
 * synchronous thing: follow internal `#/…` pointers inside a document already
 * in memory. External refs and dangling pointers are left written as they are,
 * because a browser cannot fetch them and a lie would be worse than a pointer.
 */

type Doc = Record<string, unknown>;

/** Deep enough for real schemas, shallow enough to never hang on a pathology. */
const MAX_DEPTH = 20;

function unescapeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function lookup(doc: Doc, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined;
  let node: unknown = doc;
  for (const token of ref.slice(2).split('/')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[unescapeToken(token)];
  }
  return node;
}

export function resolveJsonRefs(value: unknown, doc: Doc, trail: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveJsonRefs(item, doc, trail));
  if (!value || typeof value !== 'object') return value;

  const node = value as Record<string, unknown>;
  const ref = typeof node.$ref === 'string' ? node.$ref : null;

  if (ref) {
    /* A pointer already on the trail is the loop closing on itself: leave it
       written as a pointer instead of expanding forever. */
    if (trail.includes(ref) || trail.length >= MAX_DEPTH) return node;
    const target = lookup(doc, ref);
    if (target === undefined) return node;

    /* OpenAPI 3.1 lets a $ref carry siblings — a local description overrides
       whatever the target says, so it is applied over the resolved node. */
    const siblings = Object.fromEntries(Object.entries(node).filter(([key]) => key !== '$ref'));
    const resolved = resolveJsonRefs(target, doc, [...trail, ref]);
    return resolved && typeof resolved === 'object' && !Array.isArray(resolved)
      ? { ...(resolved as Doc), ...siblings }
      : resolved;
  }

  return Object.fromEntries(
    Object.entries(node).map(([key, item]) => [key, resolveJsonRefs(item, doc, trail)])
  );
}

/** One JSON schema block with its pointers followed. Untouched if it has none. */
export function resolveSchemaText(text: string, doc: Doc | null): string {
  if (!doc || !text || !text.includes('"$ref"')) return text;
  try {
    return `${JSON.stringify(resolveJsonRefs(JSON.parse(text), doc), null, 2)}`;
  } catch {
    return text;
  }
}

/** The container's stored contract, or null when it has none worth reading. */
export function containerDocument(raw: string | undefined | null): Doc | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Doc) : null;
  } catch {
    return null;
  }
}

/**
 * A stored contract with the schemas inside it resolved, for display.
 *
 * The round trip through parse/serialize only runs when the text actually
 * mentions a `$ref`, so a contract without one is handed back byte for byte
 * rather than reformatted for nothing.
 */
export function resolveContractText(
  raw: string | undefined,
  side: HttpContractSide,
  doc: Doc | null
): string {
  const text = raw || '';
  if (!doc || !text.includes('$ref')) return text;

  try {
    const contract = parseHttpContract(text, side);
    if (contract.mode === 'channel') {
      contract.messages = contract.messages.map((message) => ({
        ...message,
        body: { ...message.body, schema: resolveSchemaText(message.body.schema, doc) },
      }));
    } else if (contract.side === 'request') {
      contract.body = { ...contract.body, schema: resolveSchemaText(contract.body.schema, doc) };
    } else {
      contract.responses = contract.responses.map((response) => ({
        ...response,
        body: { ...response.body, schema: resolveSchemaText(response.body.schema, doc) },
      }));
    }
    return serializeHttpContract(contract);
  } catch {
    return text;
  }
}
