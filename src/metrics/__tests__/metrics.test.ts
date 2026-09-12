/**
 * The browser half of the data policy.
 *
 * The server scrubs too, but by then a project id has already left the tab.
 * These lock the rule where it is cheapest to keep: at the call.
 */
import { METRIC_EVENTS, scrubProps, trackProductEvent } from '@/metrics';
import { resetAnonymousIdCacheForTests } from '@/metrics/anonymousId';

describe('metrics scrubber', () => {
  it('keeps enums, counts and flags', () => {
    const { props, dropped } = scrubProps({
      level: 'container',
      steps: 7,
      firstTime: true,
      format: 'svg',
    });
    expect(props).toEqual({ level: 'container', steps: 7, firstTime: true, format: 'svg' });
    expect(dropped).toEqual([]);
  });

  it('drops project ids, addresses and prose', () => {
    const { props, dropped } = scrubProps({
      level: 'system',
      projectId: '3f1c0a2e-9b77-4a1e-8f2d-6c0d1e2b3a44',
      owner: 'ada@example.com',
      elementName: 'Billing API — the one nobody may touch, ever',
    });
    expect(props).toEqual({ level: 'system' });
    expect(dropped.sort()).toEqual(['elementName', 'owner', 'projectId']);
  });

  it('drops values that are not finite numbers', () => {
    const { props, dropped } = scrubProps({ steps: Number.NaN, level: 'code' });
    expect(props).toEqual({ level: 'code' });
    expect(dropped).toEqual(['steps']);
  });

  it('ignores empty and absent values without calling them errors', () => {
    const { props, dropped } = scrubProps({ level: undefined, kind: null, area: '' });
    expect(props).toEqual({});
    expect(dropped).toEqual(['area']);
  });
});

describe('trackProductEvent', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetAnonymousIdCacheForTests();
    window.localStorage.clear();
    global.fetch = jest.fn(() => Promise.resolve(new Response('{}', { status: 202 })));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the event to our own API, never to metrics directly', async () => {
    trackProductEvent('catalog.opened');
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/metrics/event');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body);
    expect(body.eventName).toBe('catalog.opened');
    expect(body.metadata).toEqual([]);
    expect(body.anonymousId).toMatch(
      /^anon_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('sends scrubbed props as a single metadata entry', async () => {
    trackProductEvent('editor.element_added', {
      level: 'container',
      kind: 'endpoint',
      projectId: '3f1c0a2e-9b77-4a1e-8f2d-6c0d1e2b3a44',
    });
    await Promise.resolve();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body).metadata).toEqual([{ level: 'container', kind: 'endpoint' }]);
  });
});

describe('the dictionary', () => {
  it('has no duplicates and is all `area.action`', () => {
    expect(new Set(METRIC_EVENTS).size).toBe(METRIC_EVENTS.length);
    for (const name of METRIC_EVENTS) {
      expect(name).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });
});
