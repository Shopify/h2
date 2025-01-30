import type {
  PredictiveSearchQuery,
  RegularSearchQuery,
} from 'storefrontapi.generated';

type ResultWithItems<Type extends 'predictive' | 'regular', Items> = {
  type: Type;
  term: string;
  error?: string;
  result: {total: number; items: Items};
};

export type RegularSearchReturn = ResultWithItems<
  'regular',
  RegularSearchQuery
>;
export type PredictiveSearchReturn = ResultWithItems<
  'predictive',
  NonNullable<PredictiveSearchQuery['predictiveSearch']>
>;

/**
 * Returns the empty state of a predictive search result to reset the search state.
 */
export function getEmptyPredictiveSearchResult(): PredictiveSearchReturn['result'] {
  return {
    total: 0,
    items: {
      articles: [],
      collections: [],
      products: [],
      pages: [],
      queries: [],
    },
  };
}

interface UrlWithTrackingParams {
  /** The base URL to which the tracking parameters will be appended. */
  baseUrl: string;
  /** The trackingParams returned by the Storefront API. */
  trackingParams?: string | null;
  /** Any additional query parameters to be appended to the URL. */
  params?: Record<string, string>;
  /** The search term to be appended to the URL. */
  term: string;
}

/**
 * A utility function that appends tracking parameters to a URL. Tracking parameters are
 * used internally by Shopify to enhance search results and admin dashboards.
 * @example
 * ```ts
 * const baseUrl = 'www.example.com';
 * const trackingParams = 'utm_source=shopify&utm_medium=shopify_app&utm_campaign=storefront';
 * const params = { foo: 'bar' };
 * const term = 'search term';
 * const url = urlWithTrackingParams({ baseUrl, trackingParams, params, term });
 * console.log(url);
 * // Output: 'https://www.example.com?foo=bar&q=search%20term&utm_source=shopify&utm_medium=shopify_app&utm_campaign=storefront'
 * ```
 */
export function urlWithTrackingParams({
  baseUrl,
  trackingParams,
  params: extraParams,
  term,
}: UrlWithTrackingParams) {
  let search = new URLSearchParams({
    ...extraParams,
    q: encodeURIComponent(term),
  }).toString();

  if (trackingParams) {
    search = `${search}&${trackingParams}`;
  }

  return `${baseUrl}?${search}`;
}
