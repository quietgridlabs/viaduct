let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getProjectsOverlay() {
  return open;
}

export function openProjectsOverlay() {
  open = true;
  emit();
}

export function closeProjectsOverlay() {
  open = false;
  emit();
}

export function subscribeProjectsOverlay(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
