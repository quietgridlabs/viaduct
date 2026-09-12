import { Box, Button, HStack, Link, Tabs, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight, ExternalLink, Frame } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseDesignContract } from '@components/common/DesignContract';
import { resolveNodeHref } from '@utils/designNodeRef';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import type { ModelWithDesignSystems } from '@/types/c4Extensions';
import type { ResolvedUiRef } from './uiRefs';

type Props = {
  element?: ResolvedUiRef | null;
  missing?: boolean;
  onOpen?: () => void;
};

/**
 * Read-only live preview of a UI element referenced from documentation.
 *
 * The states are the point. A screen's design is one picture in the design
 * tool and four or five states in practice, and the ones nobody drew are the
 * ones that get built wrong — so they are tabs here, the way an endpoint's
 * statuses are, rather than a paragraph someone skims.
 */
export default function UiEmbed({ element, missing, onOpen }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const model = useFlatC4Store((state) => state.model);

  const contract = useMemo(() => parseDesignContract(element?.design || ''), [element?.design]);
  const unresolved = missing || !element;
  const hasDetails = Boolean(
    element &&
      (element.description?.trim() ||
        contract.node ||
        contract.states.length ||
        contract.props.length)
  );
  const collapsible = !unresolved && hasDetails;
  const toggle = () => setOpen((current) => !current);

  /* `public-web#7:25` is a link too — the design system it names knows the
     file. Rendering it as bare text was the one place the short form looked
     like a worse way of saying the same thing. */
  const nodeHref = resolveNodeHref(model as ModelWithDesignSystems, contract.node);

  /* Consecutive entries sharing a slot read as one row, the way they were
     written. */
  const composedBySlot = useMemo(() => {
    const rows: { slot: string; names: string[] }[] = [];
    for (const entry of contract.composes) {
      const last = rows[rows.length - 1];
      if (last && last.slot === entry.slot) last.names.push(entry.name);
      else rows.push({ slot: entry.slot, names: [entry.name] });
    }
    return rows;
  }, [contract.composes]);

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
          <Box color="fg.muted" flexShrink={0} lineHeight={0}>
            <Frame size={14} />
          </Box>
          <Text fontSize="sm" fontWeight="600" color="fg.default" truncate>
            {element?.name ?? ''}
          </Text>
          {element?.designSystem ? (
            <Text fontSize="xs" color="fg.muted" truncate>
              {element.designSystem}
            </Text>
          ) : null}
          {contract.states.length ? (
            <Text fontSize="xs" color="fg.subtle" flexShrink={0}>
              {t('design_states_count', { count: contract.states.length })}
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
          {t('documentation_ui_missing')}
        </Box>
      ) : open ? (
        <Box p="12px" display="flex" flexDirection="column" gap="10px">
          {element.description?.trim() ? (
            <Text fontSize="sm" color="fg.default" whiteSpace="pre-wrap">
              {element.description}
            </Text>
          ) : null}

          {contract.node ? (
            <HStack gap="8px" align="baseline" flexWrap="wrap">
              <Text fontSize="xs" fontWeight="600" color="fg.muted">
                {t('design_node')}
              </Text>
              {nodeHref ? (
                <Link
                  href={nodeHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  fontSize="xs"
                  fontFamily="mono"
                  color="fg.brand.emphasis"
                  wordBreak="break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {contract.node}
                </Link>
              ) : (
                <Text fontSize="xs" fontFamily="mono" color="fg.muted">
                  {contract.node}
                </Text>
              )}
              {contract.version ? (
                <Text fontSize="xs" color="fg.subtle">
                  {t('design_read_at', { when: contract.version })}
                </Text>
              ) : null}
            </HStack>
          ) : contract.states.length || contract.props.length || contract.composes.length ? null : (
            /* Nothing bound and nothing described: said out loud, because
               silence here reads as permission to invent. A component
               described in states and props is specified — a project without a
               design tool has no node to show, and that is not a fault. */
            <Text fontSize="xs" color="fg.subtle">
              {t('design_contract_none')}
            </Text>
          )}

          {contract.states.length ? (
            <Tabs.Root defaultValue="0" size="sm" variant="line" colorPalette="gray">
              <Tabs.List borderColor="border.default" gap="4px" flexWrap="wrap">
                {contract.states.map((state, index) => (
                  <Tabs.Trigger key={state.id} value={String(index)} px="8px" fontSize="xs">
                    {state.name}
                  </Tabs.Trigger>
                ))}
                <Tabs.Indicator bg="bg.neutral.emphasis" height="2px" bottom="-1px" />
              </Tabs.List>
              {contract.states.map((state, index) => (
                <Tabs.Content key={state.id} value={String(index)} pt="8px">
                  <Text fontSize="xs" color={state.note ? 'fg.muted' : 'fg.subtle'}>
                    {state.note || t('design_state_undescribed')}
                  </Text>
                </Tabs.Content>
              ))}
            </Tabs.Root>
          ) : null}

          {contract.composes.length ? (
            /* What the screen is built from, in reading order — the one thing
               the design tool does not know, which is that these are elements
               that already exist. */
            <Box>
              <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="4px">
                {t('design_composes')}
              </Text>
              <Box display="flex" flexDirection="column" gap="4px">
                {composedBySlot.map((group) => (
                  <HStack key={group.slot || '—'} gap="8px" align="baseline" flexWrap="wrap">
                    {group.slot ? (
                      <Text fontSize="xs" color="fg.subtle" minW="70px" flexShrink={0}>
                        {group.slot}
                      </Text>
                    ) : null}
                    <HStack gap="6px" flexWrap="wrap">
                      {group.names.map((name) => (
                        <Text
                          key={name}
                          fontSize="xs"
                          px="8px"
                          py="2px"
                          borderRadius="full"
                          borderWidth="1px"
                          borderColor="border.glass"
                          color="fg.muted"
                        >
                          {name}
                        </Text>
                      ))}
                    </HStack>
                  </HStack>
                ))}
              </Box>
            </Box>
          ) : null}

          {contract.props.length ? (
            <Box>
              <Text fontSize="xs" fontWeight="600" color="fg.muted" mb="4px">
                {t('design_props')}
              </Text>
              <Box display="flex" flexDirection="column" gap="2px">
                {contract.props.map((prop) => (
                  <HStack key={prop.id} gap="8px" align="baseline" flexWrap="wrap">
                    <Text fontSize="xs" fontFamily="mono" fontWeight="600" color="fg.default">
                      {prop.name}
                    </Text>
                    {prop.type ? (
                      <Text fontSize="10px" fontFamily="mono" color="fg.muted">
                        {prop.type}
                      </Text>
                    ) : null}
                    {prop.required ? (
                      <Text fontSize="10px" color="orange.400">
                        {t('http_param_required')}
                      </Text>
                    ) : null}
                    {prop.default ? (
                      <Text fontSize="10px" fontFamily="mono" color="fg.subtle">
                        {`= ${prop.default}`}
                      </Text>
                    ) : null}
                    {prop.description ? (
                      <Text fontSize="xs" color="fg.muted">
                        {prop.description}
                      </Text>
                    ) : null}
                  </HStack>
                ))}
              </Box>
            </Box>
          ) : null}

          {contract.tokens.length ? (
            <HStack gap="6px" flexWrap="wrap">
              {contract.tokens.map((token) => (
                <Text
                  key={token}
                  fontSize="10px"
                  fontFamily="mono"
                  color="fg.muted"
                  px="8px"
                  py="2px"
                  borderRadius="full"
                  borderWidth="1px"
                  borderColor="border.glass"
                >
                  {token}
                </Text>
              ))}
            </HStack>
          ) : null}

          {contract.a11y ? (
            <HStack gap="8px" align="baseline">
              <Text fontSize="xs" fontWeight="600" color="fg.muted">
                {t('design_a11y')}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {contract.a11y}
              </Text>
            </HStack>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
