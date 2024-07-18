import {parseJSON} from '../utils/parse-json';
import {CacheAPI} from './api';
import {
  CacheDefault,
  type CachingStrategy,
  type AllCacheOptions,
} from './strategies.js';

/**
 * Wrapper Cache functions for sub queries
 */

/**
 * Cache API is weird. We just need a full URL, so we make one up.
 */
export function getKeyUrl(key: string) {
  return `https://shopify.dev/?${encodeURIComponent(key)}`;
}

function getCacheOption(userCacheOptions?: CachingStrategy): AllCacheOptions {
  return userCacheOptions || CacheDefault();
}

export function generateSubRequestCacheControlHeader(
  userCacheOptions?: CachingStrategy,
): string {
  return CacheAPI.generateDefaultCacheControlHeader(
    getCacheOption(userCacheOptions),
  );
}

type CacheStatus = 'HIT' | 'MISS' | 'STALE';
const CACHE_URL = 'https://oxygen.myshopify.dev';

/**
 * Get an item from the cache. If a match is found, returns a tuple
 * containing the `JSON.parse` version of the response as well
 * as the response itself so it can be checked for staleness.
 * @private
 */
export async function getItemFromCache<T = any>(
  cache: Cache,
  key: string,
): Promise<{value?: T; status: CacheStatus}> {
  try {
    const originalResponse = await fetch(CACHE_URL, {
      method: 'POST',
      body: JSON.stringify({method: 'match', key}),
    });

    if (!originalResponse.ok) throw new Error(originalResponse.statusText);

    const body = await originalResponse.json<{
      value?: number[]; // Serialized Uint8Array
      status: CacheStatus;
    }>();

    return {
      value: body.value
        ? JSON.parse(decoder.decode(new Uint8Array(body.value)))
        : undefined,
      status: body.status,
    };
  } catch (error) {
    console.error(error);

    console.debug('CACHE:MATCH FALLBACK');

    if (!cache) return {status: 'MISS'};

    const url = getKeyUrl(key);
    const request = new Request(url);

    const response = await CacheAPI.get(cache, request);

    if (!response) return {status: 'MISS'};

    const text = await response.text();
    try {
      return {
        value: parseJSON(text),
        status: isStale(key, response) ? 'STALE' : 'HIT',
      };
      // return [parseJSON(text), response];
    } catch {
      return {value: undefined, status: 'MISS'};
      // return [text, response];
    }
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Put an item into the cache.
 * @private
 */
export async function setItemInCache(
  cache: Cache,
  key: string,
  value: any,
  userCacheOptions?: CachingStrategy,
  tags?: string[],
) {
  const result = await fetch(CACHE_URL, {
    method: 'POST',
    body: JSON.stringify({
      method: 'put',
      key,
      tags,
      options: getCacheOption(userCacheOptions),
      value: Object.values(encoder.encode(JSON.stringify(value))),
    }),
  })
    .then((response) => {
      return response.ok;
    })
    .catch((error) => {
      console.error(error);
      return false;
    });

  if (result) return;
  console.debug('CACHE:PUT FALLBACK');

  if (!cache) return;

  const url = getKeyUrl(key);
  const request = new Request(url);
  const response = new Response(JSON.stringify(value));

  await CacheAPI.set(
    cache,
    request,
    response,
    getCacheOption(userCacheOptions),
  );
}

/**
 *
 * @private
 */
export async function deleteItemFromCache(cache: Cache, key: string) {
  if (!cache) return;

  const url = getKeyUrl(key);
  const request = new Request(url);

  await CacheAPI.delete(cache, request);
}

/**
 * Manually check the response to see if it's stale.
 * @private
 */
export function isStale(key: string, response: Response) {
  return CacheAPI.isStale(new Request(getKeyUrl(key)), response);
}
