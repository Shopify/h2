import {
  createStorefrontClient,
  type CreateStorefrontClientOptions,
  type StorefrontClient,
  type I18nBase,
} from './storefront';
import {createCustomerAccountClient} from './customer/customer';
import {
  type CustomerAccountOptions,
  type CustomerAccount,
} from './customer/types';
import {
  createCartHandler,
  type CartHandlerOptions,
  type CustomMethodsBase,
  type HydrogenCart,
  type HydrogenCartCustom,
} from './cart/createCartHandler';
import {cartGetIdDefault} from './cart/cartGetIdDefault';
import {cartSetIdDefault} from './cart/cartSetIdDefault';
import type {
  HydrogenEnv,
  WaitUntil,
  HydrogenSession,
  StorefrontHeaders,
} from './types';
import {type CrossRuntimeRequest, getHeader} from './utils/request';

export type HydrogenContextOptions<
  TSession extends HydrogenSession = HydrogenSession,
  TCustomMethods extends CustomMethodsBase | undefined = {},
  TI18n extends I18nBase = I18nBase,
  TEnv extends HydrogenEnv = Env,
> = {
  /* Environment variables from the fetch function */
  env: TEnv;
  /* Request object from the fetch function */
  request: CrossRuntimeRequest;
  /** An instance that implements the [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) */
  cache?: Cache;
  /** The `waitUntil` function is used to keep the current request/response lifecycle alive even after a response has been sent. It should be provided by your platform. */
  waitUntil?: WaitUntil;
  /** Any cookie implementation. By default Hydrogen ships with cookie session storage, but you can use [another session storage](https://remix.run/docs/en/main/utils/sessions) implementation.  */
  session: TSession;
  /** An object containing a country code and language code */
  i18n?: TI18n;
  /** Whether it should print GraphQL errors automatically. Defaults to true */
  logErrors?: boolean | ((error?: Error) => boolean);
  /** Storefront client overwrite options. See documentation for createStorefrontClient for more information. */
  storefront?: {
    /** Storefront API headers. Default values set from request header.  */
    headers?: CreateStorefrontClientOptions<TI18n>['storefrontHeaders'];
    /** Override the Storefront API version for this query. */
    apiVersion?: CreateStorefrontClientOptions<TI18n>['storefrontApiVersion'];
  };
  /** Customer Account client overwrite options. See documentation for createCustomerAccountClient for more information. */
  customerAccount?: {
    /** Override the version of the API */
    apiVersion?: CustomerAccountOptions['customerApiVersion'];
    /** This is the route in your app that authorizes the customer after logging in. Make sure to call `customer.authorize()` within the loader on this route. It defaults to `/account/authorize`. */
    authUrl?: CustomerAccountOptions['authUrl'];
    /** Use this method to overwrite the default logged-out redirect behavior. The default handler [throws a redirect](https://remix.run/docs/en/main/utils/redirect#:~:text=!session) to `/account/login` with current path as `return_to` query param. */
    customAuthStatusHandler?: CustomerAccountOptions['customAuthStatusHandler'];
  };
  /** Cart handler overwrite options. See documentation for createCartHandler for more information. */
  cart?: {
    /** A function that returns the cart id in the form of `gid://shopify/Cart/c1-123`. */
    getId?: CartHandlerOptions['getCartId'];
    /** A function that sets the cart ID. */
    setId?: CartHandlerOptions['setCartId'];
    /**
     * The cart query fragment used by `cart.get()`.
     * See the [example usage](/docs/api/hydrogen/2025-01/utilities/createcarthandler#example-cart-fragments) in the documentation.
     */
    queryFragment?: CartHandlerOptions['cartQueryFragment'];
    /**
     * The cart mutation fragment used in most mutation requests, except for `setMetafields` and `deleteMetafield`.
     * See the [example usage](/docs/api/hydrogen/2025-01/utilities/createcarthandler#example-cart-fragments) in the documentation.
     */
    mutateFragment?: CartHandlerOptions['cartMutateFragment'];
    /**
     * Define custom methods or override existing methods for your cart API instance.
     * See the [example usage](/docs/api/hydrogen/2025-01/utilities/createcarthandler#example-custom-methods) in the documentation.
     */
    customMethods?: TCustomMethods;
  };
};

