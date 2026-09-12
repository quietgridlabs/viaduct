import MethodChip from '@components/common/MethodChip';
import { isGrpcMethod, isWebSocketMethod } from '@/types/c4Extensions';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ContractBody from './ContractBody';
import HttpContractView from './HttpContractView';
import type { ResolvedEndpointRef } from './endpointRefs';
import { sniffContractViewer } from './embedLanguage';

type Props = {
  endpoint?: ResolvedEndpointRef | null;
  missing?: boolean;
  onOpen?: () => void;
};

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="4px">
        {label}
      </Text>
      {children}
    </Box>
  );
}

/** Read-only live preview of an API endpoint referenced from documentation. */
export default function EndpointEmbed({ endpoint, missing, onOpen }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const method = endpoint?.method || 'GET';
  const path = endpoint?.endpoint || '/';
  /* A WebSocket or an RPC answers with messages, so there are no statuses to
     put in tabs — the verb is what says which. */
  const messageBased = isWebSocketMethod(method) || isGrpcMethod(method);

  const unresolved = missing || !endpoint;
  const hasDetails = Boolean(
    endpoint &&
      (endpoint.description?.trim() ||
        endpoint.headers?.trim() ||
        endpoint.request?.trim() ||
        endpoint.response?.trim())
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
          <MethodChip method={method} />
          <Text fontSize="sm" fontWeight="600" fontFamily="mono" color="fg.default" truncate>
            {path}
          </Text>
          {endpoint?.name && endpoint.name !== path ? (
            <Text fontSize="xs" color="fg.muted" truncate>
              {endpoint.name}
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
          {t('documentation_endpoint_missing')}
        </Box>
      ) : open ? (
        <Box p="12px" display="flex" flexDirection="column" gap="10px">
          {endpoint.description?.trim() ? (
            <Text fontSize="sm" color="fg.default" whiteSpace="pre-wrap">
              {endpoint.description}
            </Text>
          ) : null}
          {endpoint.headers?.trim() ? (
            <Section label={t('endpoint_headers')}>
              <ContractBody
                value={endpoint.headers}
                viewer={sniffContractViewer(endpoint.headers)}
                modelId={`endpoint-${endpoint.id}-headers`}
              />
            </Section>
          ) : null}
          {endpoint.request?.trim() ? (
            <Section label={t('endpoint_request')}>
              <HttpContractView
                raw={endpoint.request}
                side="request"
                channel={messageBased}
                modelId={`endpoint-${endpoint.id}-request`}
              />
            </Section>
          ) : null}
          {endpoint.response?.trim() ? (
            <Section label={t('endpoint_response')}>
              <HttpContractView
                raw={endpoint.response}
                side="response"
                channel={messageBased}
                modelId={`endpoint-${endpoint.id}-response`}
              />
            </Section>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
