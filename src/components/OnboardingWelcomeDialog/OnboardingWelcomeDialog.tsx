import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { useGlassSurface } from '@theme/glassSurfaces';
import { ArrowRight, FilePlus2, LayoutTemplate } from 'lucide-react';
import {
  Box,
  Button,
  Dialog,
  HStack,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react';
import QuackDuck from '@components/QuackDuck';
import QuackSpinner from '@components/QuackSpinner';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buildStarterModel } from '@/data/templates/starterModel';

import { markOnboardingSeen } from './helpers';
import type { OnboardingChoice, OnboardingWelcomeDialogProps } from './types';

/** Community: local-only onboarding (blank or starter template). */
export default function OnboardingWelcomeDialog({
  open,
  onClose,
  onSkip,
  onLocalTemplate,
  onLocalBlank,
}: OnboardingWelcomeDialogProps) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [busy, setBusy] = useState<OnboardingChoice | null>(null);
  const completedRef = useRef(false);

  const finishLocal = () => {
    completedRef.current = true;
    markOnboardingSeen();
    onClose();
  };

  const startWithTemplate = () => {
    setBusy('template');
    try {
      if (onLocalTemplate) {
        onLocalTemplate();
      } else {
        useFlatC4Store.getState().setModel(buildStarterModel());
      }
      finishLocal();
    } finally {
      setBusy(null);
    }
  };

  const startBlank = () => {
    setBusy('blank');
    try {
      if (onLocalBlank) {
        onLocalBlank();
      } else {
        useFlatC4Store.getState().setModel({
          viewLevel: 'system',
          systems: [],
          containers: [],
          components: [],
          codeElements: [],
        });
      }
      finishLocal();
    } finally {
      setBusy(null);
    }
  };

  const handleSkip = () => {
    if (completedRef.current) return;
    markOnboardingSeen();
    onClose();
    onSkip?.();
  };

  const choiceCard = (
    key: OnboardingChoice,
    icon: ReactNode,
    title: string,
    hint: string,
    onClick: () => void,
    opts?: { primary?: boolean }
  ) => {
    const primary = opts?.primary ?? false;
    return (
      <Button
        key={key}
        variant={primary ? 'solid' : 'outline'}
        h="auto"
        py="14px"
        px="16px"
        justifyContent="flex-start"
        onClick={onClick}
        disabled={busy !== null}
        data-testid={`onboarding_${key}`}
      >
        <HStack gap="12px" align="flex-start" w="full">
          <Box flexShrink={0} mt="2px">
            {busy === key ? <QuackSpinner size={20} /> : icon}
          </Box>
          <VStack align="start" gap="2px" flex="1" minW={0}>
            <Text fontWeight="600" textAlign="left">
              {title}
            </Text>
            <Text fontSize="sm" opacity={0.75} textAlign="left" whiteSpace="normal">
              {hint}
            </Text>
          </VStack>
          <ArrowRight size={16} style={{ flexShrink: 0, marginTop: 4 }} />
        </HStack>
      </Button>
    );
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open && busy === null) handleSkip();
      }}
      placement="center"
      size="md"
      closeOnInteractOutside={busy === null}
      closeOnEscape={busy === null}
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} />
        <Dialog.Positioner>
          <Dialog.Content
            color="fg.default"
            maxW="440px"
            w="calc(100vw - 32px)"
            p="24px"
            {...glass.dialog}
          >            <VStack align="stretch" gap="16px">
              <HStack gap="12px">
                <QuackDuck size={40} />
                <VStack align="start" gap="2px">
                  <Text fontSize="lg" fontWeight="700">
                    {t('onboarding_welcome_title', { defaultValue: 'Welcome to Viaduct' })}
                  </Text>
                  <Text fontSize="sm" opacity={0.75}>
                    {t('onboarding_welcome_hint', {
                      defaultValue: 'Start local — no account needed.',
                    })}
                  </Text>
                </VStack>
              </HStack>

              <VStack align="stretch" gap="10px">
                {choiceCard(
                  'template',
                  <LayoutTemplate size={20} />,
                  t('onboarding_template_title', { defaultValue: 'Start with a sample' }),
                  t('onboarding_template_hint', {
                    defaultValue: 'Load a small C4 model to explore.',
                  }),
                  startWithTemplate,
                  { primary: true }
                )}
                {choiceCard(
                  'blank',
                  <FilePlus2 size={20} />,
                  t('onboarding_blank_title', { defaultValue: 'Blank canvas' }),
                  t('onboarding_blank_hint', { defaultValue: 'Start from an empty model.' }),
                  startBlank
                )}
              </VStack>

              <Button variant="ghost" size="sm" onClick={handleSkip} disabled={busy !== null}>
                {t('onboarding_skip', { defaultValue: 'Skip' })}
              </Button>
            </VStack>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export { hasSeenOnboarding, markOnboardingSeen } from './helpers';
