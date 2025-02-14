import {delocalizePath} from './delocalizePath';
import {localizePath} from './localizePath';
import type {I18n} from './types';

/**
 * Navigate to a new localized pathname programmatically.
 */
export function navigateToLocale(locale: I18n) {
  const delocalizedPathname = delocalizePath(window.location.pathname, locale);

  if (locale.isDefault) {
    window.location.href = delocalizedPathname;
    return;
  }

  const newLocalizedPathname = localizePath(delocalizedPathname, locale);

  // navigate to the new locale
  window.location.href = newLocalizedPathname;
}
