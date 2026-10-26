import CodeBlock from '@components/code/CodeBlock';
import ComponentBlock from '@components/component/ComponentBlock';
import ContainerBlock from '@components/container/ContainerBlock';
import SystemBlock from '@components/system/SystemBlock';
import TableNode from '@components/er/TableNode';
import GroupFrameNode from '@components/common/GroupFrameNode';
import ServiceOrbNode from '@components/ServiceOrbNode';
import TechnologyEdge from '@components/TechnologyEdge';

/** Module-level identity — RF remounts node types if this object is recreated. */
export const nodeTypes = {
  system: SystemBlock,
  container: ContainerBlock,
  component: ComponentBlock,
  code: CodeBlock,
  table: TableNode,
  groupFrame: GroupFrameNode,
  serviceOrb: ServiceOrbNode,
};

export const edgeTypes = {
  technology: TechnologyEdge,
};
