import { createContext, useContext } from 'react';

/** True inside an element edit panel — text fields render as Chakra Editable. */
export const PanelFieldContext = createContext(false);

export function usePanelFieldMode() {
  return useContext(PanelFieldContext);
}
