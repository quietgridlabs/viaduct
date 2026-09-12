export type OnboardingChoice = 'template' | 'blank';

export type OnboardingWelcomeDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Guest / local editor — apply into Zustand store, no API. */
  mode?: 'local' | 'cloud';
  onLocalTemplate?: () => void;
  onLocalBlank?: () => void;
  /** Called after dismiss without creating (Skip). */
  onSkip?: () => void;
};
