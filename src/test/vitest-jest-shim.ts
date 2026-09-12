/** Jest shim for suites that still import from `vitest`. */
export const describe = globalThis.describe;
export const it = globalThis.it;
export const test = globalThis.test;
export const expect = globalThis.expect;
export const beforeEach = globalThis.beforeEach;
export const afterEach = globalThis.afterEach;
export const beforeAll = globalThis.beforeAll;
export const afterAll = globalThis.afterAll;
export const jest = globalThis.jest;
