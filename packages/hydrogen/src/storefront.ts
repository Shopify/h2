import {
  createStorefrontClient as createStorefrontUtilities,
  getShopifyCookies,
  SHOPIFY_S,
  SHOPIFY_Y,
  SHOPIFY_STOREFRONT_ID_HEADER,
  SHOPIFY_STOREFRONT_Y_HEADER,
  SHOPIFY_STOREFRONT_S_HEADER,
  type StorefrontClientProps,
} from '@shopify/hydrogen-react';
import type {WritableDeep} from 'type-fest';
import {fetchWithServerCache, checkGraphQLErrors} from './cache/server-fetch';
import type {CacheKey} from './cache/run-with-cache';
import {
  SDK_VARIANT_HEADER,
  SDK_VARIANT_SOURCE_HEADER,
  SDK_VERSION_HEADER,
  STOREFRONT_ACCESS_TOKEN_HEADER,
  STOREFRONT_REQUEST_GROUP_ID_HEADER,
} from './constants';
import {
  CacheNone,
  CacheLong,
  CacheShort,
  CacheDefault,
  CacheCustom,
  generateCacheControlHeader,
  type CachingStrategy,
} from './cache/strategies';
import {generateUUID} from './utils/uuid';
import {parseJSON} from './utils/parse-json';
import {
  CountryCode,
  LanguageCode,
} from '@shopify/hydrogen-react/storefront-api-types';
import type {
  ClientReturn,
  ClientVariablesInRestParams,
  GenericVariables,
} from '@shopify/hydrogen-codegen';
import {warnOnce} from './utils/warning';
import {LIB_VERSION} from './version';
import {
  minifyQuery,
  assertQuery,
  assertMutation,
  throwErrorWithGqlLink,
  GraphQLError,
  type GraphQLApiResponse,
  type GraphQLErrorOptions,
} from './utils/graphql';
import {
  getCallerStackLine,
  withSyncStack,
  type StackInfo,
} from './utils/callsites';
import type {WaitUntil} from './types';

export type I18nBase = {
  language: LanguageCode;
  country: CountryCode;
};

// When passing GraphQLError through Remix' `json` or `defer`,
// the class instance is lost and it becomes a plain JSON object.
// Therefore, we need make TS think this is a plain object instead of
// a class to make it work in server and client.
// Also, Remix' `Jsonify` type is broken and can't infer types of classes properly.
type JsonGraphQLError = ReturnType<GraphQLError['toJSON']>; // Equivalent to `Jsonify<GraphQLError>[]`
export type StorefrontApiErrors = JsonGraphQLError[] | undefined;

type StorefrontError = {
  errors?: StorefrontApiErrors;
};

/**
 * Wraps all the returned utilities from `createStorefrontClient`.
 */
export type StorefrontClient<TI18n extends I18nBase> = {
  storefront: Storefront<TI18n>;
};

/**
 * Maps all the queries found in the project to variables and return types.
 */
export interface StorefrontQueries {
  // Example of how a generated query type looks like:
  // '#graphql query q1 {...}': {return: Q1Query; variables: Q1QueryVariables};
}

/**
 * Maps all the mutations found in the project to variables and return types.
 */
export interface StorefrontMutations {
  // Example of how a generated mutation type looks like:
  // '#graphql mutation m1 {...}': {return: M1Mutation; variables: M1MutationVariables};
}

// These are the variables that are automatically added to the storefront API.
// We use this type to make parameters optional in storefront client
// when these are the only variables that can be passed.
type AutoAddedVariableNames = 'country' | 'language';

type StorefrontCommonExtraParams = {
  headers?: HeadersInit;
  storefrontApiVersion?: string;
  displayName?: string;
};

/**
 * Interface to interact with the Storefront API.
 */
