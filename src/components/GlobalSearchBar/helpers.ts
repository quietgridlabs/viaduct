import { isNearBottom as nearBottom } from '@utils/scrollPaging';
import { GLOBAL_SEARCH_LOAD_MORE_PX } from './constants';

/** Whether the results list has reached the point of asking for more. */
export function isNearBottom(el: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return nearBottom(el, GLOBAL_SEARCH_LOAD_MORE_PX);
}

/** The trailing line under a result: path, domain, project — whatever there is. */
export function resultMeta(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}
