import { ColorModeProvider } from '@contexts/ColorModeContext';
import { fireEvent, render, screen } from '@testing-library/react';
import ChannelEmbed from '../ChannelEmbed';
import EndpointEmbed from '../EndpointEmbed';
import UiEmbed from '../UiEmbed';
import type { ResolvedChannelRef } from '../channelRefs';
import type { ResolvedEndpointRef } from '../endpointRefs';
import type { ResolvedUiRef } from '../uiRefs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/* Monaco does not tokenise under jsdom, so the viewers stand in for it: what
   this file checks is which one each contract body is handed to. */
jest.mock('@components/common/JsonViewer', () => ({
  __esModule: true,
  default: ({ value, modelId }: { value: unknown; modelId: string }) => (
    <div data-testid="json-viewer" data-model-id={modelId}>
      {typeof value === 'string' ? value : JSON.stringify(value)}
    </div>
  ),
}));

jest.mock('@components/common/ProtoViewer', () => ({
  __esModule: true,
  default: ({ value, modelId }: { value: string; modelId: string }) => (
    <div data-testid="proto-viewer" data-model-id={modelId}>
      {value}
    </div>
  ),
}));

const channel: ResolvedChannelRef = {
  id: 'topic1',
  name: 'payment.requested',
  protocol: 'kafka',
  schemaFormat: 'avro',
  surface: 'Topic',
  valueSchema: '@format avro\n@name PaymentRequested\n\n{ "type": "record" }',
  headersSchema: '@format protobuf\n\nmessage H { string trace = 1; }',
  containerId: 'broker',
};

const endpoint: ResolvedEndpointRef = {
  id: 'ep1',
  name: 'Login',
  method: 'POST',
  endpoint: '/api/login',
  request: '{ "email": "a@b.c" }',
  response: 'Proxy response from BaaS',
  containerId: 'svc',
};

/* What the API stores today: tagged text, one block per status. */
const tagged: ResolvedEndpointRef = {
  id: 'ep2',
  name: 'Regions',
  method: 'GET',
  endpoint: '/api/regions',
  request: '@query\nregionId: string!  # Which region',
  response: [
    '@response 200 OK',
    '@body application/json',
    '[{ "id": "moscow" }]',
    '',
    '@response 500 Internal Server Error',
    '@description Failed to list regions',
    '@body text/plain',
    'failed to list regions',
  ].join('\n'),
  containerId: 'svc',
};

const uiElement: ResolvedUiRef = {
  id: 'screen',
  name: 'Subscriptions',
  designSystem: 'public-web',
  design: [
    '@design https://figma.com/design/8Kd2/Weather?node-id=12-345',
    '@state default',
    '@state loading  # skeleton, width must not jump',
    '',
    '@composes',
    'content: RegionPicker, PlanCard',
  ].join('\n'),
  containerId: 'web',
};

describe('documentation embeds render contracts with the editor viewers', () => {
  it('sends each channel schema to the viewer its own @format asks for', () => {
    render(
      <ColorModeProvider>
        <ChannelEmbed channel={channel} />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getByRole('button'));

    // Avro value → JSON viewer; the protobuf headers side → proto viewer.
    expect(screen.getByTestId('json-viewer')).toHaveAttribute(
      'data-model-id',
      'channel-topic1-value'
    );
    expect(screen.getByTestId('proto-viewer')).toHaveAttribute(
      'data-model-id',
      'channel-topic1-headers'
    );
  });

  it('parses a JSON body before handing it over, and leaves prose as text', () => {
    render(
      <ColorModeProvider>
        <EndpointEmbed endpoint={endpoint} />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getByRole('button'));

    const viewers = screen.getAllByTestId('json-viewer');
    expect(viewers).toHaveLength(1);
    expect(viewers[0]).toHaveAttribute('data-model-id', 'endpoint-ep1-request');

    // The sentence never reaches a viewer — it stays a plain block.
    const prose = screen.getByText('Proxy response from BaaS');
    expect(prose.tagName).toBe('PRE');
  });

  /* A screen's states are the half nobody draws, so they are tabs rather than
     a paragraph — the same shape an endpoint's statuses take. */
  it('shows a UI element as its states, with the node linked out', () => {
    render(
      <ColorModeProvider>
        <UiEmbed element={uiElement} />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'default' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'loading' })).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://figma.com/design/8Kd2/Weather?node-id=12-345');
    // What the screen is built from, named — these are elements that exist.
    expect(screen.getByText('RegionPicker')).toBeInTheDocument();
    expect(screen.getByText('PlanCard')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();

    // The tags never reach the page.
    expect(screen.queryByText(/@state/)).not.toBeInTheDocument();
    expect(screen.queryByText(/@composes/)).not.toBeInTheDocument();
  });

  /* The whole contract used to land in one grey block, tags and all: no
     highlighting, and no way to reach the 500 except by reading past the 200. */
  it('takes a tagged contract apart — a tab per status, the payload highlighted', () => {
    render(
      <ColorModeProvider>
        <EndpointEmbed endpoint={tagged} />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getAllByRole('button')[0]);

    // Each status is its own tab, and the failure is reachable without scrolling.
    expect(screen.getByRole('tab', { name: '200' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '500' })).toBeInTheDocument();

    // The 200 payload goes to the JSON viewer rather than a plain block…
    const viewer = screen.getByTestId('json-viewer');
    expect(viewer).toHaveAttribute('data-model-id', 'endpoint-ep2-response-r0-example');
    expect(viewer.textContent).toContain('moscow');

    // …and the tags themselves are gone from the page.
    expect(screen.queryByText(/@response/)).not.toBeInTheDocument();
    expect(screen.queryByText(/@body/)).not.toBeInTheDocument();

    // The request reads as a parameter, not as a line of tagged text.
    expect(screen.getByText('regionId')).toBeInTheDocument();
    expect(screen.getByText('Which region')).toBeInTheDocument();
  });
});
