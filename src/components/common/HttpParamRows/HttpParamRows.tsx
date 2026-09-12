import {
  HTTP_PARAM_TYPES,
  newParam,
  type HttpParam,
  type HttpParamIn,
  type HttpParamType,
} from '@components/common/HttpContract';
import ThemedSelect from '@components/common/ThemedSelect';
import { Box, Button, Grid, Input, Text, VStack } from '@chakra-ui/react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  where: HttpParamIn;
  params: HttpParam[];
  onChange: (next: HttpParam[]) => void;
  /** Names the path itself declares — used to flag rows that drifted from it. */
  expected?: string[];
  namePlaceholder?: string;
  testId: string;
};

/**
 * One row per parameter, laid out as a table: the columns are named once at the
 * top instead of every field guessing at its own placeholder — a filled-in
 * example and a description look identical otherwise.
 *
 * Below `sm` the table folds into stacked fields, so each one carries its own
 * label for that case.
 */
const COLUMNS = {
  base: '1fr 32px',
  sm: 'minmax(110px, 1.3fr) 104px 62px minmax(90px, 1fr) minmax(110px, 1.5fr) 32px',
};

/** Full width when the row is stacked, its own column once the table applies. */
const STACKED = { base: '1 / -1', sm: 'auto' };

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box minW={0} gridColumn={STACKED}>
      <Text
        fontSize="10px"
        color="fg.subtle"
        mb="2px"
        display={{ base: 'block', sm: 'none' }}
      >
        {label}
      </Text>
      {children}
    </Box>
  );
}

export default function HttpParamRows({
  where,
  params,
  onChange,
  expected,
  namePlaceholder,
  testId,
}: Props) {
  const { t } = useTranslation();

  const typeOptions = useMemo(
    () => HTTP_PARAM_TYPES.map((type) => ({ value: type, label: type })),
    []
  );

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const update = useCallback(
    (id: string, patch: Partial<HttpParam>) => {
      onChange(
        paramsRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    [onChange]
  );

  const unexpected = (name: string) =>
    Boolean(
      expected && name.trim() && !expected.some((e) => e.toLowerCase() === name.trim().toLowerCase())
    );

  const headers = [
    t('http_param_name'),
    t('http_param_type'),
    t('http_param_required'),
    t('http_param_example'),
    t('http_param_description'),
  ];

  return (
    <VStack align="stretch" gap="6px" w="full">
      {params.length ? (
        <Grid
          templateColumns={COLUMNS}
          gap="6px"
          /* 8px of row padding plus its 1px border — the labels have to sit
             over the fields they name. */
          px="9px"
          display={{ base: 'none', sm: 'grid' }}
          aria-hidden
        >
          {headers.map((header) => (
            <Text key={header} fontSize="10px" fontWeight="700" color="fg.subtle" truncate>
              {header}
            </Text>
          ))}
          <Box />
        </Grid>
      ) : null}

      {params.map((param, index) => (
        <Box
          key={param.id}
          borderWidth="1px"
          borderColor={unexpected(param.name) ? 'orange.solid' : 'border.input'}
          borderRadius="md"
          p="8px"
          bg="bg.subtle"
        >
          <Grid templateColumns={COLUMNS} gap="6px" alignItems="center">
            <Box minW={0}>
              <Text
                fontSize="10px"
                color="fg.subtle"
                mb="2px"
                display={{ base: 'block', sm: 'none' }}
              >
                {t('http_param_name')}
              </Text>
              <Input
                size="sm"
                w="full"
                fontFamily="mono"
                placeholder={namePlaceholder || t('http_param_name')}
                aria-label={t('http_param_name')}
                value={param.name}
                onChange={(e) => update(param.id, { name: e.target.value })}
                data-testid={`${testId}-name-${index}`}
              />
            </Box>

            <Cell label={t('http_param_type')}>
              <ThemedSelect
                size="sm"
                ariaLabel={t('http_param_type')}
                options={typeOptions}
                value={param.type}
                onChange={(type) => update(param.id, { type: type as HttpParamType })}
                data-testid={`${testId}-type-${index}`}
              />
            </Cell>

            <Cell label={t('http_param_required')}>
              <Box display="flex" justifyContent="center" w="full">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={where === 'path'}
                  aria-label={t('http_param_required')}
                  aria-pressed={Boolean(param.required)}
                  onClick={() => update(param.id, { required: !param.required })}
                  minW="32px"
                  w="32px"
                  h="32px"
                  p="0"
                  flexShrink={0}
                  borderColor={param.required ? 'border.brand.emphasis' : 'border.input'}
                  color={param.required ? 'fg.brand.emphasis' : 'fg.muted'}
                  bg={param.required ? 'bg.list.selected' : 'transparent'}
                  _hover={
                    where === 'path'
                      ? undefined
                      : { bg: 'bg.list.hover', borderColor: 'border.strong' }
                  }
                  data-testid={`${testId}-required-${index}`}
                >
                  {param.required ? <Check size={15} strokeWidth={2.5} /> : null}
                </Button>
              </Box>
            </Cell>

            <Cell label={t('http_param_example')}>
              <Input
                size="sm"
                w="full"
                fontFamily="mono"
                placeholder={t('http_param_example')}
                aria-label={t('http_param_example')}
                value={param.example}
                onChange={(e) => update(param.id, { example: e.target.value })}
                data-testid={`${testId}-example-${index}`}
              />
            </Cell>

            <Cell label={t('http_param_description')}>
              <Input
                size="sm"
                w="full"
                placeholder={t('http_param_description')}
                aria-label={t('http_param_description')}
                value={param.description}
                onChange={(e) => update(param.id, { description: e.target.value })}
                data-testid={`${testId}-description-${index}`}
              />
            </Cell>

            {/* Last in the DOM so the fields before it fill the row in order,
                but pinned to the end column — beside the name when the row is
                stacked, rather than stranded under five fields. */}
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              px="0"
              minW="32px"
              gridColumn={{ base: '2', sm: '6' }}
              gridRow="1"
              alignSelf={{ base: 'start', sm: 'center' }}
              aria-label={t('http_param_remove')}
              onClick={() => onChange(params.filter((p) => p.id !== param.id))}
              data-testid={`${testId}-remove-${index}`}
            >
              <Trash2 size={13} />
            </Button>
          </Grid>

          {unexpected(param.name) ? (
            <Text fontSize="xs" color="orange.fg" mt="6px">
              {t('http_param_not_in_path', { name: param.name.trim() })}
            </Text>
          ) : null}
        </Box>
      ))}

      <Button
        size="xs"
        variant="ghost"
        color="fg.muted"
        alignSelf="flex-start"
        onClick={() => onChange([...params, newParam(where)])}
        data-testid={`${testId}-add`}
      >
        <Plus size={13} />
        {t('http_param_add')}
      </Button>
    </VStack>
  );
}
