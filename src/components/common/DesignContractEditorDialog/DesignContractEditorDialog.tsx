import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import {
  emptyDesignContract,
  isDesignRef,
  newDesignState,
  parseDesignContract,
  parseProps,
  serializeDesignContract,
  serializeProps,
  validateDesignContract,
  type DesignContract,
} from '@components/common/DesignContract';
import {
  findDesignSystemByName,
  isUiElement,
  type ModelWithDesignSystems,
} from '@/types/c4Extensions';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { useGlassSurface } from '@theme/glassSurfaces';
import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  Box,
  Button,
  Dialog,
  Field,
  HStack,
  Input,
  Portal,
  Text,
  Textarea,
  VStack,
  chakra,
} from '@chakra-ui/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DesignTokenPicker from './DesignTokenPicker';
import DesignNodeField from './DesignNodeField';
import DesignComposeField from './DesignComposeField';
import FieldHint from '@components/common/FieldHint';
import DesignSourceKindIcon from '@components/common/DesignSourceKindIcon';
import { listFigmaSystems } from '@utils/designNodeRef';
import { owedStatesMissing, suggestStates } from '@utils/designStates';

type Props = {
  open: boolean;
  /** Whose design this is — its connections are the first thing offered. */
  elementId?: string;
  initialValue: string;
  /** Named so the person knows which vocabulary the tokens below come from. */
  designSystem?: string;
  onApply: (next: string) => void;
  onClose: () => void;
  /**
   * Open for reading. Everything is shown and nothing can be changed — and the
   * link out to the design tool still works, which is most of why a viewer
   * opens this at all.
   */
  readOnly?: boolean;
};

/*
 * Reading, not editing: the values keep their place and their contrast, minus
 * the frames and the hand cursor that would promise an edit. A disabled
 * fieldset does the silencing; the browser's grey-out is undone because the
 * whole point of opening the card is to read what it says.
 */
const READING_CSS = {
  '& input, & textarea, & [data-scope="select"][data-part="trigger"], & [data-scope="combobox"][data-part="input"]':
    {
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      boxShadow: 'none',
      cursor: 'default',
      opacity: '1 !important',
      color: 'fg.default',
    },
  '& [data-scope="select"][data-part="indicator"], & [data-scope="combobox"][data-part="trigger"]':
    { opacity: 0 },
} as const;

/**
 * In reading mode, the values of one section on their own surface.
 *
 * Stripping the field chrome made the read-only dialog honest — nothing on it
 * looks editable — but also flat: labels and values in one grey column, with
 * nothing to say where a section ends. A document has edges. Each section's
 * values sit on a bordered panel, so the eye finds Node, then Props, then
 * what it is composed of, without reading the labels to know that.
 */
function Sheet({ reading, children }: { reading: boolean; children: ReactNode }) {
  if (!reading) return <>{children}</>;
  return (
    <Box
      w="full"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="8px"
      bg="bg.muted"
      px="10px"
      py="6px"
    >
      {children}
    </Box>
  );
}

/**
 * The design of one element, edited as the thing it is rather than as text.
 *
 * Everything here serializes back into the tagged format the API stores, so
 * what leaves this dialog is always something the server accepts — the
 * refusals it can answer with (a reference that points nowhere, a state
 * described twice) are the two things this form will not let you build.
 */
