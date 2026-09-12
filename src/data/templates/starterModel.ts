import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { TableColumn } from '@/types/c4Extensions';
import { slugFromC4 } from '@plugins/sequence-editor/host/c4Catalog';

const id = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

type Conn = {
  targetId: string;
  label?: string;
  technology?: string;
  description?: string;
  bidirectional?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
  labelPosition?: number;
  relatedComponentIds?: string[];
  channelRole?: 'produce' | 'consume';
  foreignKey?: { sourceColumnId: string; targetColumnId: string };
};

/**
 * C4Block handle ids (Position enum + index):
 *   source: right-0, bottom-1, left-2, top-3
 *   target: left-0, top-1, bottom-2, right-3
 * TableNode ids: source-right | source-bottom | target-left | target-top
 */
const H = {
  right: { sourceHandle: 'source-right-0', targetHandle: 'target-left-0' },
  down: { sourceHandle: 'source-bottom-1', targetHandle: 'target-top-1' },
  left: { sourceHandle: 'source-left-2', targetHandle: 'target-right-3' },
  up: { sourceHandle: 'source-top-3', targetHandle: 'target-bottom-2' },
  /** ER table nodes */
  tableRight: { sourceHandle: 'source-right', targetHandle: 'target-left' },
  tableDown: { sourceHandle: 'source-bottom', targetHandle: 'target-top' },
} as const;

function conn(targetId: string, extras: Omit<Conn, 'targetId'> = {}): Conn {
  return {
    targetId,
    label: '',
    technology: '',
    description: '',
    bidirectional: false,
    ...H.right,
    labelPosition: 50,
    ...extras,
  };
}

function col(
  name: string,
  dataType: string,
  opts: { primaryKey?: boolean; nullable?: boolean } = {}
): TableColumn {
  return {
    id: id(),
    name,
    dataType,
    primaryKey: opts.primaryKey,
    nullable: opts.primaryKey ? false : opts.nullable ?? true,
  };
}

function storedSequence(name: string, plantUmlSource: string) {
  const now = new Date().toISOString();
  return {
    id: `seq_${id().slice(0, 8)}`,
    name,
    plantUmlSource: plantUmlSource.trim() + '\n',
    modelVersion: 1 as const,
    createdAt: now,
    updatedAt: now,
  };
}

function sequenceRef(sequenceId: string) {
  return ['', '```c4-sequence', `id: ${sequenceId}`, '```', ''].join('\n');
}

/** One hop of a Magic flow: who calls whom, over which connection. */
function flowStep(
  name: string,
  from: string,
  to: string,
  extras: {
    description?: string;
    endpointIds?: string[];
    channelIds?: string[];
    parallelGroupId?: string;
  } = {}
) {
  return {
    id: id(),
    name,
    description: extras.description ?? '',
    from: { id: from, type: 'container' as const },
    to: { id: to, type: 'container' as const },
    connections: [{ sourceId: from, targetId: to }],
    ...(extras.endpointIds ? { endpointIds: extras.endpointIds } : {}),
    ...(extras.channelIds ? { channelIds: extras.channelIds } : {}),
    ...(extras.parallelGroupId ? { parallelGroupId: extras.parallelGroupId } : {}),
  };
}

function avroRecord(name: string, fields: string): string {
  return `@format avro\n@name ${name}\n\n{\n  "type": "record",\n  "name": "${name}",\n  "fields": [\n${fields}\n  ]\n}`;
}

export type StarterDocSeed = {
  id: string;
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  title: string;
  markdown: string;
};

export type StarterBundle = {
  model: FlatC4Model;
  docs: StarterDocSeed[];
};

/** PlantUML alias must match `slugFromC4(name, id)` from the sequence C4 catalog. */
function alias(name: string, entityId: string) {
  return slugFromC4(name, entityId);
}

function loginSequenceSource(refs: {
  customer: { name: string; id: string };
  spa: { name: string; id: string };
  api: { name: string; id: string };
  authSvc: { name: string; id: string };
  db: { name: string; id: string };
}) {
  const Customer = alias(refs.customer.name, refs.customer.id);
  const SPA = alias(refs.spa.name, refs.spa.id);
  const API = alias(refs.api.name, refs.api.id);
  const Auth = alias(refs.authSvc.name, refs.authSvc.id);
  const DB = alias(refs.db.name, refs.db.id);
  return `@startuml
title Customer signs in

actor "${refs.customer.name}" as ${Customer}
participant "${refs.spa.name}" as ${SPA}
participant "${refs.api.name}" as ${API}
control "${refs.authSvc.name}" as ${Auth}
database "${refs.db.name}" as ${DB}

${Customer} -> ${SPA}: Enter email + password
${SPA} -> ${API}: POST /api/auth/login
${API} -> ${Auth}: authenticate(email, password)
${Auth} -> ${DB}: SELECT users WHERE email = ?
${DB} --> ${Auth}: user row
${Auth} -> ${DB}: INSERT INTO sessions
${DB} --> ${Auth}: session id
${Auth} --> ${API}: JWT + expires_at
${API} --> ${SPA}: 200 { access_token }
${SPA} --> ${Customer}: Session started
@enduml`;
}