export interface HydrogenContext<
  TSession extends HydrogenSession = HydrogenSession,
  TCustomMethods extends CustomMethodsBase | undefined = {},
  TI18n extends I18nBase = I18nBase,
  TEnv extends HydrogenEnv = Env,
> {
  /** A GraphQL client for querying the [Storefront API](https://shopify.dev/docs/api/storefront). */
  storefront: StorefrontClient<TI18n>['storefront'];
  /** A GraphQL client for querying the [Customer Account API](https://shopify.dev/docs/api/customer). It also provides methods to authenticate and check if the user is logged in. */
  customerAccount: CustomerAccount;
  /** A collection of utilities used to interact with the cart. */
  cart: TCustomMethods extends CustomMethodsBase
    ? HydrogenCartCustom<TCustomMethods>
    : HydrogenCart;
  /* Request object from the fetch function */
  env: TEnv;
  /** The `waitUntil` function is used to keep the current request/response lifecycle alive even after a response has been sent. It should be provided by your platform. */
  waitUntil?: WaitUntil;
  /** Any cookie implementation. By default Hydrogen ships with cookie session storage, but you can use [another session storage](https://remix.run/docs/en/main/utils/sessions) implementation.  */
  session: TSession;
}

// Since HydrogenContext uses a conditional type with a free type parameter,
// TS cannot definitively determine what the return type should be within the function body
// HydrogenContextOverloads is use to restore type assertions so we don't need to do type casting
export interface HydrogenContextOverloads<
  TSession extends HydrogenSession,
  TCustomMethods extends CustomMethodsBase,
  TI18n extends I18nBase = I18nBase,
  TEnv extends HydrogenEnv = Env,
> {
  storefront: StorefrontClient<TI18n>['storefront'];
  customerAccount: CustomerAccount;
  cart: HydrogenCart | HydrogenCartCustom<TCustomMethods>;
  env: TEnv;
  waitUntil?: WaitUntil;
  session: TSession;
}

// type for createHydrogenContext methods
export function createHydrogenContext<
  TSession extends HydrogenSession = HydrogenSession,
  TCustomMethods extends CustomMethodsBase | undefined = {},
  TI18n extends I18nBase = I18nBase,
  TEnv extends HydrogenEnv = Env,
>(
  options: HydrogenContextOptions<TSession, TCustomMethods, TI18n, TEnv>,
): HydrogenContext<TSession, TCustomMethods, TI18n, TEnv>;

export function createHydrogenContext<
  TSession extends HydrogenSession,
  TCustomMethods extends CustomMethodsBase,
  TI18n extends I18nBase,
  TEnv extends HydrogenEnv = Env,
>(
  options: HydrogenContextOptions<TSession, TCustomMethods, TI18n, TEnv>,
): HydrogenContextOverloads<TSession, TCustomMethods, TI18n, TEnv> {
  const {
    env,
    request,
    cache,
    waitUntil,
    i18n,
    session,
    logErrors,
    storefront: storefrontOptions = {},
    customerAccount: customerAccountOptions,
    cart: cartOptions = {},
  } = options;

  if (!session) {
    console.warn(
      `[h2:warn:createHydrogenContext] A session object is required to create hydrogen context.`,
    );
  }

  /**
   * Create Hydrogen's Storefront client.
   */
  const {storefront} = createStorefrontClient<TI18n>({
    // share options
    cache,
    waitUntil,
    i18n,
    logErrors,

    // storefrontOptions
    storefrontHeaders:
      storefrontOptions.headers || getStorefrontHeaders(request),
    storefrontApiVersion: storefrontOptions.apiVersion,

    // defaults
    storefrontId: env.PUBLIC_STOREFRONT_ID,
    storeDomain: env.PUBLIC_STORE_DOMAIN,
    privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
    publicStorefrontToken: env.PUBLIC_STOREFRONT_API_TOKEN,
  });

  const customerAccount = createCustomerAccountClient({
    // share options
    session,
    request,
    waitUntil,
    logErrors,

    // customerAccountOptions
    customerApiVersion: customerAccountOptions?.apiVersion,
    authUrl: customerAccountOptions?.authUrl,
    customAuthStatusHandler: customerAccountOptions?.customAuthStatusHandler,

    // defaults
    customerAccountId: env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID,
    shopId: env.SHOP_ID,
  });

  /*
   * Create a cart handler that will be used to
   * create and update the cart in the session.
   */
  const cart = createCartHandler({
    // cartOptions
    getCartId: cartOptions.getId || cartGetIdDefault(request.headers),
    setCartId: cartOptions.setId || cartSetIdDefault(),
    cartQueryFragment: cartOptions.queryFragment,
    cartMutateFragment: cartOptions.mutateFragment,
    customMethods: cartOptions.customMethods,

    // defaults
    storefront,
    customerAccount,
  });

  return {
    storefront,
    customerAccount,
    cart,
    env,
    waitUntil,
    session,
  };
}

