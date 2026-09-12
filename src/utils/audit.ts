import type { User } from '@shared/api';
import type { AuditExtras, PersonRef } from '@/types/c4Extensions';

export function personRefFromUser(user: User | null | undefined): PersonRef | null {
  if (!user?.username) return null;
  return {
    name: (user.name && user.name.trim()) || user.username,
    username: user.username,
  };
}

export function stampAuditCreate(user: User | null | undefined): AuditExtras {
  const person = personRefFromUser(user);
  const now = new Date().toISOString();
  if (!person) {
    return { createdAt: now, updatedAt: now };
  }
  return {
    createdBy: person,
    updatedBy: person,
    createdAt: now,
    updatedAt: now,
  };
}

/** Keep created* intact; refresh updatedBy / updatedAt. */
export function stampAuditUpdate(
  existing: AuditExtras | null | undefined,
  user: User | null | undefined
): AuditExtras {
  const person = personRefFromUser(user);
  const now = new Date().toISOString();
  return {
    createdBy: existing?.createdBy,
    createdAt: existing?.createdAt || now,
    updatedBy: person || existing?.updatedBy,
    updatedAt: now,
  };
}

export function formatPersonRef(person: PersonRef | null | undefined): string | null {
  if (!person?.username) return null;
  const name = person.name?.trim() || person.username;
  return `${name} (@${person.username})`;
}

export function formatAuditWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}
