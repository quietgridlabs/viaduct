import { getC4Colors, getChrome, type ColorStyle, type PaletteMode } from '@theme/theme';
import { chakraSystem } from '@theme/chakra-system';
import { ChakraProvider } from '@chakra-ui/react';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'c4-color-mode';

type ColorModeContextValue = {
  mode: PaletteMode;
  toggleColorMode: () => void;
  setMode: (mode: PaletteMode) => void;
  chrome: ReturnType<typeof getChrome>;
  c4Colors: ReturnType<typeof getC4Colors>;
};

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

function readInitialMode(): PaletteMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PaletteMode>(readInitialMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    document.documentElement.style.colorScheme = mode;
    document.documentElement.setAttribute('data-color-mode', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.classList.toggle('light', mode === 'light');
  }, [mode]);

  const setMode = useCallback((next: PaletteMode) => {
    setModeState(next);
  }, []);

  const toggleColorMode = useCallback(() => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const chrome = useMemo(() => getChrome(mode), [mode]);
  const c4Colors = useMemo(() => getC4Colors(mode), [mode]);

  const value = useMemo(
    () => ({ mode, toggleColorMode, setMode, chrome, c4Colors }),
    [mode, toggleColorMode, setMode, chrome, c4Colors]
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ChakraProvider value={chakraSystem}>{children}</ChakraProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return ctx;
}

export function useC4ThemeColor(
  themeType: 'system' | 'container' | 'component' | 'code' | 'connection' = 'system'
): ColorStyle {
  const { c4Colors } = useColorMode();
  return c4Colors[themeType];
}
