/**
 * The build-time switches, read through injected constants.
 *
 * Community default: metrics off unless explicitly enabled with
 * `__METRICS_DISABLED__ = "false"` (or `"0"`).
 */
declare const __METRICS_DISABLED__: string | undefined;
declare const __DEV_BUILD__: boolean | undefined;

export function metricsDisabled(): boolean {
  if (typeof __METRICS_DISABLED__ !== 'string' || __METRICS_DISABLED__ === '') {
    return true;
  }
  const flag = __METRICS_DISABLED__.toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  return true;
}

/** True in a dev build — used only to warn about props that were dropped. */
export function isDevBuild(): boolean {
  return typeof __DEV_BUILD__ === 'boolean' ? __DEV_BUILD__ : false;
}
