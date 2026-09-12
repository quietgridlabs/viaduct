/*
 * The project name is shown in two places that load it independently: the nav
 * pill (from the page that opened the project) and the project navigator (from
 * the projects list). Renaming in one left the other showing a stale name until
 * a reload, so both announce their rename here and both listen.
 */

type Listener = (projectId: string, name: string) => void;

const listeners = new Set<Listener>();

export function subscribeProjectRename(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitProjectRenamed(projectId: string, name: string): void {
  listeners.forEach((listener) => {
    try {
      listener(projectId, name);
    } catch {
      /* one bad listener must not stop the others */
    }
  });
}
