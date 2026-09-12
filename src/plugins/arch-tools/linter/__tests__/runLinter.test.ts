import { FlatC4Model } from '@archivisio/c4-modelizer-sdk'
import { runArchitectureLinter, summarizeIssues } from '../runLinter'

const emptyModel = {
  systems: [],
  containers: [],
  components: [],
  codeElements: [],
  viewLevel: 'system',
} as FlatC4Model

describe('runArchitectureLinter', () => {
  it('returns no issues for empty model', () => {
    expect(runArchitectureLinter(emptyModel)).toEqual([])
  })

  it('flags empty names and missing container technology', () => {
    const model = {
      ...emptyModel,
      systems: [
        {
          id: 's1',
          name: 'Core',
          type: 'system',
          position: { x: 0, y: 0 },
          connections: [],
          description: 'ok',
        },
      ],
      containers: [
        {
          id: 'c1',
          systemId: 's1',
          name: '   ',
          type: 'container',
          position: { x: 0, y: 0 },
          connections: [],
        },
      ],
    } as unknown as FlatC4Model

    const issues = runArchitectureLinter(model)
    expect(issues.some((i) => i.ruleId === 'empty-name')).toBe(true)
    expect(issues.some((i) => i.ruleId === 'container-missing-technology')).toBe(true)
  })

  it('flags broken connections and orphan containers', () => {
    const model = {
      ...emptyModel,
      systems: [
        {
          id: 's1',
          name: 'A',
          type: 'system',
          position: { x: 0, y: 0 },
          connections: [{ targetId: 'missing' }],
          description: 'd',
        },
      ],
      containers: [
        {
          id: 'c1',
          systemId: 'gone',
          name: 'Orphan',
          type: 'container',
          position: { x: 0, y: 0 },
          connections: [],
          description: 'd',
          technology: 'java',
        },
      ],
    } as unknown as FlatC4Model

    const issues = runArchitectureLinter(model)
    expect(issues.some((i) => i.ruleId === 'broken-connection')).toBe(true)
    expect(issues.some((i) => i.ruleId === 'orphan-container')).toBe(true)
  })

  it('summarizes severities', () => {
    const summary = summarizeIssues([
      { id: '1', severity: 'error', ruleId: 'x', message: 'a' },
      { id: '2', severity: 'warning', ruleId: 'y', message: 'b' },
      { id: '3', severity: 'info', ruleId: 'z', message: 'c' },
      { id: '4', severity: 'error', ruleId: 'x', message: 'd' },
    ])
    expect(summary).toEqual({ errors: 2, warnings: 1, infos: 1, total: 4 })
  })
})
