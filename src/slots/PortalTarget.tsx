import { Fragment } from "react";
import { registry } from "@plugins/registry";
import { usePluginsReady } from "@plugins/usePluginsReady";

interface Props {
  id: string;
}

export default function PortalTarget({ id }: Props) {
  // Portals are registered when plugins boot, which happens after first paint.
  usePluginsReady();
  const node = registry.getPortal(id);
  if (!node) return null;
  if (Array.isArray(node)) {
    return (
      <Fragment>
        {node.map((child, index) => (
          <Fragment key={`${id}-${index}`}>{child}</Fragment>
        ))}
      </Fragment>
    );
  }
  return <>{node}</>;
}
