import { FlatC4Model, ViewLevel } from '@archivisio/c4-modelizer-sdk'

export type LintSeverity = 'error' | 'warning' | 'info'

export type LintIssue = {
  id: string
  severity: LintSeverity
  ruleId: string
  message: string
  entityId?: string
  entityName?: string
  entityType?: ViewLevel
  /** Navigate into this parent when opening the issue */
  navigate?: {
    viewLevel: ViewLevel
    activeSystemId?: string
    activeContainerId?: string
    activeComponentId?: string
  }
}

type EntityRef = {
  id: string
  name: string
  type: ViewLevel
  description?: string
  technology?: string
  url?: string
  connections: { targetId: string }[]
  systemId?: string
  containerId?: string
  componentId?: string
}

function collectEntities(model: FlatC4Model): EntityRef[] {
  const out: EntityRef[] = []
  for (const s of model.systems) {
    out.push({
      id: s.id,
      name: s.name,
      type: 'system',
      description: s.description,
      technology: s.technology,
      url: s.url,
      connections: s.connections || [],
    })
  }
  for (const c of model.containers) {
    out.push({
      id: c.id,
      name: c.name,
      type: 'container',
      description: c.description,
      technology: c.technology,
      url: c.url,
      connections: c.connections || [],
      systemId: c.systemId,
    })
  }
  for (const c of model.components) {
    out.push({
      id: c.id,
      name: c.name,
      type: 'component',
      description: c.description,
      technology: c.technology,
      url: c.url,
      connections: c.connections || [],
      systemId: c.systemId,
      containerId: c.containerId,
    })
  }
  for (const c of model.codeElements) {
    out.push({
      id: c.id,
      name: c.name,
      type: 'code',
      description: c.description,
      technology: c.technology,
      url: c.url,
      connections: c.connections || [],
      systemId: c.systemId,
      containerId: c.containerId,
      componentId: c.componentId,
    })
  }
  return out
}

function navFor(e: EntityRef): LintIssue['navigate'] {
  if (e.type === 'system') {
    return { viewLevel: 'system' }
  }
  if (e.type === 'container') {
    return { viewLevel: 'container', activeSystemId: e.systemId }
  }
  if (e.type === 'component') {
    return {
      viewLevel: 'component',
      activeSystemId: e.systemId,
      activeContainerId: e.containerId,
    }
  }
  return {
    viewLevel: 'code',
    activeSystemId: e.systemId,
    activeContainerId: e.containerId,
    activeComponentId: e.componentId,
  }
}

function issue(
  partial: Omit<LintIssue, 'id'> & { id?: string }
): LintIssue {
  return {
    id: partial.id || `${partial.ruleId}:${partial.entityId || 'model'}`,
    ...partial,
  }
}

