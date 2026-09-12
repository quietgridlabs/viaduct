/** DOMRect-like anchor for Chakra/Zag Menu positioning at a screen point. */
export function pointAnchorRect(left: number, top: number) {
  return {
    width: 0,
    height: 0,
    x: left,
    y: top,
    top,
    left,
    right: left,
    bottom: top,
  };
}
