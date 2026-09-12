import { ToolbarProps } from "@components/Toolbar";
import { lazyRegistry } from "@plugins/lazyRegistry";
import { Suspense } from "react";

const Toolbar = lazyRegistry<ToolbarProps>("toolbar:main");

export default function ToolbarSlot(props: ToolbarProps) {
  return (
    <Suspense fallback={null}>
      <Toolbar {...props} />
    </Suspense>
  );
}
