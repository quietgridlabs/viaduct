/** A tilt you can actually notice, on one side or the other. */
export function rollQuackTilt() {
  const magnitude = 4 + Math.random() * 8;
  return Math.random() < 0.5 ? -magnitude : magnitude;
}
