import {
  buildNodeRef,
  canUseShortRef,
  listFigmaSystems,
  parseFigmaUrl,
  readNodeValue,
  resolveNodeHref,
  splitNodeRef,
  systemFileKey,
} from '../designNodeRef';

const FILE = 'https://www.figma.com/design/ih5yoNnPMlBJ9VvlJqMGJD/Tes-UI-Form';

const model = {
  designSystems: [
    { id: 'ds1', name: 'platform-web', source: { kind: 'figma' as const, ref: FILE } },
    { id: 'ds2', name: 'admin-ant', source: { kind: 'tokens-file' as const, ref: 'tokens.json' } },
    { id: 'ds3', name: 'handmade' },
    /* A perfectly ordinary name that the short form cannot say. */
    {
      id: 'ds4',
      name: 'Figma redesign weather',
      source: { kind: 'figma' as const, ref: 'https://www.figma.com/design/WEATHERKEY/Weather' },
    },
  ],
};

describe('naming a design node', () => {
  it('reads a link for its file and node, in either spelling of the id', () => {
    expect(parseFigmaUrl(`${FILE}?node-id=7-25&t=abc-4`)).toEqual({
      fileKey: 'ih5yoNnPMlBJ9VvlJqMGJD',
      nodeId: '7:25',
    });
    expect(parseFigmaUrl(FILE)).toEqual({ fileKey: 'ih5yoNnPMlBJ9VvlJqMGJD', nodeId: null });
    expect(parseFigmaUrl('https://storybook.example.com/?path=/story/card')).toBeNull();
    expect(parseFigmaUrl('platform-web#7:25')).toBeNull();
  });

  it('only offers systems that actually name a Figma file', () => {
    expect(listFigmaSystems(model).map((system) => system.name)).toEqual([
      'platform-web',
      'Figma redesign weather',
    ]);
    expect(systemFileKey(model.designSystems[1])).toBeNull();
    expect(systemFileKey(model.designSystems[2])).toBeNull();
  });

  /* The point of the whole exercise: a pasted link whose file this project
     already records collapses into the short form. */
  it('collapses a link into system and node when the file is recorded', () => {
    expect(readNodeValue(model, `${FILE}?node-id=7-25`)).toEqual({
      system: 'platform-web',
      nodeId: '7:25',
      link: '',
    });
  });

  it('leaves a link alone when nothing here owns that file', () => {
    const other = 'https://www.figma.com/design/OTHERKEY123/Someone-Else?node-id=1-2';
    expect(readNodeValue(model, other)).toEqual({ system: '', nodeId: '', link: other });
  });

  /* A file with no node named cannot become `system#`, because there is no
     node to put after the hash. */
  it('keeps a bare file link as a link', () => {
    expect(readNodeValue(model, FILE)).toEqual({ system: '', nodeId: '', link: FILE });
  });

  it('reads the short form back as it was written', () => {
    expect(readNodeValue(model, 'platform-web#7:25')).toEqual({
      system: 'platform-web',
      nodeId: '7:25',
      link: '',
    });
    expect(splitNodeRef('platform-web#7:25')).toEqual({ system: 'platform-web', nodeId: '7:25' });
    /* Written with the URL's dash, read back as the node's one name. */
    expect(splitNodeRef('platform-web#7-25')).toEqual({ system: 'platform-web', nodeId: '7:25' });
    expect(splitNodeRef('not a ref')).toBeNull();
  });

  it('builds nothing from half an answer', () => {
    expect(buildNodeRef(model, 'platform-web', '7-25')).toBe('platform-web#7:25');
    expect(buildNodeRef(model, 'platform-web', '')).toBe('');
    expect(buildNodeRef(model, '', '7:25')).toBe('');
  });

  /*
   * The bug this pair exists for. `@design` reads the node as the first word
   * after the tag, so a name with a space in it has no short form — and
   * writing `Figma redesign weather#7:25` anyway produced a string that parsed
   * back as neither a reference nor a link: the field refilled itself with the
   * system name, refused the node id, and dropped the picker to "paste a link".
   */
  it('knows which names the short form can say', () => {
    expect(canUseShortRef('platform-web')).toBe(true);
    expect(canUseShortRef('admin.ant_2')).toBe(true);
    expect(canUseShortRef('Figma redesign weather')).toBe(false);
    expect(canUseShortRef('')).toBe(false);
  });

  it('falls back to the file link for a name with a space in it', () => {
    const built = buildNodeRef(model, 'Figma redesign weather', '7-25');
    expect(built).toBe('https://www.figma.com/design/WEATHERKEY/Weather?node-id=7-25');
    /* And it reads straight back as that system, so the picker stays put. */
    expect(readNodeValue(model, built)).toEqual({
      system: 'Figma redesign weather',
      nodeId: '7:25',
      link: '',
    });
    expect(resolveNodeHref(model, built)).toBe(built);
  });

  it('refuses to write a reference it could not read back', () => {
    /* A spaced name whose system this model does not hold has neither a short
       form nor a file: an empty value beats an unreadable one. */
    expect(buildNodeRef(model, 'Some Other System', '7:25')).toBe('');
  });

  describe('turning it back into a link', () => {
    it('resolves the short form through the system that owns the file', () => {
      expect(resolveNodeHref(model, 'platform-web#7:25')).toBe(`${FILE}?node-id=7-25`);
    });

    it('passes a link through untouched', () => {
      expect(resolveNodeHref(model, `${FILE}?node-id=7-25`)).toBe(`${FILE}?node-id=7-25`);
    });

    /* A name is not a link until something says where it points; opening one
       anyway would be a 404 in a new tab. */
    it('refuses a system this project does not hold, or holds without a file', () => {
      expect(resolveNodeHref(model, 'nowhere#7:25')).toBeNull();
      expect(resolveNodeHref(model, 'admin-ant#7:25')).toBeNull();
      expect(resolveNodeHref(model, 'handmade#7:25')).toBeNull();
      expect(resolveNodeHref(model, '')).toBeNull();
    });
  });
});