function paymentSequenceSource(refs: {
  customer: { name: string; id: string };
  spa: { name: string; id: string };
  api: { name: string; id: string };
  paymentsCtrl: { name: string; id: string };
  paymentsSvc: { name: string; id: string };
  facade: { name: string; id: string };
  db: { name: string; id: string };
}) {
  const Customer = alias(refs.customer.name, refs.customer.id);
  const SPA = alias(refs.spa.name, refs.spa.id);
  const API = alias(refs.api.name, refs.api.id);
  const PayCtrl = alias(refs.paymentsCtrl.name, refs.paymentsCtrl.id);
  const PaySvc = alias(refs.paymentsSvc.name, refs.paymentsSvc.id);
  const Facade = alias(refs.facade.name, refs.facade.id);
  const DB = alias(refs.db.name, refs.db.id);
  return `@startuml
title Transfer between accounts

actor "${refs.customer.name}" as ${Customer}
participant "${refs.spa.name}" as ${SPA}
participant "${refs.api.name}" as ${API}
control "${refs.paymentsCtrl.name}" as ${PayCtrl}
control "${refs.paymentsSvc.name}" as ${PaySvc}
control "${refs.facade.name}" as ${Facade}
database "${refs.db.name}" as ${DB}

${Customer} -> ${SPA}: Submit transfer
${SPA} -> ${API}: POST /api/payments
${API} -> ${PayCtrl}: createPayment(dto)
${PayCtrl} -> ${PaySvc}: execute(transfer)
${PaySvc} -> ${DB}: BEGIN; lock accounts
${PaySvc} -> ${Facade}: debit/credit on core ledger
${Facade} --> ${PaySvc}: OK
${PaySvc} -> ${DB}: INSERT transactions; COMMIT
${DB} --> ${PaySvc}: ok
${PaySvc} --> ${PayCtrl}: PaymentResult
${PayCtrl} --> ${API}: 201 Created
${API} --> ${SPA}: receipt
${SPA} --> ${Customer}: Transfer confirmed
@enduml`;
}

/**
 * Full sample: systems → containers → REST/components → ER schema → code + sequences + docs.
 * Fresh UUIDs on every call so projects never share entity ids.
 */
export function buildStarterBundle(): StarterBundle {
  return buildStarterInternal();
}

/** Model-only helper (local onboarding / tests). */
export function buildStarterModel(): FlatC4Model {
  return buildStarterInternal().model;
}

