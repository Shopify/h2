import {
  NO_STORE,
  CacheShort,
  generateCacheControlHeader,
  type CachingStrategy,
} from './strategies';
import {getItemFromCache, getKeyUrl, setItemInCache} from './sub-request';
import {type StackInfo} from '../utils/callsites';
import {hashKey} from '../utils/hash';
import type {WaitUntil} from '../types';

/**
 * The cache key is used to uniquely identify a value in the cache.
 */
export type CacheKey = string | readonly unknown[];

export type DebugOptions = {
  url?: string;
  requestId?: string | null;
  graphql?: string | null;
  purpose?: string | null;
  stackInfo?: StackInfo;
  displayName?: string;
};

type CachedDebugInfo = {
  displayName?: string;
  url?: string;
  responseInit?: {
    status: number;
    statusText: string;
    headers?: [string, string][];
  };
};

export type AddDebugDataParam = {
  displayName?: string;
  response?: Pick<Response, 'url' | 'status' | 'statusText' | 'headers'>;
};

export type CacheActionFunctionParam = {
  addDebugData: (info: AddDebugDataParam) => void;
};

type WithCacheOptions<T = unknown> = {
  strategy?: CachingStrategy | null;
  cacheInstance?: Cache;
  shouldCacheResult?: (value: T) => boolean;
  waitUntil?: WaitUntil;
  debugInfo?: DebugOptions;
  cacheTags?: string[];
};

// Lock to prevent revalidating the same sub-request
// in the same isolate. Note that different isolates
// in the same colo could duplicate the revalidation
// since this is only an in-memory lock.
// https://github.com/Shopify/oxygen-platform/issues/625
const swrLock = new Set<string>();

/**
 * Implementation of withCache.
 * @private
 */
export async function runWithCache<T = unknown>(
  cacheKey: CacheKey,
  actionFn: ({addDebugData}: CacheActionFunctionParam) => T | Promise<T>,
  {
    strategy = CacheShort(),
    cacheInstance,
    shouldCacheResult = () => true,
    waitUntil,
    debugInfo,
    cacheTags,
  }: WithCacheOptions<T>,
): Promise<T> {
  const startTime = Date.now();
  const key = await hashKey([
    // '__HYDROGEN_CACHE_ID__', // TODO purgeQueryCacheOnBuild
    ...(typeof cacheKey === 'string' ? [cacheKey] : cacheKey),
  ]);

  // console.debug(key, {
  //   original: (Array.isArray(cacheKey) ? cacheKey.join(':') : cacheKey).slice(
  //     170,
  //     270,
  //   ),
  // });

  let cachedDebugInfo: CachedDebugInfo | undefined;
  let userDebugInfo: CachedDebugInfo | undefined;

  const addDebugData = (info: AddDebugDataParam) => {
    userDebugInfo = {
      displayName: info.displayName,
      url: info.response?.url,
      responseInit: {
        status: info.response?.status || 0,
        statusText: info.response?.statusText || '',
        headers: Array.from(info.response?.headers.entries() || []),
      },
    };
  };

  const mergeDebugInfo = () => ({
    ...cachedDebugInfo,
    ...debugInfo,
    url:
      userDebugInfo?.url ||
      debugInfo?.url ||
      cachedDebugInfo?.url ||
      getKeyUrl(key),
    displayName:
      debugInfo?.displayName ||
      userDebugInfo?.displayName ||
      cachedDebugInfo?.displayName,
  });

  const logSubRequestEvent =
    process.env.NODE_ENV === 'development'
      ? ({
          result,
          cacheStatus,
          overrideStartTime,
        }: {
          result?: any;
          cacheStatus?: 'MISS' | 'HIT' | 'STALE' | 'PUT';
          overrideStartTime?: number;
        }) => {
          globalThis.__H2O_LOG_EVENT?.({
            ...mergeDebugInfo(),
            eventType: 'subrequest',
            startTime: overrideStartTime || startTime,
            endTime: Date.now(),
            cacheStatus,
            responsePayload: (result && result[0]) || result,
            responseInit: (result && result[1]) || userDebugInfo?.responseInit,
            cache: {
              status: cacheStatus,
              strategy: generateCacheControlHeader(strategy || {}),
              key,
              tags: cacheTags,
            },
            waitUntil,
          });
        }
      : undefined;

  if (!cacheInstance || !strategy || strategy.mode === NO_STORE) {
    const result = await actionFn({addDebugData});
    // Log non-cached requests
    logSubRequestEvent?.({result});
    return result;
  }

  type CachedItem = {
    value: Awaited<T>;
    debugInfo?: CachedDebugInfo;
  };

  const storeInCache = (value: CachedItem['value']) =>
    setItemInCache(
      cacheInstance,
      key,
      {
        value,
        debugInfo:
          process.env.NODE_ENV === 'development' ? mergeDebugInfo() : undefined,
      } satisfies CachedItem,
      strategy,
      cacheTags,
    );

  const {value: cachedItem, status: cacheStatus} =
    await getItemFromCache<CachedItem>(cacheInstance, key);
  // console.log('--- Cache', cacheStatus);

  if (cachedItem && cacheStatus !== 'MISS') {
    cachedDebugInfo = cachedItem.debugInfo;
    const cachedValue = cachedItem.value;

    console.debug(`CACHE ${cacheStatus}`);

    if (!swrLock.has(key) && cacheStatus === 'STALE') {
      swrLock.add(key);

      // Important: Run revalidation asynchronously.
      const revalidatingPromise = Promise.resolve().then(async () => {
        const revalidateStartTime = Date.now();
        try {
          const result = await actionFn({addDebugData});

          if (shouldCacheResult(result)) {
            await storeInCache(result);

            // Log PUT requests with the revalidate start time
            logSubRequestEvent?.({
              result,
              cacheStatus: 'PUT',
              overrideStartTime: revalidateStartTime,
            });
          }
        } catch (error: any) {
          if (error.message) {
            error.message = 'SWR in sub-request failed: ' + error.message;
          }

          console.error(error);
        } finally {
          swrLock.delete(key);
        }
      });

      // Asynchronously wait for it in workers
      waitUntil?.(revalidatingPromise);
    }

    // Log HIT/STALE requests
    logSubRequestEvent?.({
      result: cachedValue,
      cacheStatus,
    });

    return cachedValue;
  }

  console.debug('CACHE MISS');

  const result = await actionFn({addDebugData});

  // Log MISS requests
  logSubRequestEvent?.({
    result,
    cacheStatus: 'MISS',
  });

  /**
   * Important: Do this async
   */
  if (shouldCacheResult(result)) {
    const cacheStoringPromise = Promise.resolve().then(async () => {
      const putStartTime = Date.now();
      await storeInCache(result);
      logSubRequestEvent?.({
        result,
        cacheStatus: 'PUT',
        overrideStartTime: putStartTime,
      });
    });

    waitUntil?.(cacheStoringPromise);
  }

  return result;
}
