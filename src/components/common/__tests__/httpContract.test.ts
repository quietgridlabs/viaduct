import {
  derivePathParams,
  emptyBody,
  newParam,
  newResponse,
  parseHttpContract,
  parseParamLine,
  serializeHttpContract,
  summarizeHttpContract,
  syncPathParams,
  validateHttpContract,
  type HttpRequestContract,
  type HttpResponseContract,
} from '../HttpContract';

function asRequest(raw: string): HttpRequestContract {
  const parsed = parseHttpContract(raw, 'request');
  if (parsed.mode !== 'http' || parsed.side !== 'request') throw new Error('expected request');
  return parsed;
}

function asResponse(raw: string): HttpResponseContract {
  const parsed = parseHttpContract(raw, 'response');
  if (parsed.mode !== 'http' || parsed.side !== 'response') throw new Error('expected response');
  return parsed;
}

describe('httpContract parameters', () => {
  it('reads name, type, required, example and description off one line', () => {
    const param = parseParamLine('page: integer! = 1  # Page number', 'query');
    expect(param).toMatchObject({
      name: 'page',
      type: 'integer',
      required: true,
      example: '1',
      description: 'Page number',
    });
  });

  it('still reads the legacy `key=value` query line', () => {
    const param = parseParamLine('page=1', 'query');
    expect(param).toMatchObject({ name: 'page', type: 'string', required: false, example: '1' });
  });

  it('round-trips typed parameters through the stored text', () => {
    const raw = serializeHttpContract({
      side: 'request',
      mode: 'http',
      params: [
        newParam('path', { name: 'id', required: true, description: 'User id' }),
        newParam('query', { name: 'limit', type: 'integer', example: '20' }),
        newParam('header', { name: 'Authorization', required: true, example: 'Bearer <token>' }),
      ],
      body: emptyBody(),
    });
    expect(raw).toContain('@path');
    expect(raw).toContain('id: string!  # User id');
    expect(raw).toContain('@query');
    expect(raw).toContain('limit: integer = 20');
    expect(raw).toContain('@header');

    const parsed = asRequest(raw);
    expect(parsed.params.map((p) => [p.in, p.name, p.type, p.required])).toEqual([
      ['path', 'id', 'string', true],
      ['query', 'limit', 'integer', false],
      ['header', 'Authorization', 'string', true],
    ]);
  });

  it('derives path parameters from every path style', () => {
    expect(derivePathParams('/users/:userId/orders/{orderId}')).toEqual(['userId', 'orderId']);
  });

  it('adds only the path parameters that are missing', () => {
    const existing = [newParam('path', { name: 'userId' })];
    const synced = syncPathParams(existing, '/users/:userId/orders/:orderId');
    expect(synced.filter((p) => p.in === 'path').map((p) => p.name)).toEqual(['userId', 'orderId']);
  });

  it('rejects duplicate parameters', () => {
    const result = validateHttpContract({
      side: 'request',
      mode: 'http',
      params: [newParam('query', { name: 'page' }), newParam('query', { name: 'Page' })],
      body: emptyBody(),
    });
    expect(result.ok).toBe(false);
  });

  it('warns when the path and the contract disagree', () => {
    const result = validateHttpContract(
      {
        side: 'request',
        mode: 'http',
        params: [newParam('path', { name: 'slug' })],
        body: emptyBody(),
      },
      { path: '/users/:id' }
    );
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('id'), expect.stringContaining('slug')])
    );
  });
});

