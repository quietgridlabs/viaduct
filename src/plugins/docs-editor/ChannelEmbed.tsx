import MethodChip from '@components/common/MethodChip';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseChannelSchema, type ChannelSchemaSide } from '@components/common/ChannelContract';
import type { ResolvedChannelRef } from './channelRefs';
import ContractBody from './ContractBody';
import { channelSchemaViewer } from './embedLanguage';

type Props = {
  channel?: ResolvedChannelRef | null;
  missing?: boolean;
  onOpen?: () => void;
};

/**
 * One side of the message. The stored text carries its own `@format`/`@name`
 * tags, so the heading shows those rather than the channel-wide default —
 * a value in Avro next to headers in JSON Schema is legal and should read that way.
 */
function SchemaSection({
  label,
  raw,
  side,
  fallbackFormat,
  modelId,
}: {
  label: string;
  raw: string;
  side: ChannelSchemaSide;
  fallbackFormat: string;
  modelId: string;
}) {
  const contract = parseChannelSchema(raw, side, fallbackFormat as never);
  const source = contract.source.trim() || raw.trim();
  return (
    <Box>
      <HStack gap="6px" mb="4px" align="baseline" flexWrap="wrap">
        <Text fontSize="xs" fontWeight="600" color="fg.muted">
          {label}
        </Text>
        <Text fontSize="10px" fontFamily="mono" color="fg.muted">
          {contract.format}
        </Text>
        {contract.name ? (
          <Text fontSize="xs" fontWeight="600" color="fg.default" truncate>
            {contract.name}
          </Text>
        ) : null}
      </HStack>
      <ContractBody
        value={source}
        viewer={channelSchemaViewer(contract.format)}
        modelId={modelId}
      />
    </Box>
  );
}

/** Read-only live preview of a broker channel referenced from documentation. */
export default function ChannelEmbed({ channel, missing, onOpen }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const unresolved = missing || !channel;
  const hasDetails = Boolean(
    channel &&
      (channel.description?.trim() ||
        channel.keySchema?.trim() ||
        channel.valueSchema?.trim() ||
        channel.headersSchema?.trim())
  );
  const collapsible = !unresolved && hasDetails;
  const toggle = () => setOpen((current) => !current);

  return (
    <Box
      my="10px"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="8px"
      overflow="hidden"
      bg="bg.dialog"
    >
      <HStack
        px="10px"
        py="6px"
        borderBottomWidth={unresolved || open ? '1px' : '0'}
        borderColor="border.default"
        gap="8px"
        align="center"
        flexWrap="wrap"
        justify="space-between"
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        aria-label={collapsible ? (open ? t('collapse') : t('expand')) : undefined}
        cursor={collapsible ? 'pointer' : 'default'}
        _hover={collapsible ? { bg: 'bg.list.hover' } : undefined}
        onClick={collapsible ? toggle : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
      >
        <HStack gap="8px" align="center" minW={0} flex="1">
          {collapsible ? (
            <Box color="fg.muted" flexShrink={0} display="flex" alignItems="center">
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Box>
          ) : null}
          <MethodChip method={channel?.protocol || 'kafka'} />
          <Text fontSize="sm" fontWeight="600" fontFamily="mono" color="fg.default" truncate>
            {channel?.name || t('channel_name')}
          </Text>
          {channel ? (
            <Text fontSize="xs" color="fg.muted" truncate>
              {channel.surface}
            </Text>
          ) : null}
        </HStack>
        {onOpen && !unresolved ? (
          <Button
            size="xs"
            variant="ghost"
            flexShrink={0}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <ExternalLink size={12} />
            {t('catalog_show_on_diagram')}
          </Button>
        ) : null}
      </HStack>

      {unresolved ? (
        <Box p="12px" fontSize="sm" color="fg.muted">
          {t('documentation_channel_missing')}
        </Box>
      ) : open ? (
        <Box p="12px" display="flex" flexDirection="column" gap="10px">
          {channel.description?.trim() ? (
            <Text fontSize="sm" color="fg.default" whiteSpace="pre-wrap">
              {channel.description}
            </Text>
          ) : null}
          {channel.keySchema?.trim() ? (
            <SchemaSection
              label={t('channel_key_schema')}
              raw={channel.keySchema}
              side="key"
              fallbackFormat={channel.schemaFormat}
              modelId={`channel-${channel.id}-key`}
            />
          ) : null}
          {channel.valueSchema?.trim() ? (
            <SchemaSection
              label={t('channel_value_schema')}
              raw={channel.valueSchema}
              side="value"
              fallbackFormat={channel.schemaFormat}
              modelId={`channel-${channel.id}-value`}
            />
          ) : null}
          {channel.headersSchema?.trim() ? (
            <SchemaSection
              label={t('channel_headers_schema')}
              raw={channel.headersSchema}
              side="headers"
              fallbackFormat={channel.schemaFormat}
              modelId={`channel-${channel.id}-headers`}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
