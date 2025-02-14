import type {
  BaseI18n,
  PrefixFromLocale,
  CountryCode,
  LanguageCode,
  LocaleStrategy,
} from './types';
import {fetchI18nJson} from './fetchI18nJson.server';
import {getLocaleFromRequest} from './getLocaleFromRequest.server';

/**
 * Extract the locale from the request url and fetch the locale json file
 * from the /public/locales folder
 */
export async function getI18n<DefaultI18n extends BaseI18n>({
  cache,
  defaultI18n,
  prefixParser,
  request,
  waitUntil,
  strategy = 'subfolder',
}: {
  cache: Cache;
  defaultI18n: DefaultI18n;
  prefixParser: PrefixFromLocale;
  request: Request;
  strategy: LocaleStrategy;
  waitUntil: (p: Promise<any>) => void;
}) {
  // Extract the locale from the request url.
  const locale = getLocaleFromRequest({
    defaultI18n,
    prefixParser,
    request,
    strategy,
  });

  // Create the locale variables for the Storefront API.
  const i18nSfApi = {
    country: (locale?.country?.code.toUpperCase() ||
      defaultI18n.country.code.toUpperCase()) as CountryCode,
    language: (locale?.language?.code.toUpperCase() ||
      defaultI18n.language.code.toUpperCase()) as LanguageCode,
  };

  if (!locale) {
    return {i18n: defaultI18n, i18nSfApi};
  }

  // if not in the default locale, fetch the locale json file from
  // the /public/locales folder
  const i18n = await fetchI18nJson({
    cache,
    locale,
    request,
    waitUntil,
  });

  return {i18n, i18nSfApi};
}