describe('httpContract bodies', () => {
  it('round-trips a JSON body with a schema', () => {
    const raw = serializeHttpContract({
      side: 'request',
      mode: 'http',
      params: [],
      body: {
        media: 'json',
        example: '{"q":true}',
        schema: '{"type":"object"}',
      },
    });
    expect(raw).toContain('@body application/json');
    expect(raw).toContain('@schema');

    const parsed = asRequest(raw);
    expect(parsed.body.media).toBe('json');
    expect(JSON.parse(parsed.body.example)).toEqual({ q: true });
    expect(JSON.parse(parsed.body.schema)).toEqual({ type: 'object' });
  });

  it('keeps non-JSON media types', () => {
    const parsed = asRequest('@body multipart/form-data\nfile=<binary>');
    expect(parsed.body.media).toBe('multipart');
  });

  it('rejects invalid JSON bodies and non-object schemas', () => {
    expect(
      validateHttpContract({
        side: 'request',
        mode: 'http',
        params: [],
        body: { media: 'json', example: '{nope', schema: '' },
      }).ok
    ).toBe(false);
    expect(
      validateHttpContract({
        side: 'request',
        mode: 'http',
        params: [],
        body: { media: 'json', example: '{}', schema: '[1,2]' },
      }).ok
    ).toBe(false);
  });
});

