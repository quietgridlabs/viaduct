import { buildC4Catalog } from '../../plugins/sequence-editor/host/c4Catalog';
import { parsePlantUmlSequence } from '../../plugins/sequence-editor/plantuml/parser';
import { buildStarterBundle, buildStarterModel } from '../templates/starterModel';
import type {
  DataFlowExtras,
  DocumentationExtras,
  SequenceDiagramExtras,
} from '@/types/c4Extensions';


describe('starterModel sequences', () => {
  it('parses login/payment against API container C4 catalog without errors', () => {
    const model = buildStarterModel();
    const api = model.containers.find((c) => c.name === 'API Application');
    expect(api).toBeTruthy();

    const catalog = buildC4Catalog({
      model,
      ownerType: 'container',
      ownerId: api!.id,
    });
    const allowed = catalog.map((p) => p.id);
    expect(allowed).toContain('Customer');
    expect(allowed).toContain('Single_Page_Application');
    expect(allowed).toContain('API_Application');
    expect(allowed).toContain('Auth_Service');
    expect(allowed).toContain('PostgreSQL');

    const diagrams = (api as SequenceDiagramExtras).sequenceDiagrams ?? [];
    expect(diagrams.length).toBe(2);

    for (const d of diagrams) {
      const result = parsePlantUmlSequence(d.plantUmlSource, {
        strictParticipants: true,
        allowedParticipantIds: allowed,
      });
      const errors = result.diagnostics.filter((x) => x.severity === 'error');
      expect(errors).toEqual([]);
      expect(result.ok).toBe(true);
    }

    // Front ends reach the API through the gateway.
    const spa = model.containers.find((c) => c.name === 'Single-Page Application');
    const gateway = model.containers.find((c) => c.name === 'API Gateway');
    expect(spa?.connections?.some((c) => c.targetId === gateway!.id)).toBe(true);
    expect(spa?.connections?.[0]?.sourceHandle).toBe('source-right-0');
    expect(gateway?.connections?.some((c) => c.targetId === api!.id)).toBe(true);

    const login = model.components.find((c) => c.endpoint === '/api/auth/login');
    expect(login?.connections?.length).toBeGreaterThan(0);
    expect(login?.connections?.[0]?.sourceHandle).toBe('source-right-0');
    expect(login?.connections?.[0]?.targetHandle).toBe('target-left-0');
  });

  it('seeds documentation bound to banking system, API, and Auth Service', () => {
    const { model, docs } = buildStarterBundle();
    expect(docs.length).toBeGreaterThanOrEqual(3);

    const banking = model.systems.find((s) => s.name === 'Internet Banking System');
    const api = model.containers.find((c) => c.name === 'API Application');
    const auth = model.components.find((c) => c.name === 'Auth Service');
    expect((banking as DocumentationExtras | undefined)?.documentationId).toBeTruthy();
    expect((api as DocumentationExtras | undefined)?.documentationId).toBeTruthy();
    expect((auth as DocumentationExtras | undefined)?.documentationId).toBeTruthy();
    expect((banking as DocumentationExtras | undefined)?.documentation?.markdown).toContain(
      'Internet Banking System'
    );
    expect((api as DocumentationExtras | undefined)?.documentation?.markdown).toContain(
      'c4-sequence'
    );

    const byOwner = Object.fromEntries(docs.map((d) => [d.ownerId, d]));
    expect(byOwner[banking!.id]?.id).toBe((banking as DocumentationExtras).documentationId);
    expect(byOwner[api!.id]?.id).toBe((api as DocumentationExtras).documentationId);
    expect(byOwner[auth!.id]?.id).toBe((auth as DocumentationExtras).documentationId);

    const diagrams = (api as SequenceDiagramExtras).sequenceDiagrams ?? [];
    const loginId = diagrams.find((d) => d.name === 'Customer signs in')?.id;
    const paymentId = diagrams.find((d) => d.name === 'Transfer between accounts')?.id;
    expect(loginId).toBeTruthy();
    expect(paymentId).toBeTruthy();
    expect(byOwner[api!.id]?.markdown).toContain(`id: ${loginId}`);
    expect(byOwner[api!.id]?.markdown).toContain(`id: ${paymentId}`);
    expect(byOwner[auth!.id]?.markdown).toContain(`id: ${loginId}`);
  });

  it('seeds magic flows whose steps reference real containers', () => {
    const model = buildStarterModel();
    const flows = (model as DataFlowExtras).dataFlows ?? [];
    expect(flows.length).toBeGreaterThanOrEqual(2);

    const containerIds = new Set(model.containers.map((c) => c.id));
    for (const flow of flows) {
      expect(flow.steps.length).toBeGreaterThan(2);
      for (const step of flow.steps) {
        expect(containerIds.has(step.from.id)).toBe(true);
        expect(containerIds.has(step.to.id)).toBe(true);
      }
    }
  });
});