export function runArchitectureLinter(model: FlatC4Model): LintIssue[] {
  const entities = collectEntities(model)
  const systemIds = new Set(model.systems.map((s) => s.id))
  const containerIds = new Set(model.containers.map((c) => c.id))
  const componentIds = new Set(model.components.map((c) => c.id))
  const issues: LintIssue[] = []

  for (const e of entities) {
    if (!e.name?.trim()) {
      issues.push(
        issue({
          severity: 'error',
          ruleId: 'empty-name',
          message: `${e.type} has an empty name`,
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
          navigate: navFor(e),
        })
      )
    }

    if (!e.description?.trim()) {
      issues.push(
        issue({
          severity: 'info',
          ruleId: 'missing-description',
          message: `"${e.name || e.id}" has no description`,
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
          navigate: navFor(e),
        })
      )
    }

    if (e.type === 'container' && !e.technology?.trim()) {
      issues.push(
        issue({
          severity: 'warning',
          ruleId: 'container-missing-technology',
          message: `Container "${e.name}" has no technology`,
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
          navigate: navFor(e),
        })
      )
    }

    if (e.type === 'container' && !e.url?.trim()) {
      issues.push(
        issue({
          severity: 'info',
          ruleId: 'container-missing-url',
          message: `Container "${e.name}" has no URL`,
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
          navigate: navFor(e),
        })
      )
    }

    // Broken parent refs
    if (e.type === 'container' && e.systemId && !systemIds.has(e.systemId)) {
      issues.push(
        issue({
          severity: 'error',
          ruleId: 'orphan-container',
          message: `Container "${e.name}" references missing system`,
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
        })
      )
    }
    if (e.type === 'component') {
      if (e.containerId && !containerIds.has(e.containerId)) {
        issues.push(
          issue({
            severity: 'error',
            ruleId: 'orphan-component',
            message: `Component "${e.name}" references missing container`,
            entityId: e.id,
            entityName: e.name,
            entityType: e.type,
          })
        )
      }
      if (e.systemId && !systemIds.has(e.systemId)) {
        issues.push(
          issue({
            severity: 'error',
            ruleId: 'orphan-component-system',
            message: `Component "${e.name}" references missing system`,
            entityId: e.id,
            entityName: e.name,
            entityType: e.type,
          })
        )
      }
    }
    if (e.type === 'code') {
      if (e.componentId && !componentIds.has(e.componentId)) {
        issues.push(
          issue({
            severity: 'error',
            ruleId: 'orphan-code',
            message: `Code element "${e.name}" references missing component`,
            entityId: e.id,
            entityName: e.name,
            entityType: e.type,
          })
        )
      }
    }

    // Broken connection targets (same level)
    const levelIds = new Set(
      entities.filter((x) => x.type === e.type).map((x) => x.id)
    )
    for (const conn of e.connections) {
      if (!conn.targetId || !levelIds.has(conn.targetId)) {
        issues.push(
          issue({
            id: `broken-connection:${e.id}->${conn.targetId}`,
            severity: 'error',
            ruleId: 'broken-connection',
            message: `"${e.name}" has a connection to missing target`,
            entityId: e.id,
            entityName: e.name,
            entityType: e.type,
            navigate: navFor(e),
          })
        )
      }
    }
  }

  // Duplicate names within same parent scope
  const nameBuckets = new Map<string, EntityRef[]>()
  for (const e of entities) {
    const scope =
      e.type === 'system'
        ? 'system'
        : e.type === 'container'
          ? `container:${e.systemId}`
          : e.type === 'component'
            ? `component:${e.containerId}`
            : `code:${e.componentId}`
    const key = `${scope}::${(e.name || '').trim().toLowerCase()}`
    if (!e.name?.trim()) continue
    const list = nameBuckets.get(key) || []
    list.push(e)
    nameBuckets.set(key, list)
  }
  for (const list of nameBuckets.values()) {
    if (list.length < 2) continue
    for (const e of list) {
      issues.push(
        issue({
          id: `duplicate-name:${e.id}`,
          severity: 'warning',
          ruleId: 'duplicate-name',
          message: `Duplicate name "${e.name}" among ${e.type}s`,
          entityId: e.id,
          entityName: e.name,
          entityType: e.type,
          navigate: navFor(e),
        })
      )
    }
  }

  // Empty systems (no containers)
  for (const s of model.systems) {
    const kids = model.containers.filter((c) => c.systemId === s.id)
    if (kids.length === 0) {
      issues.push(
        issue({
          severity: 'info',
          ruleId: 'empty-system',
          message: `System "${s.name}" has no containers`,
          entityId: s.id,
          entityName: s.name,
          entityType: 'system',
          navigate: { viewLevel: 'system' },
        })
      )
    }
  }

  // Isolated nodes at system level (no in/out connections) when >1 systems
  if (model.systems.length > 1) {
    const incoming = new Set<string>()
    for (const s of model.systems) {
      for (const c of s.connections || []) incoming.add(c.targetId)
    }
    for (const s of model.systems) {
      const out = (s.connections || []).length
      const inn = incoming.has(s.id) ? 1 : 0
      if (out + inn === 0) {
        issues.push(
          issue({
            severity: 'warning',
            ruleId: 'isolated-system',
            message: `System "${s.name}" has no connections`,
            entityId: s.id,
            entityName: s.name,
            entityType: 'system',
            navigate: { viewLevel: 'system' },
          })
        )
      }
    }
  }

  const order: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.message.localeCompare(b.message))
}

export function summarizeIssues(issues: LintIssue[]) {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
    total: issues.length,
  }
}
