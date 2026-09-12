import {
  getElementLinks,
  guessLinkKind,
  isValidLinkUrl,
  labelFromUrl,
  sanitizeLinks,
} from '@/types/c4Extensions';
import { linkKindOf } from '@components/common/LinkKindIcon';

describe('getElementLinks', () => {
  it('reads the list when there is one', () => {
    expect(
      getElementLinks({ links: [{ url: 'https://a.test/runbook', label: 'Runbook' }] })
    ).toEqual([{ url: 'https://a.test/runbook', label: 'Runbook' }]);
  });

  /* The whole point of the migration: an element saved before links existed
     carries a bare `url`, and it has to keep its link. */
  it('keeps a link saved before labels existed, named after its host', () => {
    expect(getElementLinks({ url: 'https://gitlab.test/team/repo' })).toEqual([
      { url: 'https://gitlab.test/team/repo', label: 'gitlab.test' },
    ]);
  });

  it('prefers the list once one is there', () => {
    const links = getElementLinks({
      url: 'https://old.test',
      links: [{ url: 'https://new.test', label: 'New' }],
    });
    expect(links).toEqual([{ url: 'https://new.test', label: 'New' }]);
  });

  it('has nothing to say about an element with neither', () => {
    expect(getElementLinks({})).toEqual([]);
    expect(getElementLinks({ url: '   ' })).toEqual([]);
    expect(getElementLinks(null)).toEqual([]);
  });
});

describe('sanitizeLinks', () => {
  it('drops entries with no address and names the ones with no label', () => {
    expect(
      sanitizeLinks([
        { url: '  ', label: 'nowhere' },
        { url: 'https://dash.test/x', label: '  ' },
        { url: 'https://ok.test', label: 'Fine' },
      ])
    ).toEqual([
      { url: 'https://dash.test/x', label: 'dash.test' },
      { url: 'https://ok.test', label: 'Fine' },
    ]);
  });

  it('answers with a list for anything that is not one', () => {
    expect(sanitizeLinks(undefined)).toEqual([]);
    expect(sanitizeLinks('https://a.test')).toEqual([]);
  });
});

describe('labelFromUrl', () => {
  it('uses the host, and falls back to the text for something unparseable', () => {
    expect(labelFromUrl('https://runbooks.test/a/b')).toBe('runbooks.test');
    expect(labelFromUrl('not a url')).toBe('not a url');
  });
});

describe('isValidLinkUrl', () => {
  it('accepts an address a browser could follow', () => {
    expect(isValidLinkUrl('https://runbooks.test/orders')).toBe(true);
    expect(isValidLinkUrl('http://intranet/wiki')).toBe(true);
    expect(isValidLinkUrl('mailto:team@corp.test')).toBe(true);
  });

  it('refuses what would go nowhere', () => {
    expect(isValidLinkUrl('runbooks.test')).toBe(false);
    expect(isValidLinkUrl('https://')).toBe(false);
    expect(isValidLinkUrl('  ')).toBe(false);
  });

  /* The form refuses these; the sanitiser keeps them, because it also runs
     over what is already stored and over imports. */
  it('is not what the sanitiser enforces', () => {
    expect(sanitizeLinks([{ url: 'not-a-url', label: 'Old' }])).toEqual([
      { url: 'not-a-url', label: 'Old' },
    ]);
  });
});

describe('limits', () => {
  it('keeps at most five links', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      url: `https://a${i}.test`,
      label: `L${i}`,
    }));
    expect(sanitizeLinks(many)).toHaveLength(5);
  });

  it('cuts a label at thirty characters', () => {
    const [link] = sanitizeLinks([{ url: 'https://a.test', label: 'x'.repeat(80) }]);
    expect(link.label).toHaveLength(30);
  });
});

describe('what a link is for', () => {
  it('keeps a kind it recognises and drops one it does not', () => {
    expect(
      sanitizeLinks([
        { url: 'https://gitlab.corp/team/api', label: 'Code', kind: 'git' },
        { url: 'https://grafana.corp/d/1', label: 'Dash', kind: 'nonsense' },
      ])
    ).toEqual([
      { url: 'https://gitlab.corp/team/api', label: 'Code', kind: 'git' },
      { url: 'https://grafana.corp/d/1', label: 'Dash' },
    ]);
  });

  /* A link saved before kinds existed still gets a mark: the host usually
     says what it is. Only a guess, and the person's pick always wins. */
  it('guesses the kind from the host, and lets a chosen one win', () => {
    expect(guessLinkKind('https://gitlab.corp/team/api')).toBe('git');
    expect(guessLinkKind('https://github.com/acme/web')).toBe('git');
    expect(guessLinkKind('https://forge.internal/team/api/-/tree/main')).toBe('git');
    expect(guessLinkKind('https://grafana.corp/d/api')).toBe('observability');
    expect(guessLinkKind('https://acme.sentry.io/issues')).toBe('observability');
    expect(guessLinkKind('https://acme.atlassian.net/wiki/spaces/API')).toBe('docs');
    expect(guessLinkKind('https://docs.acme.com/api')).toBe('docs');
    expect(guessLinkKind('https://acme.com/pricing')).toBe('web');
    expect(guessLinkKind('')).toBe('web');
    expect(linkKindOf({ url: 'https://gitlab.corp/x', kind: 'docs' })).toBe('docs');
    expect(linkKindOf({ url: 'https://gitlab.corp/x' })).toBe('git');
  });
});
