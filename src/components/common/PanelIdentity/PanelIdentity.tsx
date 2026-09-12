import type { BaseBlock } from '@archivisio/c4-modelizer-sdk';
import TechnologyIcon from '@components/TechnologyIcon';
import { getTechnologyById } from '@data/technologies';

/**
 * What an element's edit panel says it is: the technology's mark, the element's
 * name, and what it is built with spelled out underneath.
 *
 * The head used to read "Edit container", which is the one thing a person
 * opening a container's panel already knows. The name is what they need to see,
 * and it is also what tells them they opened the card they meant to.
 */
export function panelIdentity(
  name: string,
  opts: {
    technology?: string;
    meta?: string;
    onNameChange?: (next: string) => void;
    /** Shown in the empty name field. Names the thing, not the act of editing
     *  it: "Connection title" tells you what to type, "Edit connection" is the
     *  panel repeating its own job back at you. */
    placeholder?: string;
  }
): {
  icon?: React.ReactNode;
  name: string;
  meta?: string;
  onNameChange?: (next: string) => void;
  placeholder?: string;
} {
  const technology = opts.technology?.trim();
  return {
    icon: technology ? (
      <TechnologyIcon
        item={{ technology } as BaseBlock}
        size={18}
        /* The name is right beside it, and the panel head is not a place to
           make someone wait for a tooltip. */
        showTooltip={false}
      />
    ) : undefined,
    /* The raw value, empty or not. Folding a fallback in here put "Edit
       connection" into the field as its content rather than behind it, which
       is a panel telling you the thing is called something it is not — the
       panel's own title is the placeholder instead. */
    name,
    meta: opts.meta ?? (technology ? getTechnologyById(technology)?.name : undefined),
    onNameChange: opts.onNameChange,
    placeholder: opts.placeholder,
  };
}
