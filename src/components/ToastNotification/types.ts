export type ToastNotificationProps = {
  message: string | null;
  onClose: () => void;
  autoHideDuration?: number;
};
