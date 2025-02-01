import type {GenericVariables} from '@shopify/hydrogen-codegen';
import type {WritableDeep} from 'type-fest';
import {
  DEFAULT_CUSTOMER_API_VERSION,
  CUSTOMER_ACCOUNT_SESSION_KEY,
  BUYER_SESSION_KEY,
  USER_AGENT,
} from './constants';
import {
  clearSession,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  checkExpires,
  exchangeAccessToken,
  AccessTokenResponse,
  getNonce,
  redirect,
  Locks,
  logSubRequestEvent,
} from './auth.helpers';
import {BadRequest} from './BadRequest';
import {generateNonce} from '../csp/nonce';
import {
  minifyQuery,
  assertQuery,
  assertMutation,
  throwErrorWithGqlLink,
  type GraphQLErrorOptions,
  GraphQLError,
} from '../utils/graphql';
import {parseJSON} from '../utils/parse-json';
import {
  CrossRuntimeRequest,
  getHeader,
  getDebugHeaders,
} from '../utils/request';
import {getCallerStackLine, withSyncStack} from '../utils/callsites';
import {
  getRedirectUrl,
  ensureLocalRedirectUrl,
} from '../utils/get-redirect-url';
import type {
  CustomerAccountOptions,
  CustomerAccount,
  CustomerAPIResponse,
  LoginOptions,
  LogoutOptions,
  Buyer,
} from './types';
import {createCustomerAccountHelper, URL_TYPE} from './customer-account-helper';
import {warnOnce} from '../utils/warning';

function defaultAuthStatusHandler(
  request: CrossRuntimeRequest,
  defaultLoginUrl: string,
) {
  if (!request.url) return defaultLoginUrl;

  const {pathname} = new URL(request.url);

  /**
   * Remix (single-fetch) request objects have different url
   * paths when soft navigating. Examples:
   *
   *    /_root.data          - home page
   *    /collections.data    - collections page
   *
   * These url annotations needs to be cleaned up before constructing urls to be passed as
   * GET parameters for customer login url
   */
  const cleanedPathname = pathname
    .replace(/\.data$/, '')
    .replace(/\/_root$/, '/')
    .replace(/(.+)\/$/, '$1');

  const redirectTo =
    defaultLoginUrl +
    `?${new URLSearchParams({return_to: cleanedPathname}).toString()}`;

  return redirect(redirectTo);
}

