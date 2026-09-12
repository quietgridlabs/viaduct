import { useId, useLayoutEffect, useMemo, useRef, type ComponentType, type SVGProps } from 'react';

export type BrandSvg = ComponentType<SVGProps<SVGSVGElement>>;

const REF_ATTRS = ['fill', 'stroke', 'clip-path', 'mask', 'filter'] as const;

/**
 * A brand mark from svgl, drawn so that it actually shows up.
 *
 * Several of svgl's marks — Grafana, Atlassian, Storybook, Figma — paint with
 * a gradient or a clip declared inside their own `<defs>` under a fixed id,
 * and reference it as `url(#Grafana__a)`. That reference resolves against the
 * whole document, to the *first* element with that id. Put the same mark in a
 * closed dropdown somewhere on the page — the technology list holds most of
 * them — and every later copy points at a `<defs>` inside `display: none`,
 * which Chrome declines to paint from. The path is there, the fill is
 * transparent, and the icon is simply missing.
 *
 * So each instance gets its own ids: after mount, every `id` inside this mark
 * is suffixed with a per-instance token and every `url(#…)` that pointed at it
 * is pointed at the new one. The element is memoised so React never
 * reconciles those attributes back.
 */
export default function BrandMark({
  icon: Icon,
  size = 14,
  title,
}: {
  icon: BrandSvg;
  size?: number | string;
  title?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const suffix = useId().replace(/[^A-Za-z0-9]/g, '');

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const node of Array.from(root.querySelectorAll('[id]'))) {
      const old = node.id;
      if (!old || old.endsWith(`-${suffix}`)) continue;
      const next = `${old}-${suffix}`;
      node.id = next;
      const ref = `url(#${old})`;
      for (const user of Array.from(root.querySelectorAll('*'))) {
        for (const attr of REF_ATTRS) {
          if (user.getAttribute(attr) === ref) user.setAttribute(attr, `url(#${next})`);
        }
        for (const attr of ['href', 'xlink:href']) {
          if (user.getAttribute(attr) === `#${old}`) user.setAttribute(attr, `#${next}`);
        }
      }
    }
  }, [suffix]);

  const element = useMemo(
    () => (
      <Icon width={size} height={size} aria-hidden={title ? undefined : true} focusable="false">
        {title ? <title>{title}</title> : null}
      </Icon>
    ),
    [Icon, size, title]
  );

  return (
    <span ref={ref} style={{ display: 'inline-flex', lineHeight: 0, flexShrink: 0 }}>
      {element}
    </span>
  );
}
