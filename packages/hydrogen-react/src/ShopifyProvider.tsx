import {createContext, useContext, useMemo, type ReactNode} from 'react';
import type {LanguageCode, CountryCode} from './storefront-api-types.js';
import {SFAPI_VERSION} from './storefront-api-constants.js';
import {getPublicTokenHeadersRaw} from './storefront-client.js';
import {useHydrogenContext} from './HydrogenProvider.js';

export const defaultShopifyContext: ShopifyContextValue = {
  storeDomain: 'test',
  storefrontToken: 'abc123',
  storefrontApiVersion: SFAPI_VERSION,
  countryIsoCode: 'US',
  languageIsoCode: 'EN',
  getStorefrontApiUrl() {
    return '';
  },
  getPublicTokenHeaders() {
    return {};
  },
  getShopifyDomain() {
    return '';
  },
};

const ShopifyContext = createContext<ShopifyContextValue>(
  defaultShopifyContext,
);

/**
 * The `<ShopifyProvider/>` component enables use of the `useShop()` hook. The component should wrap your app.
 */
export function ShopifyProvider({
  children,
  ...shopifyConfig
}: ShopifyProviderProps): JSX.Element {
  if (
    !shopifyConfig.countryIsoCode ||
    !shopifyConfig.languageIsoCode ||
    !shopifyConfig.storeDomain ||
    !shopifyConfig.storefrontToken ||
    !shopifyConfig.storefrontApiVersion
  ) {
    throw new Error(
      `Please provide the necessary props to '<ShopifyProvider/>'`,
    );
  }

  if (shopifyConfig.storefrontApiVersion !== SFAPI_VERSION) {
    console.warn(
      `<ShopifyProvider/>: This version of Hydrogen React is built for Shopify's Storefront API version ${SFAPI_VERSION}, but it looks like you're using version ${shopifyConfig.storefrontApiVersion}. There may be issues or bugs if you use a mismatched version of Hydrogen React and the Storefront API.`,
    );
  }

  const finalConfig = useMemo<ShopifyContextValue>(() => {
    function getShopifyDomain(overrideProps?: {storeDomain?: string}): string {
      const domain = overrideProps?.storeDomain ?? shopifyConfig.storeDomain;
      return domain.includes('://') ? domain : `https://${domain}`;
    }

    return {
      ...shopifyConfig,
      getPublicTokenHeaders(overrideProps): Record<string, string> {
        return getPublicTokenHeadersRaw(
          overrideProps.contentType,
          shopifyConfig.storefrontApiVersion,
          overrideProps.storefrontToken ?? shopifyConfig.storefrontToken,
        );
      },
      getShopifyDomain,
      getStorefrontApiUrl(overrideProps): string {
        const finalDomainUrl = getShopifyDomain({
          storeDomain: overrideProps?.storeDomain ?? shopifyConfig.storeDomain,
        });
        return `${finalDomainUrl}${
          finalDomainUrl.endsWith('/') ? '' : '/'
        }api/${
          overrideProps?.storefrontApiVersion ??
          shopifyConfig.storefrontApiVersion
        }/graphql.json`;
      },
    };
  }, [shopifyConfig]);

  return (
    <ShopifyContext.Provider value={finalConfig}>
      {children}
    </ShopifyContext.Provider>
  );
}

/**
 * Provides access to the `shopifyConfig` prop of `<ShopifyProvider/>`. Must be a descendent of `<ShopifyProvider/>`.
 */
export function useShop(): ShopifyContextValue {
  const shopContext = useContext(ShopifyContext);
  if (!shopContext) {
    throw new Error(`'useShop()' must be a descendent of <ShopifyProvider/>`);
  }

  const hydrogenContext = useHydrogenContext();

  return {
    ...shopContext,
    countryIsoCode:
      hydrogenContext.countryIsoCode ?? shopContext.countryIsoCode,
    languageIsoCode:
      hydrogenContext.languageIsoCode ?? shopContext.languageIsoCode,
  };
}

export interface ShopifyProviderBase {
  /** The globally-unique identifier for the Shop */
  storefrontId?: string;
  /** The full domain of your Shopify storefront URL (eg: the complete string of `{subdomain}.myshopify.com`). */
  storeDomain: string;
  /** The Storefront API public access token. Refer to the [authentication](https://shopify.dev/api/storefront#authentication) documentation for more details. */
  storefrontToken: string;
  /** The Storefront API version. This should almost always be the same as the version Hydrogen React was built for. Learn more about Shopify [API versioning](https://shopify.dev/api/usage/versioning) for more details.  */
  storefrontApiVersion: string;
  /**
   * The code designating a country, which generally follows ISO 3166-1 alpha-2 guidelines. If a territory doesn't have a country code value in the `CountryCode` enum, it might be considered a subdivision of another country. For example, the territories associated with Spain are represented by the country code `ES`, and the territories associated with the United States of America are represented by the country code `US`.
   */
  countryIsoCode: CountryCode;
  /**
   * `ISO 369` language codes supported by Shopify.
   */
  languageIsoCode: LanguageCode;
}

/**
 * Shopify-specific values that are used in various Hydrogen React components and hooks.
 */
export interface ShopifyProviderProps extends ShopifyProviderBase {
  /** React children to render. */
  children?: ReactNode;
}

export interface ShopifyContextValue
  extends ShopifyProviderBase,
    ShopifyContextReturn {}

type ShopifyContextReturn = {
  /**
   * Creates the fully-qualified URL to your store's GraphQL endpoint.
   *
   * By default, it will use the config you passed in when creating `<ShopifyProvider/>`. However, you can override the following settings on each invocation of `getStorefrontApiUrl({...})`:
   *
   * - `storeDomain`
   * - `storefrontApiVersion`
   */
  getStorefrontApiUrl: (props?: GetStorefrontApiUrlProps) => string;
  /**
   * Returns an object that contains headers that are needed for each query to Storefront API GraphQL endpoint. This uses the public Storefront API token.
   *
   * By default, it will use the config you passed in when creating `<ShopifyProvider/>`. However, you can override the following settings on each invocation of `getPublicTokenHeaders({...})`:
   *
   * - `contentType`
   * - `storefrontToken`
   *
   */
  getPublicTokenHeaders: (
    props: GetPublicTokenHeadersProps,
  ) => Record<string, string>;
  /**
   * Creates the fully-qualified URL to your myshopify.com domain.
   *
   * By default, it will use the config you passed in when calling `<ShopifyProvider/>`. However, you can override the following settings on each invocation of `getShopifyDomain({...})`:
   *
   * - `storeDomain`
   */
  getShopifyDomain: (props?: GetShopifyDomainProps) => string;
};

type GetStorefrontApiUrlProps = {
  /** The host name of the domain (eg: `{shop}.myshopify.com`). */
  storeDomain?: string;
  /** The Storefront API version. This should almost always be the same as the version Hydrogen-UI was built for. Learn more about Shopify [API versioning](https://shopify.dev/api/usage/versioning) for more details. */
  storefrontApiVersion?: string;
};

type GetPublicTokenHeadersProps = {
  /**
   * Customizes which `"content-type"` header is added when using `getPrivateTokenHeaders()` and `getPublicTokenHeaders()`. When fetching with a `JSON.stringify()`-ed `body`, use `"json"`. When fetching with a `body` that is a plain string, use `"graphql"`. Defaults to `"json"`
   */
  contentType: 'json' | 'graphql';
  /** The Storefront API access token. Refer to the [authentication](https://shopify.dev/api/storefront#authentication) documentation for more details. */
  storefrontToken?: string;
};

type GetShopifyDomainProps = {storeDomain?: string};