describe('httpContract responses', () => {
  it('round-trips several statuses', () => {
    const raw = serializeHttpContract({
      side: 'response',
      mode: 'http',
      responses: [
        newResponse(200, { body: { media: 'json', example: '{"id":1}', schema: '' } }),
        newResponse(404, { description: 'No such user' }),
      ],
    });
    expect(raw).toContain('@response 200 OK');
    expect(raw).toContain('@response 404 Not Found');
    expect(raw).toContain('@description No such user');

    const parsed = asResponse(raw);
    expect(parsed.responses.map((r) => r.status)).toEqual([200, 404]);
    expect(parsed.responses[1].description).toBe('No such user');
  });

  it('carries response headers', () => {
    const raw = serializeHttpContract({
      side: 'response',
      mode: 'http',
      responses: [
        newResponse(200, {
          headers: [newParam('header', { name: 'X-Total-Count', type: 'integer' })],
        }),
      ],
    });
    const parsed = asResponse(raw);
    expect(parsed.responses[0].headers.map((h) => h.name)).toEqual(['X-Total-Count']);
  });

  it('refuses the same status twice', () => {
    const result = validateHttpContract({
      side: 'response',
      mode: 'http',
      responses: [newResponse(200), newResponse(200)],
    });
    expect(result.ok).toBe(false);
  });

  it('warns about a body on 204 and about missing success responses', () => {
    const result = validateHttpContract({
      side: 'response',
      mode: 'http',
      responses: [
        newResponse(204, { body: { media: 'json', example: '{}', schema: '' } }),
        newResponse(500),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toContain('204');
  });
});

describe('httpContract legacy input', () => {
  it('reads the previous @query / @body tags', () => {
    const parsed = asRequest('@query\npage=1\nlimit=20\n\n@body application/json\n{"q":true}');
    expect(parsed.params.map((p) => [p.name, p.example])).toEqual([
      ['page', '1'],
      ['limit', '20'],
    ]);
    expect(parsed.body.media).toBe('json');
  });

  it('reads the previous @status tag as a response', () => {
    const parsed = asResponse('@status 201 Created\n\n@body application/json\n{"id":1}');
    expect(parsed.responses).toHaveLength(1);
    expect(parsed.responses[0].status).toBe(201);
    expect(parsed.responses[0].body.media).toBe('json');
  });

  it('accepts plain JSON as a request body', () => {
    const parsed = asRequest('{"email":"a@b.c"}');
    expect(parsed.body.media).toBe('json');
    expect(parsed.params).toEqual([]);
  });

  it('accepts plain JSON as a 200 JSON response', () => {
    const parsed = asResponse('{"ok":true}');
    expect(parsed.responses[0].status).toBe(200);
    expect(parsed.responses[0].body.media).toBe('json');
  });

  it('accepts a bare "204 No Content" line', () => {
    const parsed = asResponse('204 No Content');
    expect(parsed.responses[0].status).toBe(204);
    expect(parsed.responses[0].body.media).toBe('none');
  });

  it('keeps a hand-written reason phrase as the description', () => {
    const parsed = asResponse('404 User is gone');
    expect(parsed.responses[0].description).toBe('User is gone');
  });
});

describe('httpContract channels', () => {
  it('round-trips WebSocket messages', () => {
    const raw = serializeHttpContract({
      side: 'response',
      mode: 'channel',
      messages: [
        {
          id: 'm1',
          name: 'order.created',
          description: 'New order',
          body: { media: 'json', example: '{"id":1}', schema: '' },
        },
      ],
    });
    expect(raw).toContain('@message order.created');

    const parsed = parseHttpContract(raw, 'response', { channel: true });
    if (parsed.mode !== 'channel') throw new Error('expected channel');
    expect(parsed.messages[0].name).toBe('order.created');
    expect(parsed.messages[0].description).toBe('New order');
    expect(parsed.messages[0].body.media).toBe('json');
  });

  it('keeps the payload when an HTTP contract is reread as a channel', () => {
    const parsed = parseHttpContract('@status 200 OK\n\n@body application/json\n{"a":1}', 'response', {
      channel: true,
    });
    if (parsed.mode !== 'channel') throw new Error('expected channel');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].body.media).toBe('json');
  });
});

describe('httpContract preview', () => {
  it('summarises contracts for the field preview', () => {
    expect(summarizeHttpContract('', 'request', 'none')).toBe('none');
    expect(
      summarizeHttpContract(
        serializeHttpContract({
          side: 'response',
          mode: 'http',
          responses: [newResponse(201, { body: { media: 'json', example: '{}', schema: '' } })],
        }),
        'response',
        'none'
      )
    ).toBe('201 Created · JSON');
    expect(
      summarizeHttpContract(
        serializeHttpContract({
          side: 'response',
          mode: 'http',
          responses: [newResponse(200), newResponse(404), newResponse(500)],
        }),
        'response',
        'none'
      )
    ).toBe('200 · 404 · 500');
    expect(
      summarizeHttpContract(
        serializeHttpContract({
          side: 'request',
          mode: 'http',
          params: [newParam('query', { name: 'page' })],
          body: { media: 'json', example: '{}', schema: '' },
        }),
        'request',
        'none'
      )
    ).toBe('Query: page · JSON body');
  });
});

/*
 * The API normalises what agents send into this exact text
 * (server/src/modules/model/endpointContract.js). The editor is the other half
 * of that agreement: a contract written over MCP has to open here with its
 * media type already right, rather than as a plain-text paragraph.
 */
describe('contracts written by the API', () => {
  it('opens a JSON response as application/json', () => {
    const parsed = asResponse(
      '@response 200 OK\n@body application/json\n{\n  "temperature": 12.4\n}'
    );
    expect(parsed.responses).toHaveLength(1);
    expect(parsed.responses[0].status).toBe(200);
    expect(parsed.responses[0].body.media).toBe('json');
    expect(parsed.responses[0].body.example).toContain('"temperature"');
  });

  it('opens a JSON request body as application/json', () => {
    const parsed = asRequest('@body application/json\n{\n  "regionId": "eu-west"\n}');
    expect(parsed.body.media).toBe('json');
  });

  it('opens a schema as a schema, with the payload still typed', () => {
    const parsed = asRequest(
      '@body application/json\n@schema\n{\n  "type": "object",\n  "properties": {}\n}'
    );
    expect(parsed.body.media).toBe('json');
    expect(parsed.body.example).toBe('');
    expect(parsed.body.schema).toContain('"properties"');
  });

  it('opens a described failure as its own status', () => {
    const parsed = asResponse('@response 404 Not Found\n@description No region under that id');
    expect(parsed.responses[0].status).toBe(404);
    expect(parsed.responses[0].description).toBe('No region under that id');
    expect(parsed.responses[0].body.media).toBe('none');
  });
});
