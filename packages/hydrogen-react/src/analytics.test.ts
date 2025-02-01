import {vi, afterEach, describe, it, expect} from 'vitest';
import {AnalyticsEventName} from './analytics-constants.js';
import {BASE_PAYLOAD} from './analytics-schema.test.helpers.js';
import {getClientBrowserParameters, sendShopifyAnalytics} from './analytics.js';

const MONORAIL_ENDPOINT =
  'https://monorail-edge.shopifysvc.com/unstable/produce_batch';
const getShopDomainMonorailEndpoint = (shopDomain = '') => {
  return `https://${shopDomain}/.well-known/shopify/monorail/unstable/produce_batch`;
};
const createFetchSpy = ({
  expectEventCounts,
  shopDomain,
  failResponse,
}: {
  expectEventCounts: number;
  shopDomain?: string;
  failResponse?: boolean;
}) => {
  const mockFetch = async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    // Mock Monorail endpoint
    const shopDomainMonorailEndpoint =
      getShopDomainMonorailEndpoint(shopDomain);
    if (input === MONORAIL_ENDPOINT || input === shopDomainMonorailEndpoint) {
      if (init?.body) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const reqData = init.body.toString();
        const data = JSON.parse(reqData || '{}') as unknown;

        // If this expect fails, it will be captured by the
        // spy function on console.error
        // @ts-expect-error - data is unknown
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.events.length).toEqual(expectEventCounts);

        if (failResponse) {
          return new Promise((resolve) => {
            resolve(
              new Response('', {
                status: 400,
              }),
            );
          });
        }

        // Mock Monorail returning a multi-status response
        // @ts-expect-error - data is unknown
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!data.events[0].payload.shopId && !data.events[0].payload.shop_id) {
          return new Promise((resolve) => {
            resolve(
              new Response(
                JSON.stringify({
                  result: [
                    {
                      status: 400,
                      message: 'Schema validation error',
                    },
                  ],
                }),
                {
                  status: 207,
                },
              ),
            );
          });
        }
      }

      // Mock Monorail returning a 200 response
      return new Promise((resolve) => {
        resolve(
          new Response('', {
            status: 200,
          }),
        );
      });
    }

    throw new Error('Analytics fetch mock - request not handled');
  };
  return vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
};
const createConsoleErrorSpy = () => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return vi.spyOn(console, 'error').mockImplementation(() => {});
};
const originalDocument = document;
const originalPerformance = performance;
const originalPerformanceNavigation = globalThis.PerformanceNavigation;

