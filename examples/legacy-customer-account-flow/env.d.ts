/// <reference types="vite/client" />
/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/oxygen-workers-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

import type {ShopifyContext, ShopifyEnv} from '@shopify/hydrogen';
import type {CustomerAccessToken} from '@shopify/hydrogen/storefront-api-types';
import type {AppSession} from '~/lib/session';

declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: {env: {NODE_ENV: 'production' | 'development'}};

  /**
   * Declare expected Env parameter in fetch handler.
   */
  interface Env extends ShopifyEnv {}
}

declare module '@shopify/remix-oxygen' {
  /**
   * Declare local additions to the Remix loader context.
   */
  export interface AppLoadContext
    extends ShopifyContext<
      /***********************************************/
      /**********  EXAMPLE UPDATE STARTS  ************/
      {language: 'EN'; country: 'US'},
      true
      /**********   EXAMPLE UPDATE END   ************/
      /***********************************************/
    > {
    env: Env;
    session: AppSession;
    waitUntil: ExecutionContext['waitUntil'];
  }

  /**
   * Declare the data we expect to access via `context.session`.
   */
  export interface SessionData {
    customerAccessToken: CustomerAccessToken;
  }
}