export type Storefront<TI18n extends I18nBase = I18nBase> = {
  query: <
    OverrideReturnType extends any = never,
    RawGqlString extends string = string,
  >(
    query: RawGqlString,
    ...options: ClientVariablesInRestParams<
      StorefrontQueries,
      RawGqlString,
      StorefrontCommonExtraParams &
        Pick<StorefrontQueryOptions, 'cache' | 'cacheKey'>,
      AutoAddedVariableNames
    >
  ) => Promise<
    ClientReturn<StorefrontQueries, RawGqlString, OverrideReturnType> &
      StorefrontError
  >;
  mutate: <
    OverrideReturnType extends any = never,
    RawGqlString extends string = string,
  >(
    mutation: RawGqlString,
    ...options: ClientVariablesInRestParams<
      StorefrontMutations,
      RawGqlString,
      StorefrontCommonExtraParams,
      AutoAddedVariableNames
    >
  ) => Promise<
    ClientReturn<StorefrontMutations, RawGqlString, OverrideReturnType> &
      StorefrontError
  >;
  cache?: Cache;
  CacheNone: typeof CacheNone;
  CacheLong: typeof CacheLong;
  CacheShort: typeof CacheShort;
  CacheCustom: typeof CacheCustom;
  generateCacheControlHeader: typeof generateCacheControlHeader;
  getPublicTokenHeaders: ReturnType<
    typeof createStorefrontUtilities
  >['getPublicTokenHeaders'];
  getPrivateTokenHeaders: ReturnType<
    typeof createStorefrontUtilities
  >['getPrivateTokenHeaders'];
  getShopifyDomain: ReturnType<
    typeof createStorefrontUtilities
  >['getShopifyDomain'];
  getApiUrl: ReturnType<
    typeof createStorefrontUtilities
  >['getStorefrontApiUrl'];
  i18n: TI18n;
};

type HydrogenClientProps<TI18n> = {
  /** Storefront API headers. If on Oxygen, use `getStorefrontHeaders()` */
  storefrontHeaders?: StorefrontHeaders;
  /** An instance that implements the [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) */
  cache?: Cache;
  /** The globally unique identifier for the Shop */
  storefrontId?: string;
  /** The `waitUntil` function is used to keep the current request/response lifecycle alive even after a response has been sent. It should be provided by your platform. */
  waitUntil?: WaitUntil;
  /** An object containing a country code and language code */
  i18n?: TI18n;
  /** Whether it should print GraphQL errors automatically. Defaults to true */
  logErrors?: boolean | ((error?: Error) => boolean);
};

export type CreateStorefrontClientOptions<TI18n extends I18nBase> =
  HydrogenClientProps<TI18n> & StorefrontClientProps;

type StorefrontHeaders = {
  /** A unique ID that correlates all sub-requests together. */
  requestGroupId: string | null;
  /** The IP address of the client. */
  buyerIp: string | null;
  /** The cookie header from the client  */
  cookie: string | null;
  /** The purpose header value for debugging */
  purpose: string | null;
};

type StorefrontQueryOptions = StorefrontCommonExtraParams & {
  query: string;
  mutation?: never;
  /**
   * Cache strategy.
   */
  cache?: CachingStrategy;
  /**
   * Unique key used for caching. Specify it only if you want
   * to be able to manually invalidate by cache key later.
   */
  cacheKey?: CacheKey;
  /**
   * Tags to associate with this query. Useful to invalidate
   * the cache by specifying one of the tags.
   */
  cacheTags?: string[];
};

type StorefrontMutationOptions = StorefrontCommonExtraParams & {
  query?: never;
  mutation: string;
  cache?: never;
  cacheKey?: never;
  cacheTags?: never;
};

const defaultI18n: I18nBase = {language: 'EN', country: 'US'};

/**
 *  This function extends `createStorefrontClient` from [Hydrogen React](/docs/api/hydrogen-react/2024-07/utilities/createstorefrontclient). The additional arguments enable internationalization (i18n), caching, and other features particular to Remix and Oxygen.
 *
 *  Learn more about [data fetching in Hydrogen](/docs/custom-storefronts/hydrogen/data-fetching/fetch-data).
 */
