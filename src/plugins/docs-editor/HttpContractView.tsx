import { Box, HStack, Tabs, Text } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isJsonMedia,
  mediaTypeFor,
  parseHttpContract,
  statusClass,
  statusTextFor,
  type HttpBody,
  type HttpContractSide,
  type HttpParam,
} from '@components/common/HttpContract';
import ContractBody from './ContractBody';

/**
 * An endpoint contract as documentation reads it: parameters as parameters,
 * one tab per status, and the payload through the same viewers the editor uses.
 *
 * The stored text carries its own tags (`@query`, `@response 404`,
 * `@body application/json`), and printing them raw put the whole contract in
 * one grey block — no highlighting, since a document starting with `@response`
 * is not JSON, and no way to tell the 200 from the 500 without reading for the
 * next tag. The editor already parses this text; so does the page now.
 */

type Props = {
  raw: string;
  side: HttpContractSide;
  /** WebSocket and gRPC carry messages, never statuses. */
  channel?: boolean;
  /** Unique within the page — Monaco keys its models by path. */
  modelId: string;
};

/** Tagged text is the format we can take apart; anything else stays as written. */
const TAGGED_RE = /^@(path|query|header|body|schema|status|response|message|description)\b/im;

const STATUS_COLOR: Record<ReturnType<typeof statusClass>, string> = {
  success: 'green.400',
  redirect: 'blue.400',
  client: 'orange.400',
  server: 'red.400',
  info: 'fg.muted',
};

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="4px">
      {children}
    </Text>
  );
}

/** One parameter per row, the way a spec prints it: name, type, then meaning. */
function ParamRows({ label, params }: { label: string; params: HttpParam[] }) {
  const { t } = useTranslation();
  if (!params.length) return null;
  return (
    <Box>
      <Caption>{label}</Caption>
      <Box display="flex" flexDirection="column" gap="2px">
        {params.map((param) => (
          <HStack key={param.id} gap="8px" align="baseline" flexWrap="wrap">
            <Text fontSize="xs" fontFamily="mono" fontWeight="600" color="fg.default">
              {param.name}
            </Text>
            <Text fontSize="10px" fontFamily="mono" color="fg.muted">
              {param.type}
            </Text>
            {param.required ? (
              <Text fontSize="10px" color="orange.400">
                {t('http_param_required')}
              </Text>
            ) : null}
            {param.example ? (
              <Text fontSize="10px" fontFamily="mono" color="fg.subtle">
                {`= ${param.example}`}
              </Text>
            ) : null}
            {param.description ? (
              <Text fontSize="xs" color="fg.muted" flex="1" minW="120px">
                {param.description}
              </Text>
            ) : null}
          </HStack>
        ))}
      </Box>
    </Box>
  );
}

function BodyBlock({ body, modelId }: { body: HttpBody; modelId: string }) {
  const { t } = useTranslation();
  const example = body.example.trim();
  const schema = body.schema.trim();
  const media = mediaTypeFor(body.media);
  if (!media && !example && !schema) return null;

  return (
    <Box>
      <HStack gap="6px" mb="4px" align="baseline" flexWrap="wrap">
        <Text fontSize="xs" fontWeight="600" color="fg.muted">
          {t('http_body')}
        </Text>
        <Text fontSize="10px" fontFamily="mono" color="fg.muted">
          {media || t('http_body_none')}
        </Text>
      </HStack>
      {example ? (
        <ContractBody
          value={example}
          viewer={isJsonMedia(body.media) ? 'json' : null}
          modelId={`${modelId}-example`}
        />
      ) : null}
      {schema ? (
        <Box mt={example ? '6px' : '0'}>
          <Caption>{t('http_body_schema')}</Caption>
          <ContractBody value={schema} viewer="json" modelId={`${modelId}-schema`} />
        </Box>
      ) : null}
    </Box>
  );
}

