import type {
  CountryCode,
  LanguageCode,
  PrefixFromLocale,
  BaseI18n,
  LocaleStrategy,
} from './types';

type GetLocaleFromRequest = {
  prefixParser: PrefixFromLocale;
  request: Request;
  defaultI18n: BaseI18n;
  strategy: LocaleStrategy;
};

/**
 * A server-sive utility to extract the locale from a request url based on a given strategy
 * The strategies supported are:
 * - subfolder: example.com/fr-ca
 * - subdomain: ca.example.com/fr
 * - top-level-domain: example.ca/fr
 * @example
 * ```ts
 * const {
 *   country,
 *   language,
 *   prefix,
 *   isDefault,
 *   sfApiI18n,
 * } = getLocaleFromRequest({request, config, strategy});
 * ```
 */
export function getLocaleFromRequest({
  defaultI18n,
  request,
  strategy,
}: GetLocaleFromRequest): BaseI18n | undefined {
  if (!defaultI18n.prefix) {
    console.warn('No prefix found in defaultI18n');
    return defaultI18n;
  }

  if (strategy === 'subfolder') {
    return getSubFolderLocaleFromRequest({
      request,
      defaultI18n,
    });
  }

  if (strategy === 'subdomain') {
    throw new Error('Subdomain strategy not yet implemented');
  }

  if (strategy === 'top-level-domain') {
    throw new Error('Top-level-domain strategy not yet implemented');
  }

  throw new Error(`Unsupported i18n strategy: ${strategy}`);
}

type getLocaleFromRequest = {
  request: Request;
  defaultI18n: BaseI18n;
};

/**
 * A server-side that extracts the locale from subfolder localized domains such as
 * example.com/fr-CA, example.com/fr_CA, example.com/FR-CA ...
 */
export function getSubFolderLocaleFromRequest({
  request,
  defaultI18n,
}: getLocaleFromRequest): BaseI18n | undefined {
  if (!defaultI18n?.prefix?.regex) {
    throw new Error('No regex found in defaultI18n');
  }

  // move to just parser.regex
  const regex = defaultI18n.prefix.regex;
  const url = new URL(request.url);
  const matches = regex.exec(url.pathname) || [];

  if (matches.length < 3) {
    console.log(
      `Failed to match a locale in ${request.url}\n using default locale`,
    );
    return defaultI18n;
  }

  let locale = {
    isDefault: true,
    country: defaultI18n.country,
    language: defaultI18n.language,
    prefix: defaultI18n.prefix,
  };

  if (!locale.prefix) {
    locale.prefix = {
      countryLanguage: false,
      format: '',
      regex: new RegExp(''),
      value: '',
    };
  }

  // parse the url to determine the prefix, country and language
  if (defaultI18n.prefix.countryLanguage) {
    const [pre, co, lang] = matches;
    if (pre && co && lang) {
      locale.prefix.value = pre && pre.replace(url.origin, '');
      locale.country = {
        code: co as CountryCode,
        name: '',
      };
      locale.language = {
        code: lang as LanguageCode,
        name: '',
      };
    }
  } else {
    const [pre, lang, co] = matches;
    if (pre && co && lang) {
      locale.prefix.value = pre && pre.replace(url.origin, '');
      locale.country = {
        code: co as CountryCode,
        name: '',
      };
      locale.language = {
        code: lang as LanguageCode,
        name: '',
      };
    }
  }

  locale.isDefault = Boolean(
    locale.country.code === defaultI18n.country.code &&
      locale.language.code === defaultI18n.language.code,
  );

  return locale as BaseI18n;
}