export function createCustomerAccountClient({
  session,
  customerAccountId,
  shopId,
  customerApiVersion = DEFAULT_CUSTOMER_API_VERSION,
  request,
  waitUntil,
  authUrl,
  customAuthStatusHandler,
  logErrors = true,
  unstableB2b = false,
  loginPath = '/account/login',
  authorizePath = '/account/authorize',
  defaultRedirectPath = '/account',
}: CustomerAccountOptions): CustomerAccount {
  if (customerApiVersion !== DEFAULT_CUSTOMER_API_VERSION) {
    console.warn(
      `[h2:warn:createCustomerAccountClient] You are using Customer Account API version ${customerApiVersion} when this version of Hydrogen was built for ${DEFAULT_CUSTOMER_API_VERSION}.`,
    );
  }

  if (!session) {
    console.warn(
      `[h2:warn:createCustomerAccountClient] session is required to use Customer Account API. Ensure the session object passed in exist.`,
    );
  }

  if (!request?.url) {
    throw new Error(
      '[h2:error:createCustomerAccountClient] The request object does not contain a URL.',
    );
  }

  const authStatusHandler = customAuthStatusHandler
    ? customAuthStatusHandler
    : () => defaultAuthStatusHandler(request, loginPath);

  const requestUrl = new URL(request.url);
  const httpsOrigin =
    requestUrl.protocol === 'http:'
      ? requestUrl.origin.replace('http', 'https')
      : requestUrl.origin;
  const redirectUri = ensureLocalRedirectUrl({
    requestUrl: httpsOrigin,
    defaultUrl: authorizePath,
    redirectUrl: authUrl,
  });

  const getCustomerAccountUrl = createCustomerAccountHelper(
    customerApiVersion,
    shopId,
  );

  const ifInvalidCredentialThrowError = createIfInvalidCredentialThrowError(
    getCustomerAccountUrl,
    customerAccountId,
  );

  const customerAccountApiUrl = getCustomerAccountUrl(URL_TYPE.GRAPHQL);
  const locks: Locks = {};

  async function fetchCustomerAPI<T>({
    query,
    type,
    variables = {},
  }: {
    query: string;
    type: 'query' | 'mutation';
    variables?: GenericVariables;
  }) {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw authStatusHandler();
    }

    // Get stack trace before losing it with any async operation.
    // Since this is an internal function that is always called from
    // the public query/mutate wrappers, add 1 to the stack offset.
    const stackInfo = getCallerStackLine?.();

    const startTime = new Date().getTime();

    const response = await fetch(customerAccountApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Origin: httpsOrigin,
        Authorization: accessToken,
      },
      body: JSON.stringify({query, variables}),
    });

    logSubRequestEvent?.({
      url: customerAccountApiUrl,
      startTime,
      response,
      waitUntil,
      stackInfo,
      query,
      variables,
      ...getDebugHeaders(request),
    });

    const body = await response.text();

    const errorOptions: GraphQLErrorOptions<T> = {
      url: customerAccountApiUrl,
      response,
      type,
      query,
      queryVariables: variables,
      errors: undefined,
      client: 'customer',
    };

    if (!response.ok) {
      if (response.status === 401) {
        // clear session because current access token is invalid
        clearSession(session);

        const authFailResponse = authStatusHandler();
        throw authFailResponse;
      }

      /**
       * The Customer API might return a string error, or a JSON-formatted {error: string}.
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

    try {
      const APIresponse = parseJSON(body) as CustomerAPIResponse<T>;
      const {errors} = APIresponse;

      const gqlErrors = errors?.map(
        ({message, ...rest}) =>
          new GraphQLError(message, {
            ...(rest as WritableDeep<typeof rest>),
            clientOperation: `customerAccount.${errorOptions.type}`,
            requestId: response.headers.get('x-request-id'),
            queryVariables: variables,
            query,
          }),
      );

      return {...APIresponse, ...(errors && {errors: gqlErrors})};
    } catch (e) {
      throwErrorWithGqlLink({...errorOptions, errors: [{message: body}]});
    }
  }

  async function isLoggedIn() {
    if (!shopId) return false;

    const customerAccount = session.get(CUSTOMER_ACCOUNT_SESSION_KEY);
    const accessToken = customerAccount?.accessToken;
    const expiresAt = customerAccount?.expiresAt;

    if (!accessToken || !expiresAt) return false;

    // Get stack trace before losing it with any async operation.
    const stackInfo = getCallerStackLine?.();

    try {
      await checkExpires({
        locks,
        expiresAt,
        session,
        customerAccountId,
        customerAccountTokenExchangeUrl: getCustomerAccountUrl(
          URL_TYPE.TOKEN_EXCHANGE,
        ),
        httpsOrigin,
        debugInfo: {
          waitUntil,
          stackInfo,
          ...getDebugHeaders(request),
        },
        exchangeForStorefrontCustomerAccessToken,
      });
    } catch {
      return false;
    }

    return true;
  }

  async function handleAuthStatus() {
    if (!(await isLoggedIn())) {
      throw authStatusHandler();
    }
  }

  async function getAccessToken() {
    const hasAccessToken = await isLoggedIn();

    if (hasAccessToken)
      return session.get(CUSTOMER_ACCOUNT_SESSION_KEY)?.accessToken;
  }

  async function mutate(
    mutation: Parameters<CustomerAccount['mutate']>[0],
    options?: Parameters<CustomerAccount['mutate']>[1],
  ) {
    ifInvalidCredentialThrowError();

    mutation = minifyQuery(mutation);
    assertMutation(mutation, 'customer.mutate');

    return withSyncStack(
      fetchCustomerAPI({query: mutation, type: 'mutation', ...options}),
      {logErrors},
    );
  }

  async function query(
    query: Parameters<CustomerAccount['query']>[0],
    options?: Parameters<CustomerAccount['query']>[1],
  ) {
    ifInvalidCredentialThrowError();

    query = minifyQuery(query);
    assertQuery(query, 'customer.query');

    return withSyncStack(fetchCustomerAPI({query, type: 'query', ...options}), {
      logErrors,
    });
  }

  function setBuyer(buyer: Buyer) {
    session.set(BUYER_SESSION_KEY, {
      ...session.get(BUYER_SESSION_KEY),
      ...buyer,
    });
  }

  async function getBuyer() {
    // check loggedIn and trigger refresh if expire
    const hasAccessToken = await isLoggedIn();

    if (!hasAccessToken) {
      return;
    }

    return session.get(BUYER_SESSION_KEY);
  }

  async function exchangeForStorefrontCustomerAccessToken() {
    if (!unstableB2b) {
      return;
    }

    const STOREFRONT_CUSTOMER_ACCOUNT_TOKEN_CREATE = `#graphql
      mutation storefrontCustomerAccessTokenCreate {
        storefrontCustomerAccessTokenCreate {
          customerAccessToken
        }
      }
    `;

    // Remove hard coded type later
    const {data} = (await mutate(STOREFRONT_CUSTOMER_ACCOUNT_TOKEN_CREATE)) as {
      data: {
        storefrontCustomerAccessTokenCreate?: {
          customerAccessToken?: string;
        };
      };
    };

    const customerAccessToken =
      data?.storefrontCustomerAccessTokenCreate?.customerAccessToken;

    if (customerAccessToken) {
      setBuyer({
        customerAccessToken,
      });
    }
  }

  return {
    login: async (options?: LoginOptions) => {
      ifInvalidCredentialThrowError();
      const loginUrl = new URL(getCustomerAccountUrl(URL_TYPE.AUTH));

      const state = generateState();
      const nonce = generateNonce();

      loginUrl.searchParams.set('client_id', customerAccountId);
      loginUrl.searchParams.set('scope', 'openid email');
      loginUrl.searchParams.append('response_type', 'code');
      loginUrl.searchParams.append('redirect_uri', redirectUri);
      loginUrl.searchParams.set(
        'scope',
        getCustomerAccountUrl(URL_TYPE.LOGIN_SCOPE),
      );
      loginUrl.searchParams.append('state', state);
      loginUrl.searchParams.append('nonce', nonce);

      if (options?.uiLocales) {
        const [language, region] = options.uiLocales.split('-');
        let locale = language.toLowerCase();
        if (region) {
          locale += `-${region.toUpperCase()}`;
        }
        loginUrl.searchParams.append('ui_locales', locale);
      }

      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      session.set(CUSTOMER_ACCOUNT_SESSION_KEY, {
        ...session.get(CUSTOMER_ACCOUNT_SESSION_KEY),
        codeVerifier: verifier,
        state,
        nonce,
        redirectPath:
          getRedirectUrl(request.url) ||
          getHeader(request, 'Referer') ||
          defaultRedirectPath,
      });

      loginUrl.searchParams.append('code_challenge', challenge);
      loginUrl.searchParams.append('code_challenge_method', 'S256');

      return redirect(loginUrl.toString());
    },

    logout: async (options?: LogoutOptions) => {
      ifInvalidCredentialThrowError();

      const idToken = session.get(CUSTOMER_ACCOUNT_SESSION_KEY)?.idToken;
      const postLogoutRedirectUri = ensureLocalRedirectUrl({
        requestUrl: httpsOrigin,
        defaultUrl: httpsOrigin,
        redirectUrl: options?.postLogoutRedirectUri,
      });

      const logoutUrl = idToken
        ? new URL(
            `${getCustomerAccountUrl(URL_TYPE.LOGOUT)}?${new URLSearchParams([
              ['id_token_hint', idToken],
              ['post_logout_redirect_uri', postLogoutRedirectUri],
            ]).toString()}`,
          ).toString()
        : postLogoutRedirectUri;

      clearSession(session);

      return redirect(logoutUrl, {headers: options?.headers || {}});
    },
    isLoggedIn,
    handleAuthStatus,
    getAccessToken,
    getApiUrl: () => customerAccountApiUrl,
    mutate: mutate as CustomerAccount['mutate'],
    query: query as CustomerAccount['query'],
    authorize: async () => {
      ifInvalidCredentialThrowError();

      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');

      if (!code || !state) {
        clearSession(session);

        throw new BadRequest(
          'Unauthorized',
          'No code or state parameter found in the redirect URL.',
        );
      }

      if (session.get(CUSTOMER_ACCOUNT_SESSION_KEY)?.state !== state) {
        clearSession(session);

        throw new BadRequest(
          'Unauthorized',
          'The session state does not match the state parameter. Make sure that the session is configured correctly and passed to `createCustomerAccountClient`.',
        );
      }

      const clientId = customerAccountId;
      const body = new URLSearchParams();

      body.append('grant_type', 'authorization_code');
      body.append('client_id', clientId);
      body.append('redirect_uri', redirectUri);
      body.append('code', code);

      // Public Client
      const codeVerifier = session.get(
        CUSTOMER_ACCOUNT_SESSION_KEY,
      )?.codeVerifier;

      if (!codeVerifier)
        throw new BadRequest(
          'Unauthorized',
          'No code verifier found in the session. Make sure that the session is configured correctly and passed to `createCustomerAccountClient`.',
        );

      body.append('code_verifier', codeVerifier);

      const headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        Origin: httpsOrigin,
      };

      const stackInfo = getCallerStackLine?.();
      const startTime = new Date().getTime();
      const url = getCustomerAccountUrl(URL_TYPE.TOKEN_EXCHANGE);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      logSubRequestEvent?.({
        url,
        displayName: 'Customer Account API: authorize',
        startTime,
        response,
        waitUntil,
        stackInfo,
        ...getDebugHeaders(request),
      });

      if (!response.ok) {
        throw new Response(await response.text(), {
          status: response.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }

      const {
        access_token,
        expires_in,
        id_token,
        refresh_token,
      }: AccessTokenResponse = await response.json();

      const sessionNonce = session.get(CUSTOMER_ACCOUNT_SESSION_KEY)?.nonce;
      const responseNonce = await getNonce(id_token);

      if (sessionNonce !== responseNonce) {
        throw new BadRequest(
          'Unauthorized',
          `Returned nonce does not match: ${sessionNonce} !== ${responseNonce}`,
        );
      }

      let customerAccessToken = access_token;

      if (!shopId) {
        customerAccessToken = await exchangeAccessToken(
          access_token,
          customerAccountId,
          getCustomerAccountUrl(URL_TYPE.TOKEN_EXCHANGE),
          httpsOrigin,
          {
            waitUntil,
            stackInfo,
            ...getDebugHeaders(request),
          },
        );
      }

      const redirectPath = session.get(
        CUSTOMER_ACCOUNT_SESSION_KEY,
      )?.redirectPath;

      session.set(CUSTOMER_ACCOUNT_SESSION_KEY, {
        accessToken: customerAccessToken,
        expiresAt:
          new Date(new Date().getTime() + (expires_in - 120) * 1000).getTime() +
          '',
        refreshToken: refresh_token,
        idToken: id_token,
      });

      await exchangeForStorefrontCustomerAccessToken();

      return redirect(redirectPath || defaultRedirectPath);
    },
    UNSTABLE_setBuyer: setBuyer,
    UNSTABLE_getBuyer: getBuyer,
  };
}

function createIfInvalidCredentialThrowError(
  getCustomerAccountUrl: (urlType: URL_TYPE) => string,
  customerAccountId?: string,
) {
  return function ifInvalidCredentialThrowError() {
    try {
      if (!customerAccountId) throw Error();

      new URL(getCustomerAccountUrl(URL_TYPE.CA_BASE_URL));
      new URL(getCustomerAccountUrl(URL_TYPE.CA_BASE_AUTH_URL));
    } catch {
      console.error(
        new Error(
          '[h2:error:customerAccount] You do not have the valid credential to use Customer Account API.\nRun `h2 env pull` to link your store credentials.',
        ),
      );

      const publicMessage =
        process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : 'You do not have the valid credential to use Customer Account API (/account).';

      throw new Response(publicMessage, {status: 500});
    }
  };
}
