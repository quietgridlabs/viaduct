import { containerDocument, resolveJsonRefs, resolveSchemaText } from '../openapiRefs';

const doc = {
  components: {
    schemas: {
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
      Node: { type: 'object', properties: { child: { $ref: '#/components/schemas/Node' } } },
    },
    'weird~name/with': { type: 'string' },
  },
};

describe('resolveJsonRefs', () => {
  it('follows an internal pointer', () => {
    expect(resolveJsonRefs({ $ref: '#/components/schemas/Pet' }, doc)).toEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
    });
  });

  it('follows pointers nested inside a schema', () => {
    const resolved = resolveJsonRefs(
      { type: 'array', items: { $ref: '#/components/schemas/Pet' } },
      doc
    ) as { items: { type: string } };
    expect(resolved.items.type).toBe('object');
  });

  it('lets a sibling of $ref override the target', () => {
    // OpenAPI 3.1 allows this, and the local word is the more specific one.
    const resolved = resolveJsonRefs(
      { $ref: '#/components/schemas/Pet', description: 'The pet in question' },
      doc
    ) as { type: string; description: string };
    expect(resolved.type).toBe('object');
    expect(resolved.description).toBe('The pet in question');
  });

  it('stops a self-referencing schema at the loop instead of expanding it', () => {
    const resolved = resolveJsonRefs({ $ref: '#/components/schemas/Node' }, doc) as {
      properties: { child: { $ref?: string } };
    };
    expect(resolved.properties.child.$ref).toBe('#/components/schemas/Node');
  });

  it('unescapes ~1 and ~0 in pointer tokens', () => {
    expect(resolveJsonRefs({ $ref: '#/components/weird~0name~1with' }, doc)).toEqual({
      type: 'string',
    });
  });

  it('leaves a pointer that goes nowhere exactly as written', () => {
    const dangling = { $ref: '#/components/schemas/Missing' };
    expect(resolveJsonRefs(dangling, doc)).toEqual(dangling);
  });

  it('leaves an external pointer alone — a browser cannot fetch it', () => {
    const external = { $ref: 'https://example.com/pets.yaml#/components/schemas/Pet' };
    expect(resolveJsonRefs(external, doc)).toEqual(external);

    const file = { $ref: './shared.yaml#/Pet' };
    expect(resolveJsonRefs(file, doc)).toEqual(file);
  });
});

describe('resolveSchemaText', () => {
  it('resolves a schema block written as JSON text', () => {
    const out = resolveSchemaText('{"$ref": "#/components/schemas/Pet"}', doc);
    expect(JSON.parse(out)).toEqual({ type: 'object', properties: { id: { type: 'string' } } });
  });

  it('hands back text with no ref byte for byte', () => {
    const text = '{"type":"string"}';
    expect(resolveSchemaText(text, doc)).toBe(text);
  });

  it('hands back text that is not JSON rather than losing it', () => {
    expect(resolveSchemaText('not json at all "$ref"', doc)).toBe('not json at all "$ref"');
  });

  it('does nothing without a document to resolve against', () => {
    const text = '{"$ref": "#/components/schemas/Pet"}';
    expect(resolveSchemaText(text, null)).toBe(text);
  });
});

describe('containerDocument', () => {
  it('reads a stored contract', () => {
    expect(containerDocument('{"openapi":"3.1.0"}')).toEqual({ openapi: '3.1.0' });
  });

  it('is null for nothing, junk, or a non-object', () => {
    expect(containerDocument(undefined)).toBeNull();
    expect(containerDocument('   ')).toBeNull();
    expect(containerDocument('{oops')).toBeNull();
    expect(containerDocument('"a string"')).toBeNull();
  });
});
