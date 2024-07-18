import {CacheShort, CachingStrategy} from './strategies.js';
import {
  type CacheKey,
  runWithCache,
  type DebugOptions,
} from './run-with-cache.js';
import type {WaitUntil} from '../types.js';

export type FetchCacheOptions = {
  cache?: CachingStrategy;
  cacheInstance?: Cache;
  cacheKey?: CacheKey;
  cacheTags?: string[];
  shouldCacheResponse?: (body: any, response: Response) => boolean;
  waitUntil?: WaitUntil;
  returnType?: 'json' | 'text' | 'arrayBuffer' | 'blob';
  debugInfo?: DebugOptions;
};

function toSerializableResponse(body: any, response: Response) {
  return [
    body,
    {
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    },
  ] satisfies [any, ResponseInit];
}

function fromSerializableResponse([body, init]: [any, ResponseInit]) {
  return [body, new Response(body, init)] as const;
}

// Check if the response body has GraphQL errors
// https://spec.graphql.org/June2018/#sec-Response-Format
export const checkGraphQLErrors = (body: any, response: Response) =>
  !body?.errors && response.status < 400;

/**
 * `fetch` equivalent that stores responses in cache.
 * Useful for calling third-party APIs that need to be cached.
 * @private
 */
export async function fetchWithServerCache(
  url: string,
  requestInit: Request | RequestInit,
  {
    cacheInstance,
    cache: cacheOptions,
    cacheKey = [url, requestInit],
    cacheTags,
    shouldCacheResponse = () => true,
    waitUntil,
    returnType = 'json',
    debugInfo,
  }: FetchCacheOptions = {},
): Promise<readonly [any, Response]> {
  if (!cacheOptions && (!requestInit.method || requestInit.method === 'GET')) {
    cacheOptions = CacheShort();
  }

  return runWithCache(
    cacheKey,
    async () => {
      const response = await fetch(url, requestInit);
      let data;

      try {
        data = await response[returnType]();
      } catch {
        try {
          data = await response.text();
        } catch {
          // Getting a response without a valid body
          return toSerializableResponse('', response);
        }
      }

      return toSerializableResponse(data, response);
    },
    {
      cacheInstance,
      waitUntil,
      strategy: cacheOptions ?? null,
      cacheTags,
      debugInfo,
      shouldCacheResult: (result) =>
        shouldCacheResponse(...fromSerializableResponse(result)),
    },
  ).then(fromSerializableResponse);
}
