/**
 * Whether a scroll container has come close enough to its end to ask for the
 * next page. Lists that page as you reach the bottom share this rather than
 * each spelling out the same subtraction.
 */
export function isNearBottom(
  el: { scrollHeight: number; scrollTop: number; clientHeight: number },
  thresholdPx: number
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}
