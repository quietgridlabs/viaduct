export interface C4Plugin {
  name: string
  version: string
  setup(registry: PluginRegistry): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resolver<T = any> = () => Promise<React.ComponentType<T>>

export class PluginRegistry {
  private components = new Map<string, Resolver>()

  registerComponent(id: string, resolver: Resolver) {
    this.components.set(id, resolver)
  }

  async getComponent<P = unknown>(id: string) {
    const resolver = this.components.get(id);
    if (!resolver) return null;
    return (await resolver()) as React.ComponentType<P> | null;
  }

  private portals = new Map<string, React.ReactNode[]>()

  registerPortal(id: string, node: React.ReactNode) {
    const list = this.portals.get(id) ?? []
    list.push(node)
    this.portals.set(id, list)
  }

  getPortal(id: string): React.ReactNode | null {
    const list = this.portals.get(id)
    if (!list?.length) return null
    if (list.length === 1) return list[0] ?? null
    return list
  }

  private methods = new Map<string, () => void>()

  registerMethod(id: string, method: () => void) {
    this.methods.set(id, method)
  }

  getMethod(id: string) { return this.methods.get(id) }
}

export const registry = new PluginRegistry()
