/**
 * What a node card on the board actually depends on.
 *
 * The cards read `data` and `selected`; React Flow hands them its interaction
 * flags as well — `draggable`, `selectable`, `isConnectable`, `dragging`,
 * `zIndex`. Those flip together the moment a manager panel opens over the
 * board, and under the default shallow compare that re-rendered every card on
 * screen for a change none of them look at: opening the projects manager over
 * a 27-node level blocked the main thread for a quarter of a second, all of it
 * spent redrawing a board nobody could see.
 *
 * Node identity is already held steady upstream by `reuseRfNodes`, so `data`
 * changes exactly when the card's picture does.
 */
export function sameNodeCard<P extends { data: unknown; selected?: boolean }>(
  prev: Readonly<P>,
  next: Readonly<P>
): boolean {
  return prev.data === next.data && prev.selected === next.selected;
}
