import type {HydrogenSession} from '../types';
import {BadRequest} from './BadRequest';
import {
  USER_AGENT,
  CUSTOMER_API_CLIENT_ID,
  CUSTOMER_ACCOUNT_SESSION_KEY,
  BUYER_SESSION_KEY,
} from './constants';

type H2OEvent = Parameters<NonNullable<typeof __H2O_LOG_EVENT>>[0];

export interface Locks {
  refresh?: Promise<any>;
}

export const logSubRequestEvent =
  process.env.NODE_ENV === 'development'
    ? ({
        url,
        response,
        startTime,
        query,
        variables,
        ...debugInfo
      }: {
        url: H2OEvent['url'];
        response: Response;
        startTime: H2OEvent['startTime'];
        query?: string;
        variables?: Record<string, any> | null;
      } & Partial<H2OEvent>) => {
        globalThis.__H2O_LOG_EVENT?.({
          ...debugInfo,
          eventType: 'subrequest',
          url,
          startTime,
          graphql: query
            ? JSON.stringify({query, variables, schema: 'customer-account'})
            : undefined,
          responseInit: {
            status: response.status || 0,
            statusText: response.statusText || '',
            headers: Array.from(response.headers.entries() || []),
          },
        });
      }
    : undefined;

export function redirect(
  path: string,
  options: {status?: number; headers?: {}} = {},
) {
  const headers = options.headers
    ? new Headers(options.headers)
    : new Headers({});
  headers.set('location', path);

  return new Response(null, {status: options.status || 302, headers});
}

export interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  error?: string;
  error_description?: string;
}

export async function refreshToken({
  session,
  customerAccountId,
  customerAccountTokenExchangeUrl,
  httpsOrigin,
  debugInfo,
}: {
  session: HydrogenSession;
  customerAccountId: string;
  customerAccountTokenExchangeUrl: string;
  httpsOrigin: string;
  debugInfo?: Partial<H2OEvent>;
}) {
  const newBody = new URLSearchParams();

  const customerAccount = session.get(CUSTOMER_ACCOUNT_SESSION_KEY);
  const refreshToken = customerAccount?.refreshToken;
  const idToken = customerAccount?.idToken;

  if (!refreshToken)
    throw new BadRequest(
      'Unauthorized',
      'No refreshToken found in the session. Make sure your session is configured correctly and passed to `createCustomerAccountClient`.',
    );

  newBody.append('grant_type', 'refresh_token');
  newBody.append('refresh_token', refreshToken);
  newBody.append('client_id', customerAccountId);

  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'User-Agent': USER_AGENT,
    Origin: httpsOrigin,
  };

  const startTime = new Date().getTime();
  const url = customerAccountTokenExchangeUrl;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: newBody,
  });

  logSubRequestEvent?.({
    displayName: 'Customer Account API: access token refresh',
    url,
    startTime,
    response,
    ...debugInfo,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  const {
    access_token,
    expires_in,
    refresh_token,
  }: Omit<AccessTokenResponse, 'id_token'> = await response.json();

  const accessToken = await exchangeAccessToken(
    access_token,
    customerAccountId,
    customerAccountTokenExchangeUrl,
    httpsOrigin,
    debugInfo,
  );

  session.set(CUSTOMER_ACCOUNT_SESSION_KEY, {
    accessToken,
    // Store the date in future the token expires, separated by two minutes
    expiresAt:
      new Date(new Date().getTime() + (expires_in - 120) * 1000).getTime() + '',
    refreshToken: refresh_token,
    idToken,
  });
}

export function clearSession(session: HydrogenSession): void {
  session.unset(CUSTOMER_ACCOUNT_SESSION_KEY);
  session.unset(BUYER_SESSION_KEY);
}

export async function checkExpires({
  locks,
  expiresAt,
  session,
  customerAccountId,
  customerAccountTokenExchangeUrl,
  httpsOrigin,
  debugInfo,
}: {
  locks: Locks;
  expiresAt: string;
  session: HydrogenSession;
  customerAccountId: string;
  customerAccountTokenExchangeUrl: string;
  httpsOrigin: string;
  debugInfo?: Partial<H2OEvent>;
}) {
  if (parseInt(expiresAt, 10) - 1000 < new Date().getTime()) {
    try {
      // Makes sure that only one refresh request is sent at a time
      if (!locks.refresh)
        locks.refresh = refreshToken({
          session,
          customerAccountId,
          customerAccountTokenExchangeUrl,
          httpsOrigin,
          debugInfo,
        });

      await locks.refresh;
      delete locks.refresh;
    } catch (error) {
      clearSession(session);

      if (error && (error as Response).status !== 401) {
        throw error;
      } else {
        throw new BadRequest(
          'Unauthorized',
          'Login before querying the Customer Account API.',
        );
      }
    }
  }
}

export function generateCodeVerifier() {
  const rando = generateRandomCode();
  return base64UrlEncode(rando);
}

export async function generateCodeChallenge(codeVerifier: string) {
  const digestOp = await crypto.subtle.digest(
    {name: 'SHA-256'},
    new TextEncoder().encode(codeVerifier),
  );
  const hash = convertBufferToString(digestOp);
  return base64UrlEncode(hash);
}

export function generateRandomCode() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return String.fromCharCode.apply(null, Array.from(array));
}

function base64UrlEncode(str: string) {
  const base64 = btoa(str);
  // This is to ensure that the encoding does not have +, /, or = characters in it.
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function convertBufferToString(hash: ArrayBuffer) {
  const uintArray = new Uint8Array(hash);
  const numberArray = Array.from(uintArray);
  return String.fromCharCode(...numberArray);
}

export function generateState() {
  const timestamp = Date.now().toString();
  const randomString = Math.random().toString(36).substring(2);
  return timestamp + randomString;
}

export async function exchangeAccessToken(
  authAccessToken: string | undefined,
  customerAccountId: string,
  customerAccountTokenExchangeUrl: string,
  httpsOrigin: string,
  debugInfo?: Partial<H2OEvent>,
) {
  const clientId = customerAccountId;

  if (!authAccessToken)
    throw new BadRequest(
      'Unauthorized',
      'oAuth access token was not provided during token exchange.',
    );

  const body = new URLSearchParams();

  body.append('grant_type', 'urn:ietf:params:oauth:grant-type:token-exchange');
  body.append('client_id', clientId);
  body.append('audience', CUSTOMER_API_CLIENT_ID);
  body.append('subject_token', authAccessToken);
  body.append(
    'subject_token_type',
    'urn:ietf:params:oauth:token-type:access_token',
  );
  body.append('scopes', 'https://api.customers.com/auth/customer.graphql');

  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    'User-Agent': USER_AGENT,
    Origin: httpsOrigin,
  };

  const startTime = new Date().getTime();
  const url = customerAccountTokenExchangeUrl;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  logSubRequestEvent?.({
    displayName: 'Customer Account API: access token exchange',
    url,
    startTime,
    response,
    ...debugInfo,
  });

  const data: AccessTokenResponse = await response.json();

  if (data.error) {
    throw new BadRequest(data.error_description);
  }

  return data.access_token;
}

export function getNonce(token: string) {
  return decodeJwt(token).payload.nonce;
}

function decodeJwt(token: string) {
  const [header, payload, signature] = token.split('.');

  const decodedHeader = JSON.parse(atob(header));
  const decodedPayload = JSON.parse(atob(payload));

  return {
    header: decodedHeader,
    payload: decodedPayload,
    signature,
  };
}
