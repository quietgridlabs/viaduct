import { removeOperationFromDocument } from '../serviceContract';

const doc = () =>
  JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Payments', version: '1.0.0' },
    paths: {
      '/charges': { get: { summary: 'List' }, post: { summary: 'Create' } },
      '/refunds': { post: { summary: 'Refund' } },
    },
    'x-channels': { '/events#send': { protocol: 'WS' }, '/events#receive': { protocol: 'WS' } },
    'x-grpc': { 'Pay/Charge': { streaming: 'unary' } },
  });

const parse = (json: string | undefined) => JSON.parse(json || '{}');

describe('removeOperationFromDocument', () => {
  it('takes one verb and leaves the others on that path', () => {
    const next = parse(removeOperationFromDocument(doc(), { path: '/charges', method: 'GET' }));
    expect(next.paths['/charges']).toEqual({ post: { summary: 'Create' } });
    expect(next.paths['/refunds']).toBeDefined();
  });

  it('drops the path once its last verb goes', () => {
    const next = parse(removeOperationFromDocument(doc(), { path: '/refunds', method: 'POST' }));
    expect(next.paths['/refunds']).toBeUndefined();
    expect(next.paths['/charges']).toBeDefined();
  });

  it('cuts a channel by its viewer key, not by path alone', () => {
    const next = parse(
      removeOperationFromDocument(doc(), {
        key: 'channel:/events#send',
        path: '/events',
        method: 'WS',
      })
    );
    expect(Object.keys(next['x-channels'])).toEqual(['/events#receive']);
  });

  it('drops the channel bag when the last channel goes', () => {
    let json: string | undefined = doc();
    for (const dir of ['send', 'receive']) {
      json = removeOperationFromDocument(json, {
        key: `channel:/events#${dir}`,
        path: '/events',
        method: 'WS',
      });
    }
    expect(parse(json)['x-channels']).toBeUndefined();
  });

  it('cuts a gRPC method and drops the bag with it', () => {
    const next = parse(
      removeOperationFromDocument(doc(), {
        key: 'grpc:Pay/Charge',
        path: 'Pay/Charge',
        method: 'GRPC',
      })
    );
    expect(next['x-grpc']).toBeUndefined();
  });

  it('says nothing changed rather than rewriting the file', () => {
    expect(removeOperationFromDocument(doc(), { path: '/nope', method: 'GET' })).toBeUndefined();
    expect(removeOperationFromDocument(doc(), { path: '/charges', method: 'DELETE' })).toBeUndefined();
    expect(removeOperationFromDocument('', { path: '/charges', method: 'GET' })).toBeUndefined();
    // Unparseable is left alone rather than replaced with something valid.
    expect(removeOperationFromDocument('{oops', { path: '/charges', method: 'GET' })).toBeUndefined();
  });

  it('leaves everything the operation was not part of', () => {
    const next = parse(removeOperationFromDocument(doc(), { path: '/charges', method: 'GET' }));
    expect(next.info).toEqual({ title: 'Payments', version: '1.0.0' });
    expect(next['x-grpc']).toBeDefined();
    expect(Object.keys(next['x-channels'])).toHaveLength(2);
  });
});
