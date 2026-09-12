import { useEffect, useRef, useState } from 'react';

export type PaneRoom = {
  /** Width for a secondary pane (docs / code). */
  secondary: boolean;
  /** Width for a tertiary pane (sequences / both attachments). */
  tertiary: boolean;
};

const SECONDARY_MQ = '(min-width: 1280px)';
const TERTIARY_MQ = '(min-width: 1680px)';

function readPaneRoom(): PaneRoom {
  if (typeof window === 'undefined') {
    return { secondary: true, tertiary: false };
  }
  return {
    secondary: window.matchMedia(SECONDARY_MQ).matches,
    tertiary: window.matchMedia(TERTIARY_MQ).matches,
  };
}

export function usePaneRoom(): PaneRoom {
  const [room, setRoom] = useState(readPaneRoom);

  useEffect(() => {
    const secondary = window.matchMedia(SECONDARY_MQ);
    const tertiary = window.matchMedia(TERTIARY_MQ);
    const sync = () => setRoom(readPaneRoom());
    secondary.addEventListener('change', sync);
    tertiary.addEventListener('change', sync);
    return () => {
      secondary.removeEventListener('change', sync);
      tertiary.removeEventListener('change', sync);
    };
  }, []);

  return room;
}

/** Follows `wantOpen` across breakpoint changes; user toggles stick until the next change. */
export function useRubberOpen(wantOpen: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(wantOpen);
  const lastWant = useRef(wantOpen);

  useEffect(() => {
    if (lastWant.current === wantOpen) return;
    lastWant.current = wantOpen;
    setOpen(wantOpen);
  }, [wantOpen]);

  return [open, setOpen];
}
