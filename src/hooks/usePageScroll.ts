import { useEffect } from 'react';

const FLAG = 'data-page-scroll';

/* How many public pages are currently mounted. The flag belongs to them, so
   anything else on screen — the editor above all — must not inherit it. */
let claims = 0;

/**
 * Lets the document scroll natively while a public page is mounted.
 * The editor shell relies on a locked 100% viewport, so this is opt-in.
 */
export function usePageScroll(): void {
  useEffect(() => {
    claims += 1;
    document.documentElement.setAttribute(FLAG, 'true');
    return () => {
      claims -= 1;
      if (claims === 0) document.documentElement.removeAttribute(FLAG);
    };
  }, []);
}

/**
 * Drops the flag when no public page claims it.
 *
 * Prerendered HTML is a snapshot of the landing page, and every unknown route
 * falls back to it — so the editor can be served a document that already says
 * "let the page scroll". That un-locks the editor's full-height layout and
 * collapses the whole shell to its footer.
 */
export function syncPageScroll(): void {
  if (claims === 0) document.documentElement.removeAttribute(FLAG);
}
