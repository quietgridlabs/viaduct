import { useEffect, useRef, useState } from 'react';

/**
 * A panel's own copy of the thing it edits, re-read when that thing actually
 * changes — not every time its props are rebuilt.
 *
 * Each element panel used to reset its state from an effect whose dependency
 * list held freshly-made arrays (tags, links, columns), so any render of the
 * workspace above it threw away whatever was half-typed. The name field is
 * where it showed: while it is being edited it keeps its own draft and does not
 * re-read the value it was handed, so the field still said "Payments" while the
 * state behind it had gone back to "New System" — and that is what Save sent.
 *
 * The connection panel never had the bug because it resets on the connection
 * object itself, which keeps its identity between renders. This is that rule
 * for values that have to be rebuilt: compare what they say, not who made them.
 *
 * `entityKey` is the element id (or any stable identity). Without it, two
 * different elements with the same field snapshot — both empty descriptions,
 * same tech — look identical to the signature and the panel keeps the previous
 * draft, including a description just accepted from Suggest.
 */
export function usePanelValues<T>(open: boolean, initial: T, entityKey?: string) {
  const [values, setValues] = useState<T>(initial);
  const signature = `${entityKey ?? ''}:${JSON.stringify(initial)}`;
  const applied = useRef<string | null>(null);

  useEffect(() => {
    /* A closed panel reopens on something else soon enough: forget what was
       applied so the next open re-reads it even if it looks identical. */
    if (!open) {
      applied.current = null;
      return;
    }
    if (applied.current === signature) return;
    applied.current = signature;
    setValues(initial);
    /* `signature` stands in for `initial`, which is a new object every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signature]);

  return [values, setValues] as const;
}

export default usePanelValues;