function buildStarterInternal(): StarterBundle {
  const NOW = new Date().toISOString();
  const banking = id();
  const mainframe = id();
  const email = id();
  const identity = id();
  const paymentNetwork = id();
  const fraud = id();

  const customerName = 'Customer';
  const spaName = 'Single-Page Application';
  const apiName = 'API Application';
  const dbName = 'PostgreSQL';
  const authSvcName = 'Auth Service';
  const paymentsCtrlName = 'Payments Controller';
  const paymentsSvcName = 'Payments Service';
  const facadeName = 'Mainframe Facade';

  const customer = id();
  const supportAgent = id();
  const spa = id();
  const api = id();
  const db = id();
  const mobile = id();
  const adminConsole = id();
  const gateway = id();
  const notifications = id();
  const cache = id();
  const broker = id();
  const topicRequested = id();
  const topicSettled = id();
  const topicFraud = id();

  // REST endpoints
  const epLogin = id();
  const epAccounts = id();
  const epAccountById = id();
  const epPayments = id();

  // API components
  const authCtrl = id();
  const accountsCtrl = id();
  const paymentsCtrl = id();
  const authSvc = id();
  const accountsSvc = id();
  const paymentsSvc = id();
  const security = id();
  const facade = id();
  const userRepo = id();
  const accountRepo = id();
  const paymentRepo = id();

  // Code under Auth Service
  const authServiceClass = id();
  const passwordHasher = id();

  // Docs (ids must match server regex ^[A-Za-z0-9_-]{8,64}$)
  const docBanking = `doc_${id().replace(/-/g, '').slice(0, 12)}`;
  const docApi = `doc_${id().replace(/-/g, '').slice(0, 12)}`;
  const docAuth = `doc_${id().replace(/-/g, '').slice(0, 12)}`;
  const docWriting = `doc_${id().replace(/-/g, '').slice(0, 12)}`;
  const docGateway = `doc_${id().replace(/-/g, '').slice(0, 12)}`;
  const docNotifications = `doc_${id().replace(/-/g, '').slice(0, 12)}`;

  // Magic flows
  const flowSignIn = id();
  const flowPayment = id();

  // ER tables + columns (column ids needed for FKs)
  const tUsers = id();
  const tSessions = id();
  const tAccounts = id();
  const tTx = id();

  const usersId = col('id', 'uuid', { primaryKey: true });
  const usersEmail = col('email', 'text', { nullable: false });
  const usersHash = col('password_hash', 'text', { nullable: false });
  const usersCreated = col('created_at', 'timestamptz', { nullable: false });

  const sessionsId = col('id', 'uuid', { primaryKey: true });
  const sessionsUserId = col('user_id', 'uuid', { nullable: false });
  const sessionsToken = col('token', 'text', { nullable: false });
  const sessionsExpires = col('expires_at', 'timestamptz', { nullable: false });

  const accountsId = col('id', 'uuid', { primaryKey: true });
  const accountsUserId = col('user_id', 'uuid', { nullable: false });
  const accountsIban = col('iban', 'text', { nullable: false });
  const accountsBalance = col('balance', 'numeric', { nullable: false });
  const accountsCurrency = col('currency', 'text', { nullable: false });

  const txId = col('id', 'uuid', { primaryKey: true });
  const txAccountId = col('account_id', 'uuid', { nullable: false });
  const txAmount = col('amount', 'numeric', { nullable: false });
  const txType = col('type', 'text', { nullable: false });
  const txCreated = col('created_at', 'timestamptz', { nullable: false });

  const dbTouching = [userRepo, accountRepo, paymentRepo, authSvc, accountsSvc, paymentsSvc];

  const loginSeq = storedSequence(
    'Customer signs in',
    loginSequenceSource({
      customer: { name: customerName, id: customer },
      spa: { name: spaName, id: spa },
      api: { name: apiName, id: api },
      authSvc: { name: authSvcName, id: authSvc },
      db: { name: dbName, id: db },
    })
  );
  const paymentSeq = storedSequence(
    'Transfer between accounts',
    paymentSequenceSource({
      customer: { name: customerName, id: customer },
      spa: { name: spaName, id: spa },
      api: { name: apiName, id: api },
      paymentsCtrl: { name: paymentsCtrlName, id: paymentsCtrl },
      paymentsSvc: { name: paymentsSvcName, id: paymentsSvc },
      facade: { name: facadeName, id: facade },
      db: { name: dbName, id: db },
    })
  );

  const model = {
    schemaVersion: 2,
    viewLevel: 'system',
    systems: [
      {
        id: banking,
        name: 'Internet Banking System',
        description:
          'Customers view accounts and make payments. Double-click → containers (SPA, API, DB).',
        technology: '',
        url: '',
        type: 'system',
        external: false,
        documentationId: docBanking,
        position: { x: 460, y: 300 },
        connections: [
          conn(mainframe, {
            label: 'Gets account information from',
            technology: 'xml/https',
            ...H.right,
          }),
          conn(email, {
            label: 'Sends e-mail using',
            technology: 'smtp',
            ...H.right,
          }),
          conn(identity, {
            label: 'Verifies customers with',
            technology: 'oauth2',
            ...H.left,
          }),
          conn(paymentNetwork, {
            label: 'Settles transfers through',
            technology: 'iso20022',
            ...H.down,
          }),
          conn(fraud, {
            label: 'Streams payment events to',
            technology: 'kafka',
            ...H.left,
          }),
        ],
      },
      {
        id: mainframe,
        name: 'Mainframe Banking System',
        description: 'Core ledger — accounts, balances and settlements (external).',
        technology: '',
        url: '',
        type: 'system',
        external: true,
        position: { x: 940, y: 60 },
        connections: [],
      },
      {
        id: email,
        name: 'E-mail System',
        description: 'Transactional mail (password reset, payment receipts).',
        technology: '',
        url: '',
        type: 'system',
        external: true,
        position: { x: 940, y: 560 },
        connections: [],
      },
      {
        id: identity,
        name: 'Identity Provider',
        description: 'Corporate OIDC provider — step-up authentication and staff SSO.',
        technology: '',
        url: '',
        type: 'system',
        external: true,
        position: { x: 0, y: 60 },
        connections: [],
      },
      {
        id: fraud,
        name: 'Fraud Analytics',
        description: 'Scores payment events in near real time and flags suspicious transfers.',
        technology: '',
        url: '',
        type: 'system',
        external: true,
        position: { x: 0, y: 560 },
        connections: [],
      },
      {
        id: paymentNetwork,
        name: 'Payment Network',
        description: 'Interbank settlement rail (SEPA / SWIFT) reached over ISO 20022.',
        technology: '',
        url: '',
        type: 'system',
        external: true,
        position: { x: 460, y: 660 },
        connections: [],
      },
    ],
    containers: [
      {
        id: customer,
        systemId: banking,
        name: customerName,
        description: 'Personal banking customer using the internet banking apps.',
        technology: '',
        url: '',
        type: 'container',
        kind: 'person',
        external: true,
        position: { x: 40, y: 40 },
        connections: [
          conn(spa, {
            label: 'Uses',
            technology: 'https',
            ...H.down,
          }),
          conn(mobile, {
            label: 'Uses',
            technology: 'https',
            ...H.down,
          }),
        ],
      },
      {
        id: supportAgent,
        systemId: banking,
        name: 'Support Agent',
        description: 'Back-office staff handling disputes and account questions.',
        technology: '',
        url: '',
        type: 'container',
        kind: 'person',
        external: true,
        position: { x: 40, y: 820 },
        connections: [
          conn(adminConsole, {
            label: 'Uses',
            technology: 'https',
            ...H.down,
          }),
        ],
      },
      {
        id: spa,
        systemId: banking,
        name: spaName,
        description: 'Browser UI for internet banking (React).',
        technology: 'javascript',
        url: '',
        type: 'container',
        position: { x: 40, y: 300 },
        connections: [
          conn(gateway, {
            label: 'JSON/HTTPS API calls',
            technology: 'json/https',
            relatedComponentIds: [epLogin, epAccounts, epAccountById, epPayments],
            ...H.right,
          }),
        ],
      },
      {
        id: mobile,
        systemId: banking,
        name: 'Mobile App',
        description: 'Limited subset of banking features on iOS/Android.',
        technology: 'mobile-device',
        url: '',
        type: 'container',
        position: { x: 40, y: 560 },
        connections: [
          conn(gateway, {
            label: 'JSON/HTTPS API calls',
            technology: 'json/https',
            relatedComponentIds: [epLogin, epAccounts, epPayments],
            ...H.right,
          }),
        ],
      },
      {
        id: adminConsole,
        systemId: banking,
        name: 'Admin Console',
        description: 'Internal back-office UI for disputes, limits and account lookups.',
        technology: 'react',
        url: '',
        type: 'container',
        position: { x: 40, y: 1080 },
        connections: [
          conn(gateway, {
            label: 'Admin API calls',
            technology: 'json/https',
            ...H.right,
          }),
        ],
      },
      {
        id: gateway,
        systemId: banking,
        name: 'API Gateway',
        description: 'Terminates TLS, applies rate limits and routes traffic to the API.',
        technology: 'nginx',
        url: '',
        type: 'container',
        documentationId: docGateway,
        position: { x: 480, y: 460 },
        connections: [
          conn(api, {
            label: 'Routes to',
            technology: 'http',
            ...H.right,
          }),
        ],
      },
      {
        id: api,
        systemId: banking,
        name: apiName,
        description:
          'Spring JSON API: REST endpoints, services, repositories. Open for components + sequence diagrams.',
        technology: 'java',
        url: '',
        type: 'container',
        documentationId: docApi,
        position: { x: 940, y: 460 },
        sequenceDiagrams: [loginSeq, paymentSeq],
        connections: [
          conn(db, {
            label: 'Reads from and writes to',
            technology: 'jdbc',
            bidirectional: true,
            relatedComponentIds: dbTouching,
            ...H.right,
          }),
          conn(cache, {
            label: 'Caches sessions in',
            technology: 'redis',
            ...H.up,
          }),
          conn(broker, {
            label: 'Publishes payment events to',
            technology: 'kafka',
            channelRole: 'produce',
            relatedComponentIds: [topicRequested, topicSettled, topicFraud],
            ...H.down,
          }),
        ],
      },
      {
        id: db,
        systemId: banking,
        name: dbName,
        description:
          'PostgreSQL — users, sessions, accounts, transactions. Double-click for ER schema.',
        technology: 'postgresql',
        url: '',
        type: 'container',
        position: { x: 1400, y: 460 },
        connections: [],
      },
      {
        id: cache,
        systemId: banking,
        name: 'Session Cache',
        description: 'Redis — session tokens and short-lived account projections.',
        technology: 'redis',
        url: '',
        type: 'container',
        position: { x: 1400, y: 140 },
        connections: [],
      },
      {
        id: broker,
        systemId: banking,
        name: 'Event Bus',
        description: 'Kafka — payment and fraud topics. Double-click for the channel list.',
        technology: 'kafka',
        url: '',
        type: 'container',
        position: { x: 940, y: 820 },
        connections: [
          conn(notifications, {
            label: 'payment.settled',
            technology: 'kafka',
            channelRole: 'consume',
            relatedComponentIds: [topicSettled],
            ...H.right,
          }),
        ],
      },
      {
        id: notifications,
        systemId: banking,
        name: 'Notification Worker',
        description: 'Consumes settled payments and sends receipts through the e-mail system.',
        technology: 'java',
        url: '',
        type: 'container',
        documentationId: docNotifications,
        position: { x: 1400, y: 820 },
        connections: [],
      },
    ],
    components: [
      // —— REST API surface ——
      {
        id: epLogin,
        systemId: banking,
        containerId: api,
        name: 'Login',
        description: 'Authenticate customer and issue JWT.',
        technology: '',
        url: '',
        type: 'component',
        kind: 'endpoint',
        method: 'POST',
        endpoint: '/api/auth/login',
        headers: 'Content-Type: application/json',
        request: '{\n  "email": "customer@example.com",\n  "password": "••••••••"\n}',
        response:
          '{\n  "token": "eyJhbGciOi…",\n  "expiresIn": 3600,\n  "userId": "usr_…"\n}',
        position: { x: 0, y: 0 },
        connections: [conn(authCtrl, { label: 'handled by', ...H.right })],
      },
      {
        id: epAccounts,
        systemId: banking,
        containerId: api,
        name: 'List accounts',
        description: 'Account summary for the current user.',
        technology: '',
        url: '',
        type: 'component',
        kind: 'endpoint',
        method: 'GET',
        endpoint: '/api/accounts',
        headers: 'Authorization: Bearer <token>',
        response:
          '{\n  "accounts": [\n    { "id": "acc_1", "name": "Current", "balance": 1250.5 }\n  ]\n}',
        position: { x: 0, y: 180 },
        connections: [conn(accountsCtrl, { label: 'handled by', ...H.right })],
      },
      {
        id: epAccountById,
        systemId: banking,
        containerId: api,
        name: 'Get account',
        description: 'Single account details by id.',
        technology: '',
        url: '',
        type: 'component',
        kind: 'endpoint',
        method: 'GET',
        endpoint: '/api/accounts/:id',
        headers: 'Authorization: Bearer <token>',
        response:
          '{\n  "id": "acc_1",\n  "name": "Current",\n  "currency": "EUR",\n  "balance": 1250.5\n}',
        position: { x: 0, y: 360 },
        connections: [conn(accountsCtrl, { label: 'handled by', ...H.right })],
      },
      {
        id: epPayments,
        systemId: banking,
        containerId: api,
        name: 'Create payment',
        description: 'Initiate a transfer between accounts.',
        technology: '',
        url: '',
        type: 'component',
        kind: 'endpoint',
        method: 'POST',
        endpoint: '/api/payments',
        headers: 'Content-Type: application/json\nAuthorization: Bearer <token>',
        request:
          '{\n  "fromAccountId": "acc_1",\n  "toAccountId": "acc_2",\n  "amount": 100.0,\n  "currency": "EUR"\n}',
        response:
          '{\n  "paymentId": "pay_…",\n  "status": "pending"\n}',
        position: { x: 0, y: 560 },
        connections: [conn(paymentsCtrl, { label: 'handled by', ...H.right })],
      },

      {
        id: topicRequested,
        systemId: banking,
        containerId: broker,
        name: 'payment.requested',
        description: 'Payment submitted; settlement and fraud consume this.',
        type: 'component',
        kind: 'channel',
        protocol: 'kafka',
        schemaFormat: 'avro',
        compatibility: 'backward',
        valueSchema: avroRecord(
          'PaymentRequested',
          '    { "name": "paymentId", "type": "string" },\n    { "name": "amount", "type": "long" },\n    { "name": "currency", "type": "string" }'
        ),
        position: { x: 0, y: 0 },
        connections: [],
      },
      {
        id: topicSettled,
        systemId: banking,
        containerId: broker,
        name: 'payment.settled',
        description: 'Ledger confirmed the transfer.',
        type: 'component',
        kind: 'channel',
        protocol: 'kafka',
        schemaFormat: 'avro',
        compatibility: 'backward',
        valueSchema: avroRecord(
          'PaymentSettled',
          '    { "name": "paymentId", "type": "string" },\n    { "name": "status", "type": "string" }'
        ),
        position: { x: 0, y: 180 },
        connections: [],
      },
      {
        id: topicFraud,
        systemId: banking,
        containerId: broker,
        name: 'fraud.flagged',
        description: 'Suspicious payment raised by scoring.',
        type: 'component',
        kind: 'channel',
        protocol: 'kafka',
        schemaFormat: 'avro',
        compatibility: 'backward',
        valueSchema: avroRecord(
          'FraudFlagged',
          '    { "name": "paymentId", "type": "string" },\n    { "name": "reason", "type": "string" }'
        ),
        position: { x: 0, y: 360 },
        connections: [],
      },

      // —— Controllers ——
      {
        id: authCtrl,
        systemId: banking,
        containerId: api,
        name: 'Auth Controller',
        description: 'Maps /api/auth/* to Auth Service.',
        technology: 'spring',
        url: '',
        type: 'component',
        position: { x: 340, y: 0 },
        connections: [
          conn(authSvc, { label: 'delegates to', ...H.right }),
          conn(security, { label: 'uses', ...H.down }),
        ],
      },
      {
        id: accountsCtrl,
        systemId: banking,
        containerId: api,
        name: 'Accounts Controller',
        description: 'Maps /api/accounts to Accounts Service.',
        technology: 'spring',
        url: '',
        type: 'component',
        position: { x: 340, y: 260 },
        connections: [
          conn(accountsSvc, { label: 'delegates to', ...H.right }),
          conn(security, { label: 'uses', ...H.up }),
        ],
      },
      {
        id: paymentsCtrl,
        systemId: banking,
        containerId: api,
        name: paymentsCtrlName,
        description: 'Maps /api/payments to Payments Service.',
        technology: 'spring',
        url: '',
        type: 'component',
        position: { x: 340, y: 560 },
        connections: [
          conn(paymentsSvc, { label: 'delegates to', ...H.right }),
          conn(security, { label: 'uses', ...H.up }),
        ],
      },

      // —— Domain services ——
      {
        id: authSvc,
        systemId: banking,
        containerId: api,
        name: authSvcName,
        description: 'Credential check, session creation. Double-click for code.',
        technology: 'spring',
        url: '',
        type: 'component',
        documentationId: docAuth,
        position: { x: 700, y: 0 },
        connections: [
          conn(userRepo, { label: 'loads users via', ...H.right }),
          conn(security, { label: 'hashes passwords via', ...H.down }),
        ],
      },
      {
        id: security,
        systemId: banking,
        containerId: api,
        name: 'Security Component',
        description: 'Password hashing, JWT issue/verify, authorization helpers.',
        technology: 'spring',
        url: '',
        type: 'component',
        position: { x: 700, y: 170 },
        connections: [],
      },
      {
        id: accountsSvc,
        systemId: banking,
        containerId: api,
        name: 'Accounts Service',
        description: 'Reads local account projections; enriches from mainframe when needed.',
        technology: 'spring',
        url: '',
        type: 'component',
        position: { x: 700, y: 340 },
        connections: [
          conn(accountRepo, { label: 'reads via', ...H.right }),
          conn(facade, { label: 'enriches via', ...H.down }),
        ],
      },
      {
        id: paymentsSvc,
        systemId: banking,
        containerId: api,
        name: paymentsSvcName,
        description: 'Orchestrates transfer: local tx log + core ledger via façade.',
        technology: 'spring',
        url: '',
        type: 'component',
        position: { x: 700, y: 540 },
        connections: [
          conn(paymentRepo, { label: 'persists via', ...H.right }),
          conn(accountRepo, { label: 'locks balances via', ...H.up }),
          conn(facade, { label: 'posts to ledger via', ...H.down }),
        ],
      },
      {
        id: facade,
        systemId: banking,
        containerId: api,
        name: facadeName,
        description: 'XML/HTTPS adapter to the core banking mainframe.',
        technology: 'java',
        url: '',
        type: 'component',
        position: { x: 700, y: 740 },
        connections: [],
      },

      // —— Persistence adapters ——
      {
        id: userRepo,
        systemId: banking,
        containerId: api,
        name: 'User Repository',
        description: 'JDBC access to users + sessions tables.',
        technology: 'java',
        url: '',
        type: 'component',
        position: { x: 1060, y: 0 },
        connections: [],
      },
      {
        id: accountRepo,
        systemId: banking,
        containerId: api,
        name: 'Account Repository',
        description: 'JDBC access to accounts table.',
        technology: 'java',
        url: '',
        type: 'component',
        position: { x: 1060, y: 340 },
        connections: [],
      },
      {
        id: paymentRepo,
        systemId: banking,
        containerId: api,
        name: 'Payment Repository',
        description: 'JDBC access to transactions table.',
        technology: 'java',
        url: '',
        type: 'component',
        position: { x: 1060, y: 540 },
        connections: [],
      },

      // —— ER schema (Database container) ——
      {
        id: tSessions,
        systemId: banking,
        containerId: db,
        name: 'sessions',
        description: 'Issued access tokens / refresh sessions.',
        technology: '',
        url: '',
        type: 'component',
        position: { x: 40, y: 40 },
        columns: [sessionsId, sessionsUserId, sessionsToken, sessionsExpires],
        connections: [
          conn(tUsers, {
            label: 'user_id → id',
            foreignKey: {
              sourceColumnId: sessionsUserId.id,
              targetColumnId: usersId.id,
            },
            ...H.tableRight,
          }),
        ],
      },
      {
        id: tUsers,
        systemId: banking,
        containerId: db,
        name: 'users',
        description: 'Registered internet-banking customers.',
        technology: '',
        url: '',
        type: 'component',
        position: { x: 480, y: 40 },
        columns: [usersId, usersEmail, usersHash, usersCreated],
        connections: [],
      },
      {
        id: tTx,
        systemId: banking,
        containerId: db,
        name: 'transactions',
        description: 'Payment / transfer ledger entries.',
        technology: '',
        url: '',
        type: 'component',
        position: { x: 40, y: 360 },
        columns: [txId, txAccountId, txAmount, txType, txCreated],
        connections: [
          conn(tAccounts, {
            label: 'account_id → id',
            foreignKey: {
              sourceColumnId: txAccountId.id,
              targetColumnId: accountsId.id,
            },
            ...H.tableRight,
          }),
        ],
      },
      {
        id: tAccounts,
        systemId: banking,
        containerId: db,
        name: 'accounts',
        description: 'Customer bank accounts (local projection).',
        technology: '',
        url: '',
        type: 'component',
        position: { x: 480, y: 360 },
        columns: [accountsId, accountsUserId, accountsIban, accountsBalance, accountsCurrency],
        connections: [
          conn(tUsers, {
            label: 'user_id → id',
            foreignKey: {
              sourceColumnId: accountsUserId.id,
              targetColumnId: usersId.id,
            },
            // Same column as users (above); RF routes from right handle upward.
            ...H.tableRight,
          }),
        ],
      },
    ],
    codeElements: [
      {
        id: authServiceClass,
        systemId: banking,
        containerId: api,
        componentId: authSvc,
        name: 'AuthenticationService',
        description: 'Validates credentials and creates sessions.',
        technology: 'java',
        url: '',
        type: 'code',
        codeType: 'class',
        code: `public class AuthenticationService {
  private final UserRepository users;
  private final PasswordHasher hasher;

  public SessionToken login(String email, String password) {
    User user = users.findByEmail(email)
        .orElseThrow(UnauthorizedException::new);
    if (!hasher.matches(password, user.passwordHash())) {
      throw new UnauthorizedException();
    }
    return users.createSession(user.id());
  }
}`,
        position: { x: 80, y: 80 },
        connections: [conn(passwordHasher, { label: 'uses', ...H.right })],
      },
      {
        id: passwordHasher,
        systemId: banking,
        containerId: api,
        componentId: authSvc,
        name: 'PasswordHasher',
        description: 'BCrypt hash + verify.',
        technology: 'java',
        url: '',
        type: 'code',
        codeType: 'class',
        code: `public interface PasswordHasher {
  String hash(String raw);
  boolean matches(String raw, String hash);
}`,
        position: { x: 420, y: 80 },
        connections: [],
      },
    ],
    dataFlows: [
      {
        id: flowSignIn,
        name: 'Customer signs in',
        description:
          'Credentials travel from the browser to the API and back as a session token. Play it to watch the path light up on the diagram.',
        steps: [
          flowStep('Submits credentials', spa, gateway, {
            description: 'POST /api/auth/login from the browser.',
            endpointIds: [epLogin],
          }),
          flowStep('Routes to the API', gateway, api),
          flowStep('Loads the user record', api, db, {
            description: 'User lookup + password hash verification.',
          }),
          flowStep('Stores the session', api, cache, {
            description: 'Session token cached with a short TTL.',
          }),
          flowStep('Returns the token', api, gateway),
          flowStep('Signs the customer in', gateway, spa),
        ],
        modelVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: flowPayment,
        name: 'Payment leaves the bank',
        description:
          'A transfer is written locally, settled through the core ledger, then fanned out to notifications and fraud scoring.',
        steps: [
          flowStep('Submits a transfer', spa, gateway, {
            description: 'POST /api/payments with amount and target IBAN.',
            endpointIds: [epPayments],
          }),
          flowStep('Routes to the API', gateway, api),
          flowStep('Writes the transaction', api, db, {
            description: 'Local transaction log entry, status = pending.',
          }),
          flowStep('Publishes payment.requested', api, broker, {
            channelIds: [topicRequested],
          }),
          flowStep('Notifies the customer', broker, notifications, {
            description: 'Receipt e-mail — runs in parallel with fraud scoring.',
            channelIds: [topicSettled],
            parallelGroupId: 'fan-out',
          }),
          flowStep('Confirms to the browser', api, gateway),
          flowStep('Shows the receipt', gateway, spa),
        ],
        modelVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  } as unknown as FlatC4Model;

  const docs: StarterDocSeed[] = [
    {
      id: docWriting,
      ownerType: 'container',
      ownerId: spa,
      title: 'How to write docs here',
      markdown: [
        '# Writing documentation',
        '',
        'Documentation lives **on the element it describes**. Click the page icon on any',
        'card to open the editor; what you write stays attached to that system, service,',
        'component or class, and travels with the model on export.',
        '',
        '## The editor',
        '',
        '- Plain Markdown with a live preview — headings, lists, tables, code fences.',
        '- `Cmd/Ctrl + S` saves; docs are versioned with the project.',
        '- An element can hold several documents (design note, runbook, ADR).',
        '',
        '## What Markdown gives you',
        '',
        '| Element | Syntax | Renders as |',
        '| --- | --- | --- |',
        '| Heading | `## Title` | section heading |',
        '| Code | triple backticks + language | highlighted block |',
        '| Table | pipe-separated rows | editable table |',
        '| Link | `[text](url)` | link |',
        '',
        '## Embedding the model',
        '',
        'Two blocks connect prose to the diagram, so a document cannot quietly drift',
        'away from what is modelled:',
        '',
        '- **Sequence diagram** — insert a PlantUML sequence stored on a service and it',
        '  renders inline, always the current version.',
        '- **API endpoint** — reference an endpoint component and its method, path and',
        '  payloads come along.',
        '',
        'Example — the sign-in sequence attached to the API:',
        sequenceRef(loginSeq.id),
        '## A good page',
        '',
        '1. One paragraph on what this thing is for.',
        '2. What it talks to, and why.',
        '3. The decisions someone would otherwise have to reverse-engineer.',
        '4. A sequence or endpoint block instead of prose describing a call.',
        '',
      ].join('\n'),
    },
    {
      id: docGateway,
      ownerType: 'container',
      ownerId: gateway,
      title: 'API Gateway',
      markdown: [
        '# API Gateway',
        '',
        'Single entry point for browser, mobile and back-office traffic.',
        '',
        '## Responsibilities',
        '',
        '- TLS termination and HTTP/2.',
        '- Rate limiting per client and per endpoint.',
        '- Routing `/api/*` to the API application, `/admin/*` to the same API with an',
        '  elevated scope.',
        '',
        '## Operational notes',
        '',
        '```nginx',
        'limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;',
        'proxy_read_timeout 30s;',
        '```',
        '',
        'A 502 here almost always means the API pods are still rolling — check the',
        'deployment before looking at the gateway itself.',
        '',
      ].join('\n'),
    },
    {
      id: docNotifications,
      ownerType: 'container',
      ownerId: notifications,
      title: 'Notification Worker',
      markdown: [
        '# Notification Worker',
        '',
        'Consumes `payment.settled` from the event bus and sends the receipt e-mail.',
        '',
        '## Delivery rules',
        '',
        '- At-least-once consumption; the worker de-duplicates on `paymentId`.',
        '- Retries with exponential backoff, then a dead-letter topic after 5 attempts.',
        '- Templates live with the worker, not in the mail provider.',
        '',
        '## Related flow',
        '',
        'This worker is the fan-out branch of the **Payment leaves the bank** Magic flow —',
        'open Magic flows and press play to watch it run.',
        '',
      ].join('\n'),
    },
    {
      id: docBanking,
      ownerType: 'system',
      ownerId: banking,
      title: 'Internet Banking overview',
      markdown: [
        '# Internet Banking System',
        '',
        'Sample C4 model for personal internet banking: view accounts and move money.',
        '',
        '## Context',
        '',
        '- **Customers** use SPA / mobile against our API.',
        '- **Mainframe Banking System** is the system of record for balances.',
        '- **E-mail System** sends receipts and password-reset mail.',
        '',
        '## How to explore',
        '',
        '1. Double-click this system → container view (SPA, API, PostgreSQL).',
        '2. Open **API Application** → components + live sequence diagrams.',
        '3. Use the documentation badge on nodes that already have docs attached.',
        '',
      ].join('\n'),
    },
    {
      id: docApi,
      ownerType: 'container',
      ownerId: api,
      title: 'API Application',
      markdown: [
        '# API Application',
        '',
        'Spring JSON API: REST surface, domain services, JDBC repositories, and a mainframe façade.',
        '',
        '## Responsibilities',
        '',
        '- Authenticate customers and issue sessions/JWT.',
        '- Serve account projections from PostgreSQL; enrich from the mainframe when needed.',
        '- Orchestrate transfers: local transaction log + core ledger via façade.',
        '',
        '## Key flows',
        '',
        '### Sign-in',
        sequenceRef(loginSeq.id),
        '### Transfer between accounts',
        sequenceRef(paymentSeq.id),
        '## Next',
        '',
        'Drill into **Auth Service** for code-level notes, or open a sequence from the badge on this container.',
        '',
      ].join('\n'),
    },
    {
      id: docAuth,
      ownerType: 'component',
      ownerId: authSvc,
      title: 'Auth Service',
      markdown: [
        '# Auth Service',
        '',
        'Validates credentials, creates sessions, and coordinates password hashing via **Security Component**.',
        '',
        '## Flow',
        '',
        '1. `POST /api/auth/login` → Auth Controller → Auth Service.',
        '2. Load user via **User Repository**.',
        '3. Verify password hash; create session row.',
        '',
        '## Code',
        '',
        'Double-click this component for `AuthenticationService` / `PasswordHasher` stubs.',
        '',
        '## Related sequence',
        sequenceRef(loginSeq.id),
      ].join('\n'),
    },
  ];

  // Inline content so guest/local editor can open docs without /api.
  for (const doc of docs) {
    const inline = { id: doc.id, title: doc.title, markdown: doc.markdown };
    if (doc.ownerType === 'system') {
      const entity = model.systems.find((s) => s.id === doc.ownerId) as
        | (typeof model.systems)[number] & {
            documentation?: typeof inline;
            documentations?: Array<typeof inline>;
          }
        | undefined;
      if (entity) {
        entity.documentation = inline;
        entity.documentations = [inline];
      }
    } else if (doc.ownerType === 'container') {
      const entity = model.containers.find((c) => c.id === doc.ownerId) as
        | (typeof model.containers)[number] & {
            documentation?: typeof inline;
            documentations?: Array<typeof inline>;
          }
        | undefined;
      if (entity) {
        entity.documentation = inline;
        entity.documentations = [inline];
      }
    } else if (doc.ownerType === 'component') {
      const entity = model.components.find((c) => c.id === doc.ownerId) as
        | (typeof model.components)[number] & {
            documentation?: typeof inline;
            documentations?: Array<typeof inline>;
          }
        | undefined;
      if (entity) {
        entity.documentation = inline;
        entity.documentations = [inline];
      }
    }
  }

  return { model, docs };
}

export const STARTER_PROJECT_NAME = 'Internet Banking (sample)';