describe('analytics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    /* eslint-disable no-global-assign */
    document = originalDocument;
    performance = originalPerformance;
    globalThis.PerformanceNavigation = originalPerformanceNavigation;
    /* eslint-enable no-global-assign */
  });

  describe('sendShopifyAnalytics', () => {
    it('with a page view event', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const fetchSpy = createFetchSpy({expectEventCounts: 2});

      await sendShopifyAnalytics({
        eventName: AnalyticsEventName.PAGE_VIEW,
        payload: {
          ...BASE_PAYLOAD,
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('does not do anything if payload.hasUserConsent is false', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const fetchSpy = createFetchSpy({expectEventCounts: 0});

      await sendShopifyAnalytics({
        eventName: AnalyticsEventName.PAGE_VIEW,
        payload: {
          ...BASE_PAYLOAD,
          hasUserConsent: false,
        },
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('with a page view event that has a bad payload', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const fetchSpy = createFetchSpy({expectEventCounts: 2});

      await sendShopifyAnalytics({
        eventName: AnalyticsEventName.PAGE_VIEW,
        payload: {
          ...BASE_PAYLOAD,
          shopId: 'NaN',
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe(
        'sendShopifyAnalytics request is unsuccessful',
      );
    });

    it('with a product page view event', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const fetchSpy = createFetchSpy({expectEventCounts: 3});

      await sendShopifyAnalytics({
        eventName: AnalyticsEventName.PAGE_VIEW,
        payload: {
          ...BASE_PAYLOAD,
          pageType: 'product',
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('with an add to cart event', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const fetchSpy = createFetchSpy({expectEventCounts: 1});

      await sendShopifyAnalytics({
        eventName: AnalyticsEventName.ADD_TO_CART,
        payload: {
          ...BASE_PAYLOAD,
          cartId: 'gid://shopify/Cart/abc123',
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('with a page view event to a shop monorail endpoint', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const shopDomain = 'my-shop.myshopify.com';
      const fetchSpy = createFetchSpy({
        expectEventCounts: 2,
        shopDomain,
      });

      await sendShopifyAnalytics(
        {
          eventName: AnalyticsEventName.PAGE_VIEW,
          payload: {
            ...BASE_PAYLOAD,
          },
        },
        shopDomain,
      );

      expect(fetchSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('with a failed response', async () => {
      const consoleErrorSpy = createConsoleErrorSpy();
      const fetchSpy = createFetchSpy({
        expectEventCounts: 2,
        failResponse: true,
      });

      await expect(
        async () =>
          await sendShopifyAnalytics({
            eventName: AnalyticsEventName.PAGE_VIEW,
            payload: {
              ...BASE_PAYLOAD,
            },
          }),
      ).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe(
        'sendShopifyAnalytics request is unsuccessful',
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(consoleErrorSpy.mock.calls[0][1].toString()).toContain(
        'Error: Response failed',
      );
    });
  });

  describe('getClientBrowserParameters', () => {
    it('errors and returns empty object when executed on server side', () => {
      /* eslint-disable @typescript-eslint/ban-ts-comment, no-global-assign */
      // @ts-ignore
      document = undefined;
      /* eslint-enable @typescript-eslint/ban-ts-comment, no-global-assign */
      const consoleErrorSpy = createConsoleErrorSpy();
      const browserParams = getClientBrowserParameters();

      expect(browserParams).toEqual({
        uniqueToken: '',
        visitToken: '',
        url: '',
        path: '',
        search: '',
        referrer: '',
        title: '',
        userAgent: '',
        navigationType: '',
        navigationApi: '',
      });
      expect(consoleErrorSpy.mock.calls[0][0]).toBe(
        'getClientBrowserParameters should only be used within the useEffect callback or event handlers',
      );
    });

    it('returns browser parameters when executed on client side', () => {
      /* eslint-disable @typescript-eslint/ban-ts-comment, no-global-assign */
      // @ts-ignore
      document = {
        title: 'test',
        referrer: 'https://www.example.com',
        cookie: '_shopify_y=abc123; _shopify_s=def456',
      };
      /* eslint-enable @typescript-eslint/ban-ts-comment, no-global-assign */

      const consoleErrorSpy = createConsoleErrorSpy();
      const browserParams = getClientBrowserParameters();

      expect(browserParams).toEqual({
        uniqueToken: 'abc123',
        visitToken: 'def456',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        url: expect.any(String),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        path: expect.any(String),
        search: '',
        referrer: 'https://www.example.com',
        title: 'test',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        userAgent: expect.any(String),
        navigationType: 'unknown',
        navigationApi: 'unknown',
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('returns PerformanceNavigationTiming reload navigation api types', () => {
      /* eslint-disable @typescript-eslint/ban-ts-comment, no-global-assign */
      // @ts-ignore
      document = {
        cookie: '',
        title: '',
        referrer: '',
      };
      // @ts-ignore
      performance = {
        // @ts-ignore
        getEntriesByType: () => {
          return [
            {
              type: 'reload',
            },
          ];
        },
      };
      /* eslint-enable @typescript-eslint/ban-ts-comment, no-global-assign */

      const consoleErrorSpy = createConsoleErrorSpy();
      const browserParams = getClientBrowserParameters();

      expect(browserParams.navigationType).toEqual('reload');
      expect(browserParams.navigationApi).toEqual(
        'PerformanceNavigationTiming',
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('returns performance.navigation api types', () => {
      /* eslint-disable @typescript-eslint/ban-ts-comment, no-global-assign */
      // @ts-ignore
      document = {
        cookie: '',
        title: '',
        referrer: '',
      };
      // @ts-ignore
      globalThis.PerformanceNavigation = {
        TYPE_NAVIGATE: 0,
        TYPE_RELOAD: 1,
        TYPE_BACK_FORWARD: 2,
      };
      // @ts-ignore
      performance = {
        // @ts-ignore
        navigation: {
          type: PerformanceNavigation.TYPE_NAVIGATE,
        },
      };
      /* eslint-enable @typescript-eslint/ban-ts-comment, no-global-assign */

      const consoleErrorSpy = createConsoleErrorSpy();
      let browserParams = getClientBrowserParameters();

      expect(browserParams.navigationType).toEqual('navigate');
      expect(browserParams.navigationApi).toEqual('performance.navigation');

      updateNavigationType(PerformanceNavigation.TYPE_RELOAD);
      browserParams = getClientBrowserParameters();
      expect(browserParams.navigationType).toEqual('reload');
      expect(browserParams.navigationApi).toEqual('performance.navigation');

      updateNavigationType(PerformanceNavigation.TYPE_BACK_FORWARD);
      browserParams = getClientBrowserParameters();
      expect(browserParams.navigationType).toEqual('back_forward');
      expect(browserParams.navigationApi).toEqual('performance.navigation');

      updateNavigationType(4);
      browserParams = getClientBrowserParameters();
      expect(browserParams.navigationType).toEqual('unknown: 4');
      expect(browserParams.navigationApi).toEqual('performance.navigation');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});

function updateNavigationType(apiType: number) {
  /* eslint-disable @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  performance.navigation.type = apiType;
  /* eslint-enable @typescript-eslint/ban-ts-comment */
}