export default function DesignContractEditorDialog({
  open,
  elementId,
  initialValue,
  designSystem,
  onApply,
  onClose,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { chrome } = useColorMode();
  const inputStyles = fieldSurfaceFlatStyles(chrome);

  /* Subscribe to the model, derive here. A selector that builds a fresh array
     hands zustand a new reference on every render, and the store answers by
     rendering again — the dialog took the whole editor down with it. */
  const model = useFlatC4Store((state) => state.model);

  const [contract, setContract] = useState<DesignContract>(emptyDesignContract);
  /*
   * Props and composition are edited as text, and the text is kept as typed.
   *
   * Rendering them back through the parser meant every keystroke round-tripped
   * through a model that cannot hold a half-written line: `header:` has no
   * names in it yet, so it parsed to nothing, serialised to nothing, and the
   * field wiped itself the moment anyone typed a colon.
   */
  const [propsText, setPropsText] = useState('');

  useEffect(() => {
    if (!open) return;
    const parsed = parseDesignContract(initialValue);
    setContract(parsed);
    setPropsText(serializeProps(parsed.props));
  }, [open, initialValue]);

  /* What this system actually holds. A token typed here that is not on the
     list is a hardcoded value with a plausible name on it — worse than an
     obvious one, so it is marked rather than quietly accepted. */
  const vocabulary = useMemo(
    () => findDesignSystemByName(model as ModelWithDesignSystems, designSystem),
    [model, designSystem]
  );
  const known = useMemo(
    () => new Set((vocabulary?.tokens ?? []).map((token) => token.name)),
    [vocabulary]
  );
  const unknownTokens = contract.tokens.filter((token) => known.size > 0 && !known.has(token));
  const vocabularyTokens = vocabulary?.tokens ?? [];
  const sourceKind = vocabulary?.source?.kind;
  /*
   * A node is a frame in a design tool, so the field is worth having as soon
   * as this project records a Figma file at all — not only when *this*
   * element's system is the one that does. A component can perfectly well be
   * drawn in a file the design system next to it owns, and the picker below
   * makes that choice visible instead of inferring it.
   */
  const figmaSystems = useMemo(
    () => listFigmaSystems(model as ModelWithDesignSystems),
    [model]
  );
  const nodeEnabled = sourceKind === 'figma' || figmaSystems.length > 0;
  const nodeHelpKey = nodeEnabled
    ? 'design_node_help'
    : sourceKind === 'tokens-file'
      ? 'design_node_help_tokens_file'
      : 'design_node_help_disabled';

  /*
   * The other UI elements of this front end, offered rather than typed. A name
   * written by hand and misspelled becomes "a part that is not an element of
   * this container" — visible to the implementer, invisible here, which is the
   * wrong way round.
   */
  const siblings = useMemo(() => {
    const self = model.components.find((component) => component.id === elementId);
    const containerId = self?.containerId ?? model.activeContainerId;
    if (!containerId) return [] as string[];

    const inside = model.components.filter(
      (component) =>
        component.containerId === containerId &&
        component.id !== elementId &&
        isUiElement(component)
    );

    /* The arrows first: a screen that renders a card is normally drawn as one,
       so what this element already points at is the likeliest answer. The rest
       of the front end follows, because the drawing is not always ahead of the
       description. */
    const pointedAt = new Set((self?.connections ?? []).map((c) => c.targetId));
    const connected = inside.filter((component) => pointedAt.has(component.id));
    const others = inside.filter((component) => !pointedAt.has(component.id));
    return [...connected, ...others].map((component) => component.name).filter(Boolean);
  }, [model, elementId]);

  const validation = useMemo(() => {
    /* A leftover node from when the system pointed at Figma must not block
       Apply after the source moved to a tokens file. */
    const forCheck = nodeEnabled ? contract : { ...contract, node: '' };
    return validateDesignContract(forCheck);
  }, [contract, nodeEnabled]);
  const nodeLooksWrong = Boolean(contract.node.trim()) && !isDesignRef(contract.node);

  /* A date if it reads as one; otherwise whatever was written, which is still
     more use than hiding it. */
  const versionRead = (() => {
    const raw = contract.version.trim();
    if (!raw) return '';
    const at = new Date(raw);
    return Number.isNaN(at.getTime()) ? raw : at.toLocaleDateString();
  })();

  const patch = (next: Partial<DesignContract>) => setContract((prev) => ({ ...prev, ...next }));

  const addState = (name = '') =>
    setContract((prev) => ({ ...prev, states: [...prev.states, newDesignState({ name })] }));

  /*
   * Which states to offer depends on what the element is. A select is offered
   * `selected` and `focus`; a paragraph is offered `default` and told the rest
   * is a click away. The full catalogue is a reference — the model holds the
   * differences, and twelve chips on a label teach people to ignore chips.
   */
  const elementName = model.components.find((component) => component.id === elementId)?.name ?? '';
  const stateNames = contract.states.map((state) => state.name);
  const suggested = suggestStates(elementName, stateNames);
  const [moreStates, setMoreStates] = useState(false);
  const owedMissing = owedStatesMissing(elementName, stateNames);

  return (
    /* Centred, dimmed and above the workspace overlay it is opened from — the
       same shell every other dialog in the product wears. */
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      placement="center"
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="design-contract-dialog"
            color="fg.default"
            maxW="720px"
            w="calc(100% - 32px)"
            maxH="min(860px, calc(100dvh - 48px))"
            display="flex"
            flexDirection="column"
            {...glass.dialog}
          >
            <Dialog.Header pb={DIALOG_PAD.headerPb}>
              <VStack align="stretch" gap="4px">
                <HStack gap="6px">
                  <Dialog.Title>{t('design_contract_title')}</Dialog.Title>
                  <FieldHint text={t('design_contract_hint')} />
                </HStack>
              </VStack>
            </Dialog.Header>

            <Dialog.Body overflowY="auto" css={readOnly ? READING_CSS : undefined}>
              {/* A disabled fieldset silences every control below in one
                  move. Links are not controls, so the way out to the design
                  tool keeps working — which is what a viewer came for. */}
              <chakra.fieldset disabled={readOnly} display="contents" border="0" p="0" m="0">
              <VStack align="stretch" gap={DIALOG_PAD.fieldGap}>

                <Field.Root invalid={nodeEnabled && nodeLooksWrong} disabled={!nodeEnabled}>
                  <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb} gap="6px">
                    <DesignSourceKindIcon kind="figma" size={13} />
                    {t('design_node')}
                    <FieldHint text={t(nodeHelpKey)} />
                  </Field.Label>
                  {nodeEnabled ? (
                    <Sheet reading={readOnly}>
                      <DesignNodeField
                        model={model as ModelWithDesignSystems}
                        value={contract.node}
                        preferredSystem={sourceKind === 'figma' ? designSystem : undefined}
                        disabled={readOnly}
                        onChange={(next) => patch({ node: next })}
                      />
                    </Sheet>
                  ) : (
                    <Input
                      size="sm"
                      value={contract.node}
                      placeholder={t('design_node_placeholder_disabled')}
                      data-testid="design-node"
                      disabled
                      {...inputStyles}
                    />
                  )}
                  {/* Only what is wrong stays on the page. The explanation
                      moved to the mark on the label: it is read once, and a
                      paragraph under every control is read never. */}
                  {nodeEnabled && nodeLooksWrong ? (
                    <Text fontSize="xs" color="red.400" mt="4px">
                      {t('design_node_invalid')}
                    </Text>
                  ) : null}
                  {/* Stamped by the server when the account has the design tool
                      connected, so the person who pasted the link never has to
                      go and copy a timestamp. Shown, not editable: it is what
                      drift is measured against, and re-reading it is a
                      deliberate act, not a typo away. */}
                  {nodeEnabled && versionRead ? (
                    <Text fontSize="xs" color="fg.subtle" mt="2px">
                      {t('design_version_read', { date: versionRead })}
                    </Text>
                  ) : null}
                </Field.Root>

                <Box>
                  <HStack justify="space-between" align="baseline" mb={DIALOG_PAD.labelMb}>
                    <HStack gap="5px">
                      <Text fontSize="sm" color="fg.muted">
                        {t('design_states')}
                      </Text>
                      <FieldHint text={t('design_states_hint')} />
                    </HStack>
                  </HStack>

                  <Sheet reading={readOnly}>
                  {readOnly && !contract.states.length ? (
                    <Text fontSize="xs" color="fg.subtle">
                      {t('design_states_none')}
                    </Text>
                  ) : null}
                  <VStack align="stretch" gap="6px">
                    {contract.states.map((state, index) => (
                      <HStack key={state.id} gap="6px">
                        <Input
                          size="sm"
                          flex="0 0 150px"
                          value={state.name}
                          placeholder={t('design_state_name')}
                          onChange={(e) => {
                            const states = [...contract.states];
                            states[index] = { ...state, name: e.target.value };
                            patch({ states });
                          }}
                          {...inputStyles}
                        />
                        <Input
                          size="sm"
                          flex="1"
                          value={state.note}
                          placeholder={readOnly ? '' : t('design_state_note')}
                          onChange={(e) => {
                            const states = [...contract.states];
                            states[index] = { ...state, note: e.target.value };
                            patch({ states });
                          }}
                          {...inputStyles}
                        />
                        {readOnly ? null : (
                          <Button
                            size="xs"
                            variant="ghost"
                            aria-label={t('design_state_remove')}
                            onClick={() =>
                              patch({ states: contract.states.filter((s) => s.id !== state.id) })
                            }
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </HStack>
                    ))}
                  </VStack>
                  </Sheet>

                  {!readOnly && (suggested.offered.length > 0 || suggested.more.length > 0) ? (
                    <HStack gap="6px" flexWrap="wrap" mt="8px">
                      {suggested.offered.map((entry) => (
                        <Button
                          key={entry.name}
                          size="xs"
                          variant="outline"
                          borderRadius="full"
                          title={entry.when}
                          data-testid={`design-state-add-${entry.name}`}
                          onClick={() => addState(entry.name)}
                        >
                          <Plus size={12} />
                          {entry.name}
                        </Button>
                      ))}
                      {/* The rest of the catalogue, behind one click: there
                          for the tab list that needs `expanded`, out of the way
                          for everything that does not. */}
                      {suggested.more.length > 0 && !moreStates ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          borderRadius="full"
                          color="fg.muted"
                          data-testid="design-state-more"
                          onClick={() => setMoreStates(true)}
                        >
                          {t('design_states_more', { count: suggested.more.length })}
                        </Button>
                      ) : null}
                      {moreStates
                        ? suggested.more.map((entry) => (
                            <Button
                              key={entry.name}
                              size="xs"
                              variant="ghost"
                              borderRadius="full"
                              color="fg.muted"
                              title={entry.when}
                              data-testid={`design-state-add-${entry.name}`}
                              onClick={() => addState(entry.name)}
                            >
                              <Plus size={12} />
                              {entry.name}
                            </Button>
                          ))
                        : null}
                    </HStack>
                  ) : null}

                  {/* Not an error: the designer drew one frame, which is
                      normal. But a control without these is a control whose
                      implementer decides them on the spot, and the point of
                      writing states down is that nobody decides on the spot. */}
                  {!readOnly && owedMissing.length > 0 ? (
                    <Text fontSize="xs" color="orange.400" mt="6px" data-testid="design-states-owed">
                      {t('design_states_owed', { states: owedMissing.join(', ') })}
                    </Text>
                  ) : null}
                </Box>

                <Field.Root>
                  <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb} gap="5px">
                    {t('design_props')}
                    <FieldHint text={t('design_props_help')} />
                  </Field.Label>
                  <Sheet reading={readOnly}>
                    {readOnly && !propsText.trim() ? (
                      <Text fontSize="xs" color="fg.subtle">
                        {t('design_props_none')}
                      </Text>
                    ) : (
                      <Textarea
                        rows={readOnly ? Math.max(2, propsText.split('\n').length) : 4}
                        resize={readOnly ? 'none' : undefined}
                        fontFamily="mono"
                        fontSize="xs"
                        value={propsText}
                        placeholder={t('design_props_placeholder')}
                        data-testid="design-props"
                        onChange={(e) => setPropsText(e.target.value)}
                        {...inputStyles}
                      />
                    )}
                  </Sheet>
                </Field.Root>

                {/* What a screen is built from — names of your elements, in
                    reading order. Deliberately not a layout: where they sit is
                    the node's business. */}
                <Field.Root>
                  <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb} gap="5px">
                    {t('design_composes')}
                    <FieldHint
                      text={
                        siblings.length
                          ? t('design_composes_help')
                          : t('design_composes_help_alone')
                      }
                    />
                  </Field.Label>
                  <Sheet reading={readOnly}>
                    <DesignComposeField
                      parts={contract.composes}
                      siblings={siblings}
                      readOnly={readOnly}
                      onChange={(composes) => patch({ composes })}
                    />
                  </Sheet>
                </Field.Root>

                <Field.Root>
                  <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb} gap="5px">
                    {designSystem
                      ? t('design_tokens_from', { system: designSystem })
                      : t('design_tokens')}
                    <FieldHint text={t('design_tokens_help')} />
                  </Field.Label>

                  {readOnly ? (
                    <Sheet reading>
                      {contract.tokens.length ? (
                        <HStack gap="6px" flexWrap="wrap">
                          {contract.tokens.map((token) => (
                            <Text
                              key={token}
                              as="span"
                              fontFamily="mono"
                              fontSize="xs"
                              px="6px"
                              py="2px"
                              borderRadius="4px"
                              bg="bg.subtle"
                            >
                              {token}
                            </Text>
                          ))}
                        </HStack>
                      ) : (
                        <Text fontSize="xs" color="fg.subtle">
                          {t('design_tokens_none')}
                        </Text>
                      )}
                    </Sheet>
                  ) : vocabularyTokens.length ? (
                    <DesignTokenPicker
                      tokens={vocabularyTokens}
                      selected={contract.tokens}
                      systemName={designSystem}
                      onChange={(tokens) => patch({ tokens })}
                    />
                  ) : (
                    <Input
                      size="sm"
                      value={contract.tokens.join(', ')}
                      placeholder={t('design_tokens_placeholder')}
                      data-testid="design-tokens"
                      onChange={(e) =>
                        patch({
                          tokens: e.target.value
                            .split(',')
                            .map((token) => token.trim())
                            .filter(Boolean),
                        })
                      }
                      {...inputStyles}
                    />
                  )}

                  {unknownTokens.length ? (
                    <Text fontSize="xs" color="orange.400" mt="4px">
                      {t('design_tokens_unknown', { tokens: unknownTokens.join(', ') })}
                    </Text>
                  ) : null}

                  {designSystem && !vocabulary ? (
                    <Text fontSize="xs" color="fg.subtle" mt="4px">
                      {t('design_tokens_no_vocabulary', { system: designSystem })}
                    </Text>
                  ) : null}

                  {designSystem && vocabulary && !vocabularyTokens.length ? (
                    <Text fontSize="xs" color="fg.subtle" mt="4px">
                      {t('design_tokens_no_vocabulary', { system: designSystem })}
                    </Text>
                  ) : null}
                </Field.Root>

                <Field.Root>
                  <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb} gap="5px">
                    {t('design_a11y')}
                    <FieldHint text={t('design_a11y_help')} />
                  </Field.Label>
                  <Sheet reading={readOnly}>
                    {readOnly && !contract.a11y.trim() ? (
                      <Text fontSize="xs" color="fg.subtle">
                        {t('design_a11y_none')}
                      </Text>
                    ) : (
                      <Input
                        size="sm"
                        value={contract.a11y}
                        placeholder={t('design_a11y_placeholder')}
                        data-testid="design-a11y"
                        onChange={(e) => patch({ a11y: e.target.value })}
                        {...inputStyles}
                      />
                    )}
                  </Sheet>
                </Field.Root>

              </VStack>
              </chakra.fieldset>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack w="full" justify="space-between">
                <Text fontSize="xs" color={validation.ok ? 'fg.subtle' : 'red.400'}>
                  {readOnly
                    ? ''
                    : validation.ok
                      ? t('design_contract_ok')
                      : t(`design_contract_${validation.error}`)}
                </Text>
                <HStack gap="8px">
                  <Button size="sm" variant={readOnly ? 'outline' : 'ghost'} onClick={onClose}>
                    {readOnly ? t('close') : t('cancel')}
                  </Button>
                  {readOnly ? null : (
                  <Button
                    size="sm"
                    disabled={!validation.ok}
                    data-testid="design-apply"
                    onClick={() => {
                      onApply(
                        serializeDesignContract({
                          ...contract,
                          node: nodeEnabled ? contract.node : '',
                          props: parseProps(propsText),
                        })
                      );
                      onClose();
                    }}
                  >
                    {t('http_contract_apply', { defaultValue: 'Apply' })}
                  </Button>
                  )}
                </HStack>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