export function createStorefrontClient<TI18n extends I18nBase>(
  options: CreateStorefrontClientOptions<TI18n>,
): StorefrontClient<TI18n> {
  const {
    storefrontHeaders,
    cache,
    waitUntil,
    i18n,
    storefrontId,
    logErrors = true,
    ...clientOptions
  } = options;
  const H2_PREFIX_WARN = '[h2:warn:createStorefrontClient] ';

  if (process.env.NODE_ENV === 'development' && !cache) {
    warnOnce(
      H2_PREFIX_WARN +
        'Storefront API client created without a cache instance. This may slow down your sub-requests.',
    );
  }

  const {
    getPublicTokenHeaders,
    getPrivateTokenHeaders,
    getStorefrontApiUrl,
    getShopifyDomain,
  } = createStorefrontUtilities(clientOptions);

  const getHeaders = clientOptions.privateStorefrontToken
    ? getPrivateTokenHeaders
    : getPublicTokenHeaders;

  const defaultHeaders = getHeaders({
    contentType: 'json',
    buyerIp: storefrontHeaders?.buyerIp || '',
  });

  defaultHeaders[STOREFRONT_REQUEST_GROUP_ID_HEADER] =
    storefrontHeaders?.requestGroupId || generateUUID();

  if (storefrontId) defaultHeaders[SHOPIFY_STOREFRONT_ID_HEADER] = storefrontId;
  if (LIB_VERSION) defaultHeaders['user-agent'] = `Hydrogen ${LIB_VERSION}`;

  if (storefrontHeaders && storefrontHeaders.cookie) {
    const cookies = getShopifyCookies(storefrontHeaders.cookie ?? '');

    if (cookies[SHOPIFY_Y])
      defaultHeaders[SHOPIFY_STOREFRONT_Y_HEADER] = cookies[SHOPIFY_Y];
    if (cookies[SHOPIFY_S])
      defaultHeaders[SHOPIFY_STOREFRONT_S_HEADER] = cookies[SHOPIFY_S];
  }

  // Remove any headers that are identifiable to the user or request
  const cacheKeyHeader = JSON.stringify({
    'content-type': defaultHeaders['content-type'],
    'user-agent': defaultHeaders['user-agent'],
    [SDK_VARIANT_HEADER]: defaultHeaders[SDK_VARIANT_HEADER],
    [SDK_VARIANT_SOURCE_HEADER]: defaultHeaders[SDK_VARIANT_SOURCE_HEADER],
    [SDK_VERSION_HEADER]: defaultHeaders[SDK_VERSION_HEADER],
    [STOREFRONT_ACCESS_TOKEN_HEADER]:
      defaultHeaders[STOREFRONT_ACCESS_TOKEN_HEADER],
  });

  async function fetchStorefrontApi<T = any>({
    query,
    mutation,
    variables,
    cache: cacheOptions,
    headers = [],
    storefrontApiVersion,
    displayName,
    stackInfo,
    cacheKey,
    cacheTags,
  }: {variables?: GenericVariables; stackInfo?: StackInfo} & (
    | StorefrontQueryOptions
    | StorefrontMutationOptions
  )): Promise<T & StorefrontError> {
    const userHeaders =
      headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : Array.isArray(headers)
        ? Object.fromEntries(headers)
        : headers;

    const document = query ?? mutation;
    const queryVariables = {...variables};

    if (i18n) {
      if (!variables?.country && /\$country/.test(document)) {
        queryVariables.country = i18n.country;
      }

      if (!variables?.language && /\$language/.test(document)) {
        queryVariables.language = i18n.language;
      }
    }

    const url = getStorefrontApiUrl({storefrontApiVersion});
    const graphqlData = JSON.stringify({
      query: document,
      variables: queryVariables,
    });
    const requestInit = {
      method: 'POST',
      headers: {...defaultHeaders, ...userHeaders},
      body: graphqlData,
    } satisfies RequestInit;

    const cacheParams = mutation
      ? undefined
      : {
          cacheInstance: cache,
          cache: cacheOptions ?? CacheDefault(),
          cacheKey: cacheKey ?? [
            url,
            requestInit.method,
            cacheKeyHeader,
            requestInit.body,
          ],
          cacheTags,
          shouldCacheResponse: checkGraphQLErrors,
        };

    const [body, response] = await fetchWithServerCache(url, requestInit, {
      ...cacheParams,
      waitUntil,
      debugInfo: {
        requestId: requestInit.headers[STOREFRONT_REQUEST_GROUP_ID_HEADER],
        displayName,
        url,
        stackInfo,
        graphql: graphqlData,
        purpose: storefrontHeaders?.purpose,
      },
    });

    const errorOptions: GraphQLErrorOptions<T> = {
      url,
      response,
      type: mutation ? 'mutation' : 'query',
      query: document,
      queryVariables,
      errors: undefined,
    };

    if (!response.ok) {
      /**
       * The Storefront API might return a string error, or a JSON-formatted {error: string}.
       * We try both and conform them to a single {errors} format.
       */
      let errors;
      try {
        errors = parseJSON(body);
      } catch (_e) {
        errors = [{message: body}];
      }

      throwErrorWithGqlLink({...errorOptions, errors});
    }

    const {data, errors} = body as GraphQLApiResponse<T>;

    const gqlErrors = errors?.map(
      ({message, ...rest}) =>
        new GraphQLError(message, {
          ...(rest as WritableDeep<typeof rest>),
          clientOperation: `storefront.${errorOptions.type}`,
          requestId: response.headers.get('x-request-id'),
          queryVariables,
          query: document,
        }),
    );

    return formatAPIResult(data, gqlErrors);
  }

  return {
    storefront: {
      /**
       * Sends a GraphQL query to the Storefront API.
       *
       * Example:
       *
       * ```js
       * async function loader ({context: {storefront}}) {
       *   const data = await storefront.query('query { ... }', {
       *     variables: {},
       *     cache: storefront.CacheLong()
       *   });
       * }
       * ```
       */
      query(query, options?) {
        query = minifyQuery(query);
        assertQuery(query, 'storefront.query');

        const stackOffset = getStackOffset?.(query);

        return withSyncStack(
          fetchStorefrontApi({
            ...options,
            query,
            stackInfo: getCallerStackLine?.(stackOffset),
          }),
          {stackOffset, logErrors},
        );
      },
      /**
       * Sends a GraphQL mutation to the Storefront API.
       *
       * Example:
       *
       * ```js
       * async function loader ({context: {storefront}}) {
       *   await storefront.mutate('mutation { ... }', {
       *     variables: {},
       *   });
       * }
       * ```
       */
      mutate(mutation, options?) {
        mutation = minifyQuery(mutation);
        assertMutation(mutation, 'storefront.mutate');

        const stackOffset = getStackOffset?.(mutation);

        return withSyncStack(
          fetchStorefrontApi({
            ...options,
            mutation,
            stackInfo: getCallerStackLine?.(stackOffset),
          }),
          {stackOffset, logErrors},
        );
      },
      cache,
      CacheNone,
      CacheLong,
      CacheShort,
      CacheCustom,
      generateCacheControlHeader,
      getPublicTokenHeaders,
      getPrivateTokenHeaders,
      getShopifyDomain,
      getApiUrl: getStorefrontApiUrl,
      i18n: (i18n ?? defaultI18n) as TI18n,
    },
  };
}

