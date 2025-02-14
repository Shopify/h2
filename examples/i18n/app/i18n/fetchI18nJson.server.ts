import type {BaseI18n} from './types';
import {createWithCache, CacheLong} from '@shopify/hydrogen';
import {getOxygenAssetsUrl} from './getOxygenAssetsUrl.server';

/**
 * A server-side utility to fetch a json locale file from the CDN.
 * @param request
 * @param i18n
 * @param env
 * @example
 * ```ts
 * const locale = await fetchI18nJson({request, i18n, env, cache, waitUntil});
 * ```
 */
export async function fetchI18nJson<DefaultI18n extends BaseI18n>({
  cache,
  locale,
  request,
  waitUntil,
}: {
  cache: Cache;
  locale: BaseI18n;
  request: Request;
  waitUntil: (promise: Promise<any>) => void;
}): Promise<BaseI18n> {
  if (!request || typeof request !== 'object') {
    throw new Error('`request` is required');
  }
  if (!cache || typeof cache !== 'object') {
    throw new Error('`cache` is required');
  }
  if (!waitUntil || typeof waitUntil !== 'function') {
    throw new Error('`waitUntil` is required');
  }
  if (!locale || !locale.language || !locale.country) {
    throw new Error('`locale` is required');
  }

  if (!locale.prefix || locale.isDefault) {
    return Promise.resolve(locale);
  }

  const fetchJsonCountry = createWithCache<BaseI18n['country']>({
    cache,
    waitUntil,
  })(
    ['i18n-country', locale.country.code],
    CacheLong(),
    fetchJson<DefaultI18n>({
      resource: 'country',
      asset: locale.country.code,
      request,
    }),
  );

  const fetchJsonLanguage = createWithCache<BaseI18n['language']>({
    cache,
    waitUntil,
  })(
    ['i18n-language', locale.language.code],
    CacheLong(),
    fetchJson<DefaultI18n>({
      resource: 'language',
      asset: locale.language.code,
      request,
    }),
  );

  const [countryJson, languageJson] = await Promise.all([
    fetchJsonCountry,
    fetchJsonLanguage,
  ]).catch((error) => {
    // eslint-disable-next-line no-console
    console.log('errors', error);
    return [];
  });

  if (!countryJson) {
    // eslint-disable-next-line no-console
    console.error(`Failed to fetch country json for ${locale.country}`);
    return Promise.resolve(locale);
  }

  if (!languageJson) {
    // eslint-disable-next-line no-console
    console.error(`Failed to fetch language json for ${locale.language}`);
    return Promise.resolve(locale);
  }

  return {
    country: countryJson ?? locale.country,
    language: languageJson ?? locale.language,
    prefix: locale.prefix,
    isDefault: locale.isDefault,
  };
}

type FetchJsonProps = {
  asset: string;
  request: Request;
  resource: 'country' | 'language';
};

/**
 * function over load for fetchJsonCountry
 */
function fetchJson<DefaultI18n extends BaseI18n>({
  resource,
  asset,
  request,
}: FetchJsonProps & {
  resource: 'country';
}): () => Promise<DefaultI18n['country']>;

/**
 * function over load for fetchJsonLanguage
 */
function fetchJson<DefaultI18n extends BaseI18n>({
  resource,
  asset,
  request,
}: FetchJsonProps & {
  resource: 'language';
}): () => Promise<DefaultI18n['language']>;

function fetchJson<DefaultI18n extends BaseI18n>(
  props: unknown,
): () => Promise<unknown> {
  return async function () {
    const {resource, asset, request} = props as FetchJsonProps;
    try {
      const oxygenAssetsUrl = getOxygenAssetsUrl(request);
      const jsonUrl = `${oxygenAssetsUrl}/locales/${resource}/${asset}.json`;

      const response = await fetch(jsonUrl);

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(
          `Failed to fetch ${resource}/${asset}, response not ok, status: ${response.status}`,
        );
        return undefined;
      }

      let json;
      if (resource === 'country') {
        json = (await response.json()) as DefaultI18n['country'];
      } else if (resource === 'language') {
        json = (await response.json()) as DefaultI18n['language'];
      }

      if (!json || typeof json !== 'object') {
        // eslint-disable-next-line no-console
        console.log(`Failed to parse json for ${resource}/${asset}`);
        return Promise.resolve(undefined);
      }

      return json;
    } catch (error) {
      let message;
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      } else {
        message = 'Unknown error';
      }
      console.log(
        `Error fetching ${resource}/${asset}. Falling back to default i18n.\nError:`,
        message,
      );
      return Promise.resolve(undefined);
    }
  };
}
