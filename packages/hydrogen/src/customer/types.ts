import type {
  ClientReturn,
  ClientVariablesInRestParams,
} from '@shopify/hydrogen-codegen';
import {type GraphQLError} from '../utils/graphql';
import type {CrossRuntimeRequest} from '../utils/request';
import type {HydrogenSession, WaitUntil} from '../types';
import type {
  LanguageCode,
  BuyerInput,
} from '@shopify/hydrogen-react/storefront-api-types';

// Return type of unauthorizedHandler = Return type of loader/action function
// This type is not exported https://github.com/remix-run/react-router/blob/main/packages/router/utils.ts#L167
type DataFunctionValue = Response | NonNullable<unknown> | null;

type JsonGraphQLError = ReturnType<GraphQLError['toJSON']>; // Equivalent to `Jsonify<GraphQLError>[]`

export type Buyer = Partial<BuyerInput>;

export type CustomerAPIResponse<ReturnType> = {
  data: ReturnType;
  errors: Array<{
    message: string;
    locations?: Array<{line: number; column: number}>;
    path?: Array<string>;
    extensions: {code: string};
  }>;
  extensions: {
    cost: {
      requestQueryCost: number;
      actualQueryCakes: number;
      throttleStatus: {
        maximumAvailable: number;
        currentAvailable: number;
        restoreRate: number;
      };
    };
  };
};

export interface CustomerAccountQueries {
  // Example of how a generated query type looks like:
  // '#graphql query q1 {...}': {return: Q1Query; variables: Q1QueryVariables};
}

export interface CustomerAccountMutations {
  // Example of how a generated mutation type looks like:
  // '#graphql mutation m1 {...}': {return: M1Mutation; variables: M1MutationVariables};
}

export type LoginOptions = {
  uiLocales?: LanguageCode;
};

export type LogoutOptions = {
  postLogoutRedirectUri?: string;
  headers?: HeadersInit;
};

export type CustomerAccount = {
  /** Start the OAuth login flow. This function should be called and returned from a Remix loader.
   * It redirects the customer to a Shopify login domain. It also defined the final path the customer
   * lands on at the end of the oAuth flow with the value of the `return_to` query param. (This is
   * automatically setup unless `customAuthStatusHandler` option is in use)
   *
   * @param options.uiLocales - The displayed language of the login page. Only support for the following languages:
   * `en`, `fr`, `cs`, `da`, `de`, `es`, `fi`, `it`, `ja`, `ko`, `nb`, `nl`, `pl`, `pt-BR`, `pt-PT`,
   * `sv`, `th`, `tr`, `vi`, `zh-CN`, `zh-TW`. If supplied any other language code, it will default to `en`.
   * */
  login: (options?: LoginOptions) => Promise<Response>;
  /** On successful login, the customer redirects back to your app. This function validates the OAuth response and exchanges the authorization code for an access token and refresh token. It also persists the tokens on your session. This function should be called and returned from the Remix loader configured as the redirect URI within the Customer Account API settings in admin. */
  authorize: () => Promise<Response>;
  /** Returns if the customer is logged in. It also checks if the access token is expired and refreshes it if needed. */
  isLoggedIn: () => Promise<boolean>;
  /** Check for a not logged in customer and redirect customer to login page. The redirect can be overwritten with `customAuthStatusHandler` option. */
  handleAuthStatus: () => void | DataFunctionValue;
  /** Returns CustomerAccessToken if the customer is logged in. It also run a expiry check and does a token refresh if needed. */
  getAccessToken: () => Promise<string | undefined>;
  /** Creates the fully-qualified URL to your store's GraphQL endpoint.*/
  getApiUrl: () => string;
  /** Logout the customer by clearing the session and redirecting to the login domain. It should be called and returned from a Remix action. The path app should redirect to after logout can be setup in Customer Account API settings in admin.
   *
   * @param options.postLogoutRedirectUri - The url to redirect customer to after logout, should be a relative URL. This url will need to included in Customer Account API's application setup for logout URI. The default value is current app origin, which is automatically setup in admin when using `--customer-account-push` flag with dev.
   * @param options.headers - These will be passed along to the logout redirect. You can use these to set/clear cookies on logout, like the cart.
   * */
  logout: (options?: LogoutOptions) => Promise<Response>;
  /** Execute a GraphQL query against the Customer Account API. This method execute `handleAuthStatus()` ahead of query. */
  query: <
    OverrideReturnType extends any = never,
    RawGqlString extends string = string,
  >(
    query: RawGqlString,
    ...options: ClientVariablesInRestParams<
      CustomerAccountQueries,
      RawGqlString
    >
  ) => Promise<
    Omit<
      CustomerAPIResponse<
        ClientReturn<CustomerAccountQueries, RawGqlString, OverrideReturnType>
      >,
      'errors'
    > & {errors?: JsonGraphQLError[]}
  >;
  /** Execute a GraphQL mutation against the Customer Account API. This method execute `handleAuthStatus()` ahead of mutation. */
  mutate: <
    OverrideReturnType extends any = never,
    RawGqlString extends string = string,
  >(
    mutation: RawGqlString,
    ...options: ClientVariablesInRestParams<
      CustomerAccountMutations,
      RawGqlString
    >
  ) => Promise<
    Omit<
      CustomerAPIResponse<
        ClientReturn<CustomerAccountMutations, RawGqlString, OverrideReturnType>
      >,
      'errors'
    > & {errors?: JsonGraphQLError[]}
  >;
  /** Set buyer information into session.*/
  setBuyer: (buyer: Buyer) => void;
  /** Get buyer token and company location id from session.*/
  getBuyer: () => Promise<Buyer>;
};