const getStackOffset =
  process.env.NODE_ENV === 'development'
    ? (query: string) => {
        let stackOffset = 0;
        if (/fragment CartApi(Query|Mutation) on Cart/.test(query)) {
          // The cart handler is wrapping storefront.query/mutate,
          // so we need to go up one more stack frame to show
          // the caller in /subrequest-profiler
          stackOffset = 1;
        }

        return stackOffset;
      }
    : undefined;

export function formatAPIResult<T>(
  data: T,
  errors: StorefrontApiErrors,
): T & StorefrontError {
  return {
    ...data,
    ...(errors && {errors}),
  };
}

export type CreateStorefrontClientForDocs<TI18n extends I18nBase> = {
  storefront?: StorefrontForDoc<TI18n>;
};

export type StorefrontForDoc<TI18n extends I18nBase = I18nBase> = {
  /** The function to run a query on Storefront API. */
  query?: <TData = any>(
    query: string,
    options: StorefrontQueryOptionsForDocs,
  ) => Promise<TData & StorefrontError>;
  /** The function to run a mutation on Storefront API. */
  mutate?: <TData = any>(
    mutation: string,
    options: StorefrontMutationOptionsForDocs,
  ) => Promise<TData & StorefrontError>;
  /** The cache instance passed in from the `createStorefrontClient` argument. */
  cache?: Cache;
  /** Re-export of [`CacheNone`](/docs/api/hydrogen/2024-07/utilities/cachenone). */
  CacheNone?: typeof CacheNone;
  /** Re-export of [`CacheLong`](/docs/api/hydrogen/2024-07/utilities/cachelong). */
  CacheLong?: typeof CacheLong;
  /** Re-export of [`CacheShort`](/docs/api/hydrogen/2024-07/utilities/cacheshort). */
  CacheShort?: typeof CacheShort;
  /** Re-export of [`CacheCustom`](/docs/api/hydrogen/2024-07/utilities/cachecustom). */
  CacheCustom?: typeof CacheCustom;
  /** Re-export of [`generateCacheControlHeader`](/docs/api/hydrogen/2024-07/utilities/generatecachecontrolheader). */
  generateCacheControlHeader?: typeof generateCacheControlHeader;
  /** Returns an object that contains headers that are needed for each query to Storefront API GraphQL endpoint. See [`getPublicTokenHeaders` in Hydrogen React](/docs/api/hydrogen-react/2024-07/utilities/createstorefrontclient#:~:text=%27graphql%27.-,getPublicTokenHeaders,-(props%3F%3A) for more details. */
  getPublicTokenHeaders?: ReturnType<
    typeof createStorefrontUtilities
  >['getPublicTokenHeaders'];
  /** Returns an object that contains headers that are needed for each query to Storefront API GraphQL endpoint for API calls made from a server. See [`getPrivateTokenHeaders` in  Hydrogen React](/docs/api/hydrogen-react/2024-07/utilities/createstorefrontclient#:~:text=storefrontApiVersion-,getPrivateTokenHeaders,-(props%3F%3A) for more details.*/
  getPrivateTokenHeaders?: ReturnType<
    typeof createStorefrontUtilities
  >['getPrivateTokenHeaders'];
  /** Creates the fully-qualified URL to your myshopify.com domain. See [`getShopifyDomain` in  Hydrogen React](/docs/api/hydrogen-react/2024-07/utilities/createstorefrontclient#:~:text=StorefrontClientReturn-,getShopifyDomain,-(props%3F%3A) for more details. */
  getShopifyDomain?: ReturnType<
    typeof createStorefrontUtilities
  >['getShopifyDomain'];
  /** Creates the fully-qualified URL to your store's GraphQL endpoint. See [`getStorefrontApiUrl` in  Hydrogen React](/docs/api/hydrogen-react/2024-07/utilities/createstorefrontclient#:~:text=storeDomain-,getStorefrontApiUrl,-(props%3F%3A) for more details.*/
  getApiUrl?: ReturnType<
    typeof createStorefrontUtilities
  >['getStorefrontApiUrl'];
  /** The `i18n` object passed in from the `createStorefrontClient` argument. */
  i18n?: TI18n;
};

export type StorefrontQueryOptionsForDocs = {
  /** The variables for the GraphQL query statement. */
  variables?: Record<string, unknown>;
  /** The cache strategy for this query. Default to max-age=1, stale-while-revalidate=86399. */
  cache?: CachingStrategy;
  /** Additional headers for this query. */
  headers?: HeadersInit;
  /** Override the Storefront API version for this query. */
  storefrontApiVersion?: string;
  /** The name of the query for debugging in the Subrequest Profiler. */
  displayName?: string;
};

export type StorefrontMutationOptionsForDocs = {
  /** The variables for the GraphQL mutation statement. */
  variables?: Record<string, unknown>;
  /** Additional headers for this query. */
  headers?: HeadersInit;
  /** Override the Storefront API version for this query. */
  storefrontApiVersion?: string;
  /** The name of the query for debugging in the Subrequest Profiler. */
  displayName?: string;
};