function getStorefrontHeaders(request: CrossRuntimeRequest): StorefrontHeaders {
  return {
    requestGroupId: getHeader(request, 'request-id'),
    buyerIp: getHeader(request, 'oxygen-buyer-ip'),
    cookie: getHeader(request, 'cookie'),
    purpose: getHeader(request, 'purpose'),
  };
}

export type HydrogenContextOptionsForDocs<
  TSession extends HydrogenSession = HydrogenSession,
  TI18n extends I18nBase = I18nBase,
  TEnv extends HydrogenEnv = Env,
> = {
  /* Environment variables from the fetch function */
  env: TEnv;
  /* Request object from the fetch function */
  request: CrossRuntimeRequest;
  /** An instance that implements the [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) */
  cache?: Cache;
  /** The `waitUntil` function is used to keep the current request/response lifecycle alive even after a response has been sent. It should be provided by your platform. */
  waitUntil?: WaitUntil;
  /** Any cookie implementation. By default Hydrogen ships with cookie session storage, but you can use [another session storage](https://remix.run/docs/en/main/utils/sessions) implementation.  */
  session: TSession;
  /** An object containing a country code and language code */
  i18n?: TI18n;
  /** Whether it should print GraphQL errors automatically. Defaults to true */
  logErrors?: boolean | ((error?: Error) => boolean);
  /** Storefront client overwrite options. See documentation for createStorefrontClient for more information. */
  storefront?: {
    /** Storefront API headers. Default values set from request header.  */
    headers?: StorefrontHeaders;
    /** Override the Storefront API version for this query. */
    apiVersion?: string;
  };
  /** Customer Account client overwrite options. See documentation for createCustomerAccountClient for more information. */
  customerAccount?: {
    /** Override the version of the API */
    apiVersion?: string;
    /** This is the route in your app that authorizes the customer after logging in. Make sure to call `customer.authorize()` within the loader on this route. It defaults to `/account/authorize`. */
    authUrl?: string;
    /** Use this method to overwrite the default logged-out redirect behavior. The default handler [throws a redirect](https://remix.run/docs/en/main/utils/redirect#:~:text=!session) to `/account/login` with current path as `return_to` query param. */
    customAuthStatusHandler?: () => Response | NonNullable<unknown> | null;
  };
  /** Cart handler overwrite options. See documentation for createCartHandler for more information. */
  cart?: {
    /** A function that returns the cart id in the form of `gid://shopify/Cart/c1-123`. */
    getId?: () => string | undefined;
    /** A function that sets the cart ID. */
    setId?: (cartId: string) => Headers;
    /**
     * The cart query fragment used by `cart.get()`.
     * See the [example usage](/docs/api/hydrogen/2025-01/utilities/createcarthandler#example-cart-fragments) in the documentation.
     */
    queryFragment?: string;
    /**
     * The cart mutation fragment used in most mutation requests, except for `setMetafields` and `deleteMetafield`.
     * See the [example usage](/docs/api/hydrogen/2025-01/utilities/createcarthandler#example-cart-fragments) in the documentation.
     */
    mutateFragment?: string;
    /**
     * Define custom methods or override existing methods for your cart API instance.
     * See the [example usage](/docs/api/hydrogen/2025-01/utilities/createcarthandler#example-custom-methods) in the documentation.
     */
    customMethods?: Record<string, Function>;
  };
};
