import type {SubFolderPrefixParser} from './types';

/**
 * Create a subfolder locale parser based on a given url structure
 * This allows merchants to further configure their subfolder locale structure
 * @example This will match /fr-CA/ or /en-CA
 * ```js
 * const subfolderLocaleParser = createSubfolderLocaleParser({
 *  parser: ({COUNTRY, language, delimiter}) =>
 *  `/${language}${delimiter['-']}${COUNTRY}`
 *  });
 * ```
 *
 * @example This will mactch /FR_CA/ or /EN_CA
 * ```js
 * const subfolderLocaleParser = createSubfolderLocaleParser({
 *  parser: ({COUNTRY, LANGUAGE, delimiter}) =>
 *   `/${LANGUAGE}${delimiter['_']}${COUNTRY}`
 * });
 * ```
 *
 * @example This will match /ca-fr/ or /ca-en
 * ```js
 * const subfolderLocaleParser = createSubfolderLocaleParser({
 *  parser: ({COUNTRY, language, delimiter}) =>
 *   `/${country}${delimiter['-']}${language}`
 * });
 * ```
 */
export function createSubfolderLocaleParser({
  parser,
}: {
  parser: SubFolderPrefixParser;
}) {
  return function ({country, language}: {country: string; language: string}) {
    const subfolderLocaleOptions = {
      country: 'country',
      COUNTRY: 'COUNTRY',
      LANGUAGE: 'LANGUAGE',
      language: 'language',
      delimiter: {
        '-': '-',
        _: '_',
      },
    } as const;

    const format = parser(subfolderLocaleOptions);

    // (^\/{2})-([A-Z]{2}) this regex matches /fr-CA
    const prefixRegexStr = format
      .replace('COUNTRY', '([A-Z]{2})')
      .replace('LANGUAGE', '([a-z]{2})')
      .replace('country', '([a-z]{2})')
      .replace('language', '([a-z]{2})')
      .replace(/^\(/g, '(^\\/');

    const regex = new RegExp(prefixRegexStr);

    const COUNTRYIndex = format.indexOf('COUNTRY');
    const LANGUAGEIndex = format.indexOf('LANGUAGE');
    const countryIndex = format.indexOf('country');
    const languageIndex = format.indexOf('language');

    const cIndex = COUNTRYIndex > -1 ? COUNTRYIndex : countryIndex;
    const lIndex = LANGUAGEIndex > -1 ? LANGUAGEIndex : languageIndex;

    const countryLanguage = cIndex < lIndex;

    // replace placeholders with country and language
    const value = format
      .replace('COUNTRY', country.toUpperCase())
      .replace('LANGUAGE', language.toLowerCase())
      .replace('country', country.toLowerCase())
      .replace('language', language.toLowerCase());
    return {
      format,
      value,
      countryLanguage,
      regex,
    };
  };
}
