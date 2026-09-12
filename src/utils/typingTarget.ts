/*
 * Monaco 0.56+ types through the EditContext API: the focused element is a
 * plain <div class="native-edit-context">, not an input and not
 * contentEditable. Every "don't hijack keys while the user is typing" guard
 * written as `tagName === 'INPUT' || 'TEXTAREA' || isContentEditable` silently
 * fails there, and global shortcuts start eating characters out of the editor.
 */

/** True when the event target is somewhere a person is typing text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;

  /* Monaco: the EditContext host, and anything inside the editor shell. */
  if (target.classList.contains('native-edit-context')) return true;
  return Boolean(target.closest('.monaco-editor'));
}
