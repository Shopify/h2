/**
 * This file is used to provide types for doc examples.
 * Do not place here types needed for the library itself.
 */

import type {HydrogenContext} from './src/index';
import type {WaitUntil, HydrogenEnv} from './src/types';

declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: {env: {NODE_ENV: 'production' | 'development'}};

  interface Env extends HydrogenEnv {
    // declare additional Env parameter use in the fetch handler and Remix loader context here
  }

  /**
   * This type is used to import types from mini-oxygen
   */
  interface ExecutionContext {
    waitUntil: WaitUntil;
  }

  /**
   * This type is used to import types from mini-oxygen
   */
  type ExportedHandlerFetchHandler = Function;
}

declare module '@shopify/remix-oxygen' {
  interface AppLoadContext extends HydrogenContext<AppSession> {
    // declare additional Remix loader context here
  }

  interface SessionData extends HydrogenSessionData {
    // declare local additions to the Remix session data here
  }
}

declare module '@remix-run/server-runtime' {
  interface Future {
    v3_singleFetch: true;
  }
}