export default function HttpContractView({ raw, side, channel = false, modelId }: Props) {
  const { t } = useTranslation();
  const contract = useMemo(
    () => (TAGGED_RE.test(raw) ? parseHttpContract(raw, side, { channel }) : null),
    [raw, side, channel]
  );

  /* Free text and bare payloads never had tags to take apart — the old plain
     block is still the honest way to show them. */
  if (!contract) {
    const trimmed = raw.trim();
    const json = trimmed.startsWith('{') || trimmed.startsWith('[');
    return <ContractBody value={raw} viewer={json ? 'json' : null} modelId={modelId} />;
  }

  if (contract.mode === 'channel') {
    if (!contract.messages.length) {
      return <ContractBody value={raw} viewer={null} modelId={modelId} />;
    }
    return (
      <Tabs.Root defaultValue="0" size="sm" variant="line" colorPalette="gray">
        <Tabs.List borderColor="border.default" gap="4px" flexWrap="wrap">
          {contract.messages.map((message, index) => (
            <Tabs.Trigger key={message.id} value={String(index)} px="8px" fontSize="xs">
              {message.name || t('http_message_name')}
            </Tabs.Trigger>
          ))}
          <Tabs.Indicator bg="bg.neutral.emphasis" height="2px" bottom="-1px" />
        </Tabs.List>
        {contract.messages.map((message, index) => (
          <Tabs.Content key={message.id} value={String(index)} pt="8px">
            <Box display="flex" flexDirection="column" gap="8px">
              {message.description ? (
                <Text fontSize="xs" color="fg.muted">
                  {message.description}
                </Text>
              ) : null}
              <BodyBlock body={message.body} modelId={`${modelId}-m${index}`} />
            </Box>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    );
  }

  if (contract.side === 'request') {
    const body = contract.body;
    /* `@query` with only a comment under it parses to nothing at all — which
       is a fact about the endpoint, and better said than shown as a blank. */
    if (!contract.params.length && body.media === 'none' && !body.example.trim() && !body.schema.trim()) {
      return (
        <Text fontSize="xs" color="fg.muted">
          {t('http_contract_empty')}
        </Text>
      );
    }
    return (
      <Box display="flex" flexDirection="column" gap="10px">
        <ParamRows
          label={t('http_tab_path')}
          params={contract.params.filter((p) => p.in === 'path')}
        />
        <ParamRows
          label={t('http_tab_query')}
          params={contract.params.filter((p) => p.in === 'query')}
        />
        <ParamRows
          label={t('http_tab_headers')}
          params={contract.params.filter((p) => p.in === 'header')}
        />
        <BodyBlock body={contract.body} modelId={`${modelId}-body`} />
      </Box>
    );
  }

  /* One tab per status: the failures are the half people come here for, and
     under a single block they were below the fold of the success payload. */
  return (
    <Tabs.Root defaultValue="0" size="sm" variant="line" colorPalette="gray">
      <Tabs.List borderColor="border.default" gap="4px" flexWrap="wrap">
        {contract.responses.map((response, index) => (
          <Tabs.Trigger
            key={response.id}
            value={String(index)}
            px="8px"
            fontSize="xs"
            fontFamily="mono"
            color={STATUS_COLOR[statusClass(response.status)]}
          >
            {response.status}
          </Tabs.Trigger>
        ))}
        <Tabs.Indicator bg="bg.neutral.emphasis" height="2px" bottom="-1px" />
      </Tabs.List>
      {contract.responses.map((response, index) => (
        <Tabs.Content key={response.id} value={String(index)} pt="8px">
          <Box display="flex" flexDirection="column" gap="8px">
            <HStack gap="6px" align="baseline" flexWrap="wrap">
              <Text
                fontSize="xs"
                fontFamily="mono"
                fontWeight="600"
                color={STATUS_COLOR[statusClass(response.status)]}
              >
                {`${response.status} ${statusTextFor(response.status, '')}`.trim()}
              </Text>
              {response.description ? (
                <Text fontSize="xs" color="fg.muted">
                  {response.description}
                </Text>
              ) : null}
            </HStack>
            <ParamRows label={t('http_response_headers')} params={response.headers} />
            <BodyBlock body={response.body} modelId={`${modelId}-r${index}`} />
          </Box>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
