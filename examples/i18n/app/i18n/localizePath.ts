/*
 * A utility function that returns a localized path for a given path and locale.
 * If the locale is the default locale, it returns the path unchanged.
 * If the locale is not the default locale, it prepends the locale to the path.
 * @param path The path to localize.
 * @param i18n The i18n object for the current locale.
 * @returns The localized path.
 * @example
 * ```js
 * const path = localizePath('/products', {prefix: '/es-ES'});
 * // path === '/es-ES/products'
 *
 * const path = localizePath('/products', {prefix: ''});
 * // path === '/products'
 *
 * const path = localizePath('/es-ES/products', {prefix: '/es-ES'});
 * // path === '/es-ES/products'
 * ```
 */
import type {I18n} from './types';

export function localizePath(path: string, i18n: I18n): string {
  if (i18n?.isDefault) return path;
  if (!i18n?.prefix) {
    // eslint-disable-next-line no-console
    console.warn('i18n.prefix is not defined, not localizing pathname', i18n);
    return path;
  }
  if (path.startsWith(i18n.prefix.value)) return path;
  if (path.startsWith('/')) return `${i18n.prefix.value}${path}`;
  return `${i18n.prefix.value}/${path}`;
}
