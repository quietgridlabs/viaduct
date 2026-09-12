import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  ELEMENT_LINK_KINDS,
  LINK_LABEL_MAX,
  MAX_ELEMENT_LINKS,
  guessLinkKind,
  isValidLinkUrl,
  labelFromUrl,
  type ElementLink,
  type ElementLinkKind,
} from '@/types/c4Extensions';
import LinkKindIcon from '@components/common/LinkKindIcon';
import ThemedSelect from '@components/common/ThemedSelect';
import { Box, Button, Dialog, HStack, IconButton, Input, Portal, Text, VStack } from '@chakra-ui/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  links: ElementLink[];
  onApply: (links: ElementLink[]) => void;
  onClose: () => void;
};

/** A row being edited, which is allowed to be half-written. `kind` stays
    unset until the person picks one, so the guess can follow the address as
    it is typed and stop the moment they choose. */
type Draft = { url: string; label: string; kind?: ElementLinkKind };

/**
 * The element's links, as a list you can add to.
 *
 * Rows are edited here rather than in the panel because a link is two fields
 * and the panel gives a row one: cramming an address and its label into the
 * value column would leave neither readable.
 *
 * A label is required once there is an address, and the address is what the
 * label falls back to — an unlabelled link is named after its host on apply
 * rather than refused, so nothing a person typed is thrown away for want of a
 * word they did not think to write.
 */
export default function ElementLinksDialog({ open, links, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    if (!open) return;
    setDrafts(links.length ? links.map((l) => ({ ...l })) : [{ url: '', label: '' }]);
  }, [open, links]);

  if (!open) return null;

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  /* Words only: the mark for the row already sits to its left, and drawn by
     the address rather than the kind — GitLab's fox, not a generic git glyph.
     A second icon inside the select said the same thing twice, worse. */
  const kindOptions = ELEMENT_LINK_KINDS.map((kind) => ({
    value: kind,
    label: t(`link_kind_${kind}`),
  }));

  const apply = () => {
    onApply(
      drafts
        .map((row) => ({ url: row.url.trim(), label: row.label.trim(), kind: row.kind }))
        .filter((row) => row.url)
        .map((row) => ({
          url: row.url,
          label: row.label || labelFromUrl(row.url),
          /* Written out even when it was only guessed: a link's kind is a
             fact about the link, and the next reader should not have to guess
             it again from the address. */
          kind: row.kind ?? guessLinkKind(row.url),
        }))
    );
    onClose();
  };

  /* An empty row is the one waiting to be filled in, and is dropped on apply.
     A row with an address is held to both rules. */
  const missingLabel = drafts.some((row) => row.url.trim() && !row.label.trim());
  const badUrl = drafts.some((row) => row.url.trim() && !isValidLinkUrl(row.url));
  const problem = missingLabel
    ? t('element_links_label_required')
    : badUrl
      ? t('element_links_url_invalid')
      : null;

  return (
    /* A dialog in the middle, not another panel from the edge: the element's
       own panel is already there, and a second sheet of the same glass over
       the first washes both of them out — tried it, and the two were hard to
       tell apart. This is the shape the contract editors already use, opened
       from a row of the same panel for the same reason. */
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
            data-testid="element-links-dialog"
            color="fg.default"
            maxW="680px"
            w="calc(100% - 32px)"
            maxH="min(720px, calc(100dvh - 48px))"
            display="flex"
            flexDirection="column"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <Dialog.Title fontSize="md" fontWeight="600">
                {t('element_links_manage')}
              </Dialog.Title>
            </Dialog.Header>

            {/* A sliver of vertical room, because the body scrolls and so
                clips: the focus ring on the first row's select sits 1px
                outside its box, and with the body starting exactly at that
                box's top edge the ring lost its top and read as a broken
                border. */}
            <Dialog.Body px={DIALOG_PAD.bodyPx} py="3px" overflowY="auto" flex="1">
              <VStack align="stretch" gap={DIALOG_PAD.fieldGap}>
                {drafts.map((row, index) => {
                  const badUrl = Boolean(row.url.trim()) && !isValidLinkUrl(row.url);
                  return (
                    <HStack key={index} align="center" gap="8px">
                      {/* What it is, first: the mark is what a reader scans
                          for, and it is chosen from four rather than typed. It
                          follows the address until somebody picks — a GitHub
                          URL is a repository without being told. */}
                      {/* The brand for the address typed so far — GitLab,
                          Grafana — beside the kind it was filed under. */}
                      <Box flexShrink={0} lineHeight={0} w="16px" display="flex" justifyContent="center">
                        <LinkKindIcon kind={row.kind ?? guessLinkKind(row.url)} url={row.url} size={16} />
                      </Box>
                      <Box flex="0 0 150px" minW={0}>
                        <ThemedSelect
                          size="sm"
                          controlHeight="40px"
                          options={kindOptions}
                          value={row.kind ?? guessLinkKind(row.url)}
                          ariaLabel={t('element_links_kind')}
                          data-testid={`element-link-kind-${index}`}
                          onChange={(next) => update(index, { kind: next as ElementLinkKind })}
                        />
                      </Box>
                      {/* Name and address side by side: they are one link, and
                          stacked they read as two separate fields that happen
                          to be near each other. The name is the narrower of
                          the two because it is the shorter of the two. */}
                      <Input
                        value={row.label}
                        maxLength={LINK_LABEL_MAX}
                        placeholder={t('element_links_label')}
                        onChange={(event) => update(index, { label: event.target.value })}
                        flex="0 0 28%"
                        minW={0}
                        data-testid={`element-link-label-${index}`}
                      />
                      <Input
                        value={row.url}
                        placeholder={t('element_links_url')}
                        onChange={(event) => update(index, { url: event.target.value })}
                        flex="1"
                        minW={0}
                        borderColor={badUrl ? 'red.solid' : undefined}
                        _hover={badUrl ? { borderColor: 'red.solid' } : undefined}
                        data-testid={`element-link-url-${index}`}
                      />
                      <IconButton
                        aria-label={t('delete')}
                        variant="ghost"
                        color="fg.muted"
                        flexShrink={0}
                        _hover={{ color: 'red.400' }}
                        onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                        data-testid={`element-link-remove-${index}`}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </HStack>
                  );
                })}

                {drafts.length === 0 ? (
                  <Text fontSize="sm" color="fg.subtle">
                    {t('element_links_empty')}
                  </Text>
                ) : null}

                <Box pb="4px">
                  <Button
                    size="sm"
                    variant="outline"
                    /* The cap lives in the update, not only on the button:
                       clicks that arrive faster than a render all read the
                       same stale length, and six of them added six rows past
                       a limit of five. */
                    onClick={() =>
                      setDrafts((prev) =>
                        prev.length >= MAX_ELEMENT_LINKS ? prev : [...prev, { url: '', label: '' }]
                      )
                    }
                    disabled={drafts.length >= MAX_ELEMENT_LINKS}
                    data-testid="element-links-add"
                  >
                    <Plus size={14} />
                    {t('element_links_add')}
                  </Button>
                </Box>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              gap="8px"
              justifyContent="space-between"
            >
              <Text fontSize="xs" color={problem ? 'red.fg' : 'fg.subtle'} lineClamp={2}>
                {problem ?? t('element_links_hint')}
              </Text>
              <HStack gap="8px" flexShrink={0}>
                <Button variant="ghost" color="fg.muted" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button onClick={apply} disabled={Boolean(problem)} data-testid="element-links-apply">
                  {t('save')}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
