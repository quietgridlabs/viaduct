import { Badge } from '@chakra-ui/react';
import { getIconComponent } from '@icons/TechnologyIcons';
import { Inbox, RadioTower, Split, Zap } from 'lucide-react';

/**
 * The verb-or-protocol badge, for every place one is shown: the contract
 * viewer, the channel viewer, the endpoint and channel cards on the canvas,
 * and the doc embeds. Those five used to draw it five different ways, and two
 * of them disagreed outright — AMQP was purple in one table and blue in the
 * other, and the canvas ignored both and painted every verb the same slate.
 *
 * What is drawn follows the model's own split rather than a taste call:
 *
 * - Anything in the method slot of an endpoint is a verb, WS and GRPC
 *   included — that is exactly how `EndpointExtras` defines them. A verb has
 *   no brand, its colour carries the meaning (green reads, red destroys), and
 *   that convention is older than this app.
 * - A channel protocol names a product, so it gets that product's mark on a
 *   neutral ground and lets the logo carry the colour.
 */

/** Chakra palettes; `.subtle` is the ground, `.fg` the ink. */
const VERB_TONES: Record<string, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  PATCH: 'orange',
  DELETE: 'red',
  WS: 'purple',
  WSS: 'purple',
  GRPC: 'teal',
};

/**
 * Brand marks come from the technology set, so a protocol is drawn exactly as
 * that technology is drawn elsewhere — dark-ground variants and all.
 *
 * Only where the brand's mark is a symbol. A logo that is itself the word
 * (aws, gRPC) says nothing the label beside it does not, and at this size says
 * it illegibly, so the rest take a glyph for what the protocol does: an
 * exchange fans out, MQTT broadcasts, NATS is the fast one, SQS is a queue.
 */
const PROTOCOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  KAFKA: getIconComponent('kafka'),
  'REDIS-STREAM': getIconComponent('redis'),
  AMQP: Split,
  MQTT: RadioTower,
  NATS: Zap,
  SQS: Inbox,
};

type Props = {
  method: string;
  /** Reserve a column so labels line up down the list. */
  minW?: string;
};

export default function MethodChip({ method, minW }: Props) {
  const key = (method || '').trim().toUpperCase();
  const Mark = PROTOCOL_ICONS[key];
  const tone = VERB_TONES[key];

  return (
    <Badge
      display="inline-flex"
      alignItems="center"
      gap="4px"
      flexShrink={0}
      minW={minW}
      h="18px"
      px="5px"
      borderRadius="4px"
      colorPalette={tone}
      variant={tone ? 'subtle' : 'surface'}
      bg={tone ? undefined : 'bg.muted'}
      color={tone ? undefined : 'fg.default'}
      fontSize="10px"
      fontWeight="700"
      fontFamily="mono"
      letterSpacing="0.04em"
      textTransform="uppercase"
      lineHeight="1"
    >
      {Mark ? <Mark size={12} /> : null}
      {method}
    </Badge>
  );
}