export type CustomerAccountOptions = {
  /** The client requires a session to persist the auth and refresh token. By default Hydrogen ships with cookie session storage, but you can use [another session storage](https://remix.run/docs/en/main/utils/sessions) implementation.  */
  session: HydrogenSession;
  /** Unique UUID prefixed with `shp_` associated with the application, this should be visible in the customer account api settings in the Hydrogen admin channel. Mock.shop doesn't automatically supply customerAccountId. Use `npx shopify hydrogen env pull` to link your store credentials. */
  customerAccountId: string;
  /** The shop id. Mock.shop doesn't automatically supply shopId. Use `npx shopify hydrogen env pull` to link your store credentials */
  shopId: string;
  /** Override the version of the API */
  customerApiVersion?: string;
  /** The object for the current Request. It should be provided by your platform. */
  request: CrossRuntimeRequest;
  /** The waitUntil function is used to keep the current request/response lifecycle alive even after a response has been sent. It should be provided by your platform. */
  waitUntil?: WaitUntil;
  /** This is the route in your app that authorizes the customer after logging in. Make sure to call `customer.authorize()` within the loader on this route. It defaults to `/account/authorize`. */
  authUrl?: string;
  /** Use this method to overwrite the default logged-out redirect behavior. The default handler [throws a redirect](https://remix.run/docs/en/main/utils/redirect#:~:text=!session) to `/account/login` with current path as `return_to` query param. */
  customAuthStatusHandler?: () => DataFunctionValue;
  /** Whether it should print GraphQL errors automatically. Defaults to true */
  logErrors?: boolean | ((error?: Error) => boolean);
  /** The path to redirect to after login. Defaults to `/account`. */
  defaultRedirectPath?: string;
  /** The path to login. Defaults to `/account/login`. */
  loginPath?: string;
  /** The oauth authorize path. Defaults to `/account/authorize`. */
  authorizePath?: string;
};

/** Below are types meant for documentation only. Ensure it stay in sync with the type above. */

export type CustomerAccountForDocs = {
  /** Start the OAuth login flow. This function should be called and returned from a Remix action.
   * It redirects the customer to a Shopify login domain. It also defined the final path the customer
   * lands on at the end of the oAuth flow with the value of the `return_to` query param. (This is
   * automatically setup unless `customAuthStatusHandler` option is in use)
   *
   * @param options.uiLocales - The displayed language of the login page. Only support for the following languages:
   * `en`, `fr`, `cs`, `da`, `de`, `es`, `fi`, `it`, `ja`, `ko`, `nb`, `nl`, `pl`, `pt-BR`, `pt-PT`,
   * `sv`, `th`, `tr`, `vi`, `zh-CN`, `zh-TW`. If supplied any other language code, it will default to `en`.
   * */
  login?: (options?: LoginOptions) => Promise<Response>;
  /** On successful login, the customer redirects back to your app. This function validates the OAuth response and exchanges the authorization code for an access token and refresh token. It also persists the tokens on your session. This function should be called and returned from the Remix loader configured as the redirect URI within the Customer Account API settings in admin. */
  authorize?: () => Promise<Response>;
  /** Returns if the customer is logged in. It also checks if the access token is expired and refreshes it if needed. */
  isLoggedIn?: () => Promise<boolean>;
  /** Check for a not logged in customer and redirect customer to login page. The redirect can be overwritten with `customAuthStatusHandler` option. */
  handleAuthStatus?: () => void | DataFunctionValue;
  /** Returns CustomerAccessToken if the customer is logged in. It also run a expiry check and does a token refresh if needed. */
  getAccessToken?: () => Promise<string | undefined>;
  /** Creates the fully-qualified URL to your store's GraphQL endpoint.*/
  getApiUrl?: () => string;
  /** Logout the customer by clearing the session and redirecting to the login domain. It should be called and returned from a Remix action. The path app should redirect to after logout can be setup in Customer Account API settings in admin.
   *
   * @param options.postLogoutRedirectUri - The url to redirect customer to after logout, should be a relative URL. This url will need to included in Customer Account API's application setup for logout URI. The default value is current app origin, which is automatically setup in admin when using `--customer-account-push` flag with dev.
   * */
  logout?: (options?: LogoutOptions) => Promise<Response>;
  /** Execute a GraphQL query against the Customer Account API. This method execute `handleAuthStatus()` ahead of query. */
  query?: <TData = any>(
    query: string,
    options: CustomerAccountQueryOptionsForDocs,
  ) => Promise<TData>;
  /** Execute a GraphQL mutation against the Customer Account API. This method execute `handleAuthStatus()` ahead of mutation. */
  mutate?: <TData = any>(
    mutation: string,
    options: CustomerAccountQueryOptionsForDocs,
  ) => Promise<TData>;
};

export type CustomerAccountQueryOptionsForDocs = {
  /** The variables for the GraphQL statement. */
  variables?: Record<string, unknown>;
};
