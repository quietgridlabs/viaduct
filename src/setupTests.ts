// jsdom ships no TextEncoder / TextDecoder, and react-router reaches for them
// on import. Node has both — hand them over rather than mocking the router in
// every test that renders something routed.
//
// Not Node's encoder as-is: its Uint8Array comes from Node's realm, and code
// under test that checks `instanceof Uint8Array` does not recognise one from
// across the boundary. fflate takes such a value for a directory tree and
// writes a zip full of `element.json/0/`, `element.json/1/`. Copying into this
// realm's Uint8Array costs nothing at test sizes and removes the whole class.
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
  class RealmSafeTextEncoder extends NodeTextEncoder {
    encode(input?: string) {
      return new Uint8Array(super.encode(input)) as ReturnType<NodeTextEncoder['encode']>;
    }
  }
  globalThis.TextEncoder = RealmSafeTextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = NodeTextDecoder as typeof globalThis.TextDecoder;
}

/*
 * jsdom ships no `CSS` object. Chakra's tabs reach for `CSS.escape` when they
 * position the indicator under the selected tab, and the throw lands inside a
 * jsdom callback — no failed assertion, just a wall of noise under every test
 * that renders tabs. One escape is enough for an id selector.
 */
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    escape: (value: string) => String(value).replace(/[^\w-]/g, (char) => `\\${char}`),
  } as unknown as typeof globalThis.CSS;
}

/* Same story, same code path: nothing resizes under jsdom, so watching for it
   is a no-op rather than a missing constructor. */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// Mock Blob constructor for FileOperations tests
global.Blob = jest.fn().mockImplementation((chunks: BlobPart[], options?: BlobPropertyBag) => ({
  chunks,
  options,
})) as jest.MockedClass<typeof Blob>;

/*
 * Object URLs for the file-operations tests, on the real `URL`.
 *
 * This used to replace the global with an object carrying only these two
 * functions, which quietly took the constructor away: every `new URL(...)` in
 * the app threw under test, so anything parsing an address — link validation,
 * the sign-in `returnTo` — behaved as though every address were malformed, and
 * only in tests. The two statics are attached instead.
 */
URL.createObjectURL = jest.fn(() => 'blob:mock-url');
URL.revokeObjectURL = jest.fn();

// Mock FileReader for FileOperations tests
global.FileReader = class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  readAsText = jest.fn();
  
  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: { result: '{}' }
        } as ProgressEvent<FileReader>);
      }
    }, 0);
  }
} as unknown as typeof FileReader;

// Mock import.meta for manager tests
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {}
    }
  },
  configurable: true
});

// Add TypeScript declarations for custom matchers
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(expected: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveValue(expected: string): R;
      toHaveDisplayValue(expected: string): R;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// Add custom matchers
expect.extend({
  toBeInTheDocument(received) {
    const pass = received && received.nodeType === 1;
    return {
      message: () => `expected element ${pass ? 'not ' : ''}to be in the document`,
      pass: Boolean(pass),
    };
  },
  toHaveTextContent(received, expected) {
    const pass = received && received.textContent === expected;
    return {
      message: () => `expected element to have text content "${expected}" but got "${received?.textContent}"`,
      pass,
    };
  },
  toHaveAttribute(received, attr, value?) {
    const pass = received && received.hasAttribute && received.hasAttribute(attr) && 
      (value === undefined || received.getAttribute(attr) === value);
    return {
      message: () => `expected element ${pass ? 'not ' : ''}to have attribute "${attr}"${value ? ` with value "${value}"` : ''}`,
      pass,
    };
  },
  toHaveValue(received, expected) {
    const pass = received && received.value === expected;
    return {
      message: () => `expected element to have value "${expected}" but got "${received?.value}"`,
      pass,
    };
  },
  toHaveDisplayValue(received, expected) {
    const pass = received && (received.value === expected || received.textContent === expected);
    return {
      message: () => `expected element to have display value "${expected}"`,
      pass,
    };
  }
});