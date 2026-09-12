import { registry } from '@plugins/registry'
import { usePluginsReady } from '@plugins/usePluginsReady'
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react'

type Props = {
  children: ReactNode
}
export default function RootProviderSlot({ children }: Props) {
  const [Provider, setProvider] = useState<React.ComponentType<Props> | null>(null)
  const mounted = useRef(false)
  // Plugins boot lazily, so the provider may only appear after a route change.
  const pluginsReady = usePluginsReady()

  useEffect(() => {
    mounted.current = true
    registry.getComponent('root:provider').then((comp) => {
      if (mounted.current && comp) setProvider(() => comp as React.ComponentType<Props>)
    })
    return () => {
      mounted.current = false
    }
  }, [pluginsReady])

  if (!Provider) return <>{children}</>

  return (
    <Suspense fallback={null}>
      <Provider>{children}</Provider>
    </Suspense>
  )
}
