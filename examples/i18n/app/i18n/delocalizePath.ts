import type {I18n} from './types';

/*
 * An internal utility that removes the prefixed locale from a path.
 * @param path a localized path
 * @returns {string} A unlocalized path.
 * @example
 * ```js
 * const localeMatcher = '(^\/[a-z]{2})-([A-Z]{2})';
 * const path = delocalizePath('/es-ES/products', localeMatcher)
 * // path === '/products'
 *
 * const path = delocalizePath('/products', localeMatcher)
 * // path === '/products'
 * ```
 */
export function delocalizePath(path: string, locale: I18n): string {
  if (!locale.prefix?.regex) {
    return path;
  }
  const match = path.match(locale.prefix.regex);
  if (!match) return path;
  const pathWithoutLocale = path.replace(match[0], '');
  const isHome = pathWithoutLocale === '';
  if (isHome) return '/';
  return pathWithoutLocale;
}
