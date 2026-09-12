import { parsePlantUmlSequence } from './parser';
import { serializePlantUmlSequence } from './serializer';

describe('parsePlantUmlSequence', () => {
  it('parses participants and messages', () => {
    const source = `@startuml
title Login flow
actor User
participant "Web App" as Web
control "Auth API" as Auth
database PostgreSQL as DB

User -> Web: Open login page
Web ->> Auth: POST /login
Auth -> DB: Find user
DB --> Auth: User row
Auth -->> Web: JWT
Web --> User: Success
@enduml
`;
    const result = parsePlantUmlSequence(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.title).toBe('Login flow');
    expect(result.model.participants.map((p) => p.id)).toEqual(['User', 'Web', 'Auth', 'DB']);
    expect(result.model.participants[1]?.kind).toBe('participant');
    expect(result.model.participants[1]?.label).toBe('Web App');
    expect(result.model.items).toHaveLength(6);
    expect(result.model.items[0]).toMatchObject({
      type: 'message',
      from: 'User',
      to: 'Web',
      text: 'Open login page',
      arrow: '->',
    });
  });

  it('parses alt and loop and round-trips', () => {
    const source = `@startuml
actor User
participant Web
alt success
  User -> Web: ok
else failure
  User -> Web: fail
end
loop 3 times
  User -> Web: retry
end
@enduml
`;
    const result = parsePlantUmlSequence(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.items).toHaveLength(2);
    expect(result.model.items[0]).toMatchObject({
      type: 'fragment',
      kind: 'alt',
      label: 'success',
    });
    const alt = result.model.items[0];
    if (alt?.type !== 'fragment') return;
    expect(alt.branches).toHaveLength(2);
    expect(alt.branches[0]?.condition).toBe('success');
    expect(alt.branches[1]?.condition).toBe('failure');
    expect(alt.branches[0]?.items).toHaveLength(1);
    expect(alt.branches[1]?.items).toHaveLength(1);

    expect(result.model.items[1]).toMatchObject({
      type: 'fragment',
      kind: 'loop',
      label: '3 times',
    });

    const out = serializePlantUmlSequence(result.model);
    expect(out).toContain('alt success');
    expect(out).toContain('else failure');
    expect(out).toContain('loop 3 times');
    const again = parsePlantUmlSequence(out);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.model.items[0]).toMatchObject({ type: 'fragment', kind: 'alt' });
    expect(again.model.items[1]).toMatchObject({ type: 'fragment', kind: 'loop' });
  });

  it('parses note, return, divider, activate and delay', () => {
    const source = `@startuml
actor User
participant Web
User -> Web++: request
activate Web
note over Web: handling
== Auth ==
Web --> User: ok
return done
deactivate Web
... wait ...
@enduml
`;
    const result = parsePlantUmlSequence(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const types = result.model.items.map((i) => i.type);
    expect(types).toContain('message');
    expect(types).toContain('note');
    expect(types).toContain('divider');
    expect(types).toContain('activation');
    expect(types).toContain('delay');

    const first = result.model.items.find((i) => i.type === 'message');
    expect(first).toMatchObject({ activate: 'target', text: 'request' });

    const note = result.model.items.find((i) => i.type === 'note');
    expect(note).toMatchObject({
      type: 'note',
      position: 'over',
      text: 'handling',
      participantIds: ['Web'],
    });

    const div = result.model.items.find((i) => i.type === 'divider');
    expect(div).toMatchObject({ type: 'divider', text: 'Auth' });

    const ret = result.model.items.find((i) => i.type === 'message' && i.return);
    expect(ret).toMatchObject({
      type: 'message',
      return: true,
      from: 'User',
      to: 'Web',
      text: 'done',
      arrow: '-->',
    });

    const out = serializePlantUmlSequence(result.model);
    expect(out).toContain('note over Web:');
    expect(out).toContain('== Auth ==');
    expect(out).toContain('return done');
    expect(out).toContain('activate Web');
    const again = parsePlantUmlSequence(out);
    expect(again.ok).toBe(true);
  });

  it('errors on unknown participants in strict mode', () => {
    const source = `@startuml
actor User
User -> Ghost: ping
@enduml
`;
    const result = parsePlantUmlSequence(source, { strictParticipants: true });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'unknown_participant')).toBe(true);
  });

  it('creates implicit participants when not strict', () => {
    const source = `@startuml
User -> Web: hi
@enduml
`;
    const result = parsePlantUmlSequence(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.participants.map((p) => p.id).sort()).toEqual(['User', 'Web']);
    expect(result.diagnostics.some((d) => d.code === 'implicit_participant')).toBe(true);
  });

  it('parses expand/group and round-trips', () => {
    const source = `@startuml
actor User
participant Web
User -> Web: open
expand Login
User -> Web: submit
Web --> User: ok
end
User -> Web: done
@enduml
`;
    const result = parsePlantUmlSequence(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.items).toHaveLength(3);
    expect(result.model.items[1]).toMatchObject({
      type: 'fragment',
      kind: 'group',
      label: 'Login',
    });
    const frag = result.model.items[1];
    if (frag?.type !== 'fragment') return;
    expect(frag.branches[0]?.items).toHaveLength(2);

    const out = serializePlantUmlSequence(result.model);
    expect(out).toContain('group Login');
    expect(out).toContain('end');
    const again = parsePlantUmlSequence(out);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.model.items[1]).toMatchObject({ type: 'fragment', kind: 'group', label: 'Login' });
  });
});

describe('serializePlantUmlSequence', () => {
  it('round-trips a basic diagram', () => {
    const source = `@startuml
title Login
actor User
participant "Web App" as Web
User -> Web: Open
Web --> User: Ok
@enduml
`;
    const parsed = parsePlantUmlSequence(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const out = serializePlantUmlSequence(parsed.model);
    const again = parsePlantUmlSequence(out);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.model.title).toBe(parsed.model.title);
    expect(again.model.participants.map((p) => ({ id: p.id, label: p.label, kind: p.kind }))).toEqual(
      parsed.model.participants.map((p) => ({ id: p.id, label: p.label, kind: p.kind }))
    );
    expect(again.model.items.map((i) => (i.type === 'message' ? { from: i.from, to: i.to, text: i.text, arrow: i.arrow } : i))).toEqual(
      parsed.model.items.map((i) => (i.type === 'message' ? { from: i.from, to: i.to, text: i.text, arrow: i.arrow } : i))
    );
  });

  it('is deterministic', () => {
    const source = `@startuml
actor A
participant B
A -> B: x
@enduml
`;
    const parsed = parsePlantUmlSequence(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(serializePlantUmlSequence(parsed.model)).toBe(serializePlantUmlSequence(parsed.model));
  });
});
