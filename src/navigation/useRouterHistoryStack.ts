import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType, type Location } from 'react-router-dom';

function locationKey(loc: Location): string {
  return `${loc.key}|${loc.pathname}${loc.search}${loc.hash}`;
}

/** Tracks in-app router entries so back/forward buttons can be disabled accurately. */
export function useRouterHistoryStack() {
  const location = useLocation();
  const navType = useNavigationType();
  const stackRef = useRef<Location[]>([]);
  const indexRef = useRef(-1);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const stack = stackRef.current;

    if (stack.length === 0) {
      stackRef.current = [location];
      indexRef.current = 0;
      setRevision((n) => n + 1);
      return;
    }

    if (navType === 'POP') {
      const idx = stack.findIndex((entry) => entry.key === location.key);
      if (idx >= 0) {
        indexRef.current = idx;
      } else {
        const truncated = stack.slice(0, indexRef.current + 1);
        stackRef.current = [...truncated, location];
        indexRef.current = stackRef.current.length - 1;
      }
    } else {
      const truncated = stack.slice(0, indexRef.current + 1);
      const last = truncated[truncated.length - 1];
      if (last && locationKey(last) === locationKey(location)) {
        return;
      }
      stackRef.current = [...truncated, location];
      indexRef.current = stackRef.current.length - 1;
    }

    setRevision((n) => n + 1);
  }, [location, navType]);

  void revision;

  return {
    canGoBack: indexRef.current > 0,
    canGoForward: indexRef.current >= 0 && indexRef.current < stackRef.current.length - 1,
  };
}
