/**
 * Three flags, drawn here rather than fetched.
 *
 * They used to come from flagcdn.com, which meant every visitor who opened the
 * donation dialog handed their IP address to a service with nothing to do with
 * this product — the only third-party request on the site, and one the privacy
 * policy had to account for. svgl, where the technology icons come from, is a
 * brand-logo library and has no flags, so these are geometry: a few hundred
 * bytes of markup each, in the bundle, no request at all.
 *
 * The stars are generated rather than typed. Twelve on the European flag and
 * fifty on the American one is not something to transcribe by hand, and the
 * construction is exact: on the EU flag the circle's radius is a third of the
 * hoist and each star spans a ninth of it, which is what the specification
 * says.
 */

/** A five-pointed star as a polygon, point upwards, centred on (cx, cy). */
function star(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.3819660113; // 1 / φ² — a true pentagram, not a guess
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`
    );
  }
  return points.join(' ');
}

type FlagProps = { width?: number; height?: number };

const frame = { display: 'block', borderRadius: 4 } as const;

const EU_STARS = Array.from({ length: 12 }, (_, i) => {
  const angle = (Math.PI / 6) * i - Math.PI / 2;
  return star(405 + 180 * Math.cos(angle), 270 + 180 * Math.sin(angle), 30);
});

/* Nine rows alternating six and five stars, the way the union is laid out. */
const US_STARS: string[] = [];
for (let row = 0; row < 9; row += 1) {
  const count = row % 2 === 0 ? 6 : 5;
  for (let col = 0; col < count; col += 1) {
    const x = row % 2 === 0 ? 41 + col * 82 : 82 + col * 82;
    US_STARS.push(star(x, 35 + row * 35, 15));
  }
}

export function FlagEu({ width = 36, height = 24 }: FlagProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 810 540"
      style={frame}
      role="img"
      aria-label="European Union"
    >
      <rect width="810" height="540" fill="#039" />
      {EU_STARS.map((points) => (
        <polygon key={points} points={points} fill="#FC0" />
      ))}
    </svg>
  );
}

export function FlagUs({ width = 36, height = 24 }: FlagProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1235 650"
      style={frame}
      role="img"
      aria-label="United States"
    >
      <rect width="1235" height="650" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} y={i * 100} width="1235" height="50" fill="#B22234" />
      ))}
      <rect width="494" height="350" fill="#3C3B6E" />
      {US_STARS.map((points) => (
        <polygon key={points} points={points} fill="#fff" />
      ))}
    </svg>
  );
}

export function FlagRu({ width = 36, height = 24 }: FlagProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 900 600"
      style={frame}
      role="img"
      aria-label="Russia"
    >
      <rect width="900" height="600" fill="#fff" />
      <rect y="200" width="900" height="200" fill="#0039A6" />
      <rect y="400" width="900" height="200" fill="#D52B1E" />
    </svg>
  );
}
