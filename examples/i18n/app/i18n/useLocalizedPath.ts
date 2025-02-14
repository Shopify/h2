import {useMatches} from '@remix-run/react';
import {localizePath} from './localizePath';

/*
 * A React hook that returns a localized path for a given path.
 * @param path The path to localize.
 * @returns The localized path.
 * @example
 * ```ts
 * const path = useLocalizedPath('/products');
 * // path === '/es-ES/products'
 * ```
 */
export function useLocalizedPath(path: string): string {
  const [root] = useMatches();
  const i18n = root.data.i18n;
  return localizePath(path, i18n);
}
