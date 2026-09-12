import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { groupByOwner, resolveOwnerGroup } from '../ownerGrouping';

const model = {
  systems: [
    { id: 'sys-b', name: 'Billing' },
    { id: 'sys-a', name: 'Alpha Seller' },
  ],
  containers: [
    { id: 'gw', name: 'API Gateway', systemId: 'sys-a' },
    { id: 'led', name: 'Ledger', systemId: 'sys-b' },
  ],
  components: [{ id: 'charge', name: 'Charge handler', containerId: 'led', systemId: 'sys-b' }],
  codeElements: [
    { id: 'fn', name: 'chargeCard', componentId: 'charge', containerId: 'led', systemId: 'sys-b' },
  ],
} as unknown as FlatC4Model;

describe('resolveOwnerGroup', () => {
  it('reads a system as a system with no service', () => {
    expect(resolveOwnerGroup(model, { ownerType: 'system', ownerId: 'sys-a' })).toEqual({
      system: 'Alpha Seller',
      service: null,
    });
  });

  it('reads a container as its own service', () => {
    expect(resolveOwnerGroup(model, { ownerType: 'container', ownerId: 'gw' })).toEqual({
      system: 'Alpha Seller',
      service: 'API Gateway',
    });
  });

  it('lifts a component and a code element to the service they sit in', () => {
    const fromComponent = resolveOwnerGroup(model, { ownerType: 'component', ownerId: 'charge' });
    const fromCode = resolveOwnerGroup(model, { ownerType: 'code', ownerId: 'fn' });
    expect(fromComponent).toEqual({ system: 'Billing', service: 'Ledger' });
    expect(fromCode).toEqual(fromComponent);
  });

  it('answers null rather than guessing when the owner is gone', () => {
    expect(resolveOwnerGroup(model, { ownerType: 'container', ownerId: 'deleted' })).toEqual({
      system: null,
      service: null,
    });
  });
});

type Item = { id: string; ownerType: 'system' | 'container'; ownerId: string; draft?: boolean };

const byId = (list: Item[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));

describe('groupByOwner', () => {
  const items: Item[] = [
    { id: 'c', ownerType: 'container', ownerId: 'led' },
    { id: 'a', ownerType: 'container', ownerId: 'gw' },
    { id: 'b', ownerType: 'system', ownerId: 'sys-a' },
    { id: 'd', ownerType: 'container', ownerId: 'gw' },
  ];
  const resolve = (item: Item) => resolveOwnerGroup(model, item);

  it('orders buckets by system, then by service', () => {
    const { buckets } = groupByOwner(items, resolve, byId);
    expect(buckets.map((b) => [b.system, b.service])).toEqual([
      // Alpha Seller before Billing; within it the system itself before its services.
      ['Alpha Seller', null],
      ['Alpha Seller', 'API Gateway'],
      ['Billing', 'Ledger'],
    ]);
  });

  it('sorts inside a bucket with the list own comparator', () => {
    const { buckets } = groupByOwner(items, resolve, byId);
    const gateway = buckets.find((b) => b.service === 'API Gateway');
    expect(gateway?.items.map((i) => i.id)).toEqual(['a', 'd']);
  });

  it('keeps a draft out of the buckets entirely', () => {
    const withDraft = [...items, { id: 'z', ownerType: 'container' as const, ownerId: '', draft: true }];
    const { pinned, buckets } = groupByOwner(withDraft, resolve, byId, (i) => Boolean(i.draft));
    expect(pinned.map((i) => i.id)).toEqual(['z']);
    expect(buckets.flatMap((b) => b.items).map((i) => i.id)).not.toContain('z');
  });

  it('puts an orphan last rather than first', () => {
    const orphaned = [...items, { id: 'x', ownerType: 'container' as const, ownerId: 'gone' }];
    const { buckets } = groupByOwner(orphaned, resolve, byId);
    expect(buckets[buckets.length - 1].system).toBeNull();
  });
});
