import { ViewLevel } from '@archivisio/c4-modelizer-sdk'

export type NodePreset = {
  id: string
  label: string
  description: string
  /** Levels where this preset can be inserted */
  levels: ViewLevel[]
  name: string
  technology?: string
  elementDescription?: string
  url?: string
  codeType?: 'class' | 'function' | 'interface' | 'variable' | 'other'
  /** Element discriminator: API endpoint, broker channel, or person */
  kind?: 'endpoint' | 'channel' | 'person'
  endpoint?: string
  method?: string
}

export const NODE_PRESETS: NodePreset[] = [
  {
    id: 'spring-api',
    label: 'Spring Boot API',
    description: 'HTTP API service',
    levels: ['container'],
    name: 'API Service',
    technology: 'spring',
    elementDescription: 'REST API built with Spring Boot',
  },
  {
    id: 'nestjs-api',
    label: 'NestJS API',
    description: 'Node.js HTTP API',
    levels: ['container'],
    name: 'API Service',
    technology: 'nestjs',
    elementDescription: 'REST API built with NestJS',
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    description: 'Relational database',
    levels: ['container'],
    name: 'PostgreSQL',
    technology: 'postgresql',
    elementDescription: 'Primary relational datastore',
  },
  {
    id: 'redis',
    label: 'Redis',
    description: 'Cache / session store',
    levels: ['container'],
    name: 'Redis',
    technology: 'redis',
    elementDescription: 'In-memory cache',
  },
  {
    id: 'kafka',
    label: 'Kafka',
    description: 'Event streaming',
    levels: ['container'],
    name: 'Kafka',
    technology: 'kafka',
    elementDescription: 'Event bus / streaming platform',
  },
  {
    id: 'react-spa',
    label: 'React SPA',
    description: 'Frontend application',
    levels: ['container'],
    name: 'Web App',
    technology: 'react',
    elementDescription: 'Single-page application',
  },
  {
    id: 'api-gateway',
    label: 'API Gateway',
    description: 'Edge / gateway service',
    levels: ['container', 'system'],
    name: 'API Gateway',
    technology: 'nginx',
    elementDescription: 'Entry point for external traffic',
  },
  {
    id: 'external-system',
    label: 'External System',
    description: 'Third-party system',
    levels: ['system'],
    name: 'External System',
    elementDescription: 'External dependency / partner system',
  },
  {
    id: 'domain-service',
    label: 'Domain Service',
    description: 'Business capability system',
    levels: ['system'],
    name: 'Domain Service',
    elementDescription: 'Bounded context / business capability',
  },
  {
    id: 'controller',
    label: 'Controller',
    description: 'API controller component',
    levels: ['component'],
    name: 'Controller',
    technology: 'spring',
    elementDescription: 'Handles inbound HTTP requests',
  },
  {
    id: 'repository',
    label: 'Repository',
    description: 'Data access component',
    levels: ['component'],
    name: 'Repository',
    elementDescription: 'Persistence / data access',
  },
  {
    id: 'service-component',
    label: 'Service',
    description: 'Domain logic component',
    levels: ['component'],
    name: 'Service',
    elementDescription: 'Business logic',
  },
  {
    id: 'api-endpoint-get',
    label: 'GET Endpoint',
    description: 'HTTP GET API endpoint',
    levels: ['component'],
    name: 'Get Resource',
    elementDescription: 'Fetch a resource',
    kind: 'endpoint',
    method: 'GET',
    endpoint: '/api/resource',
  },
  {
    id: 'api-endpoint-post',
    label: 'POST Endpoint',
    description: 'HTTP POST API endpoint',
    levels: ['component'],
    name: 'Create Resource',
    elementDescription: 'Create a resource',
    kind: 'endpoint',
    method: 'POST',
    endpoint: '/api/resource',
  },
  {
    id: 'java-class',
    label: 'Java Class',
    description: 'Code-level class',
    levels: ['code'],
    name: 'MyClass',
    technology: 'java',
    codeType: 'class',
    elementDescription: 'Class definition',
  },
  {
    id: 'ts-interface',
    label: 'TypeScript Interface',
    description: 'Code-level interface',
    levels: ['code'],
    name: 'MyInterface',
    technology: 'typescript',
    codeType: 'interface',
    elementDescription: 'Interface definition',
  },
]

export function presetsForLevel(level: ViewLevel) {
  return NODE_PRESETS.filter((p) => p.levels.includes(level))
}
