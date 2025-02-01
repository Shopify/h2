# Hydrogen example: Partytown + Google Tag Manager + CSP

This folder contains a peformance-oriented example lazy-loading [Google Tag Manager](https://support.google.com/tagmanager)
using [Partytown](https://partytown.builder.io/).

Party town helps relocate resource intensive scripts off the main thread into a web worker.

## Requirements

- [Google Tag Manager ID] - Log in to your Google Tag Manager account and open a container. In the top right corner (next to the Submit and Preview buttons) you'll see some short text that starts with GTM- and then contains some letters/numbers. That's your Google Tag Manager ID
- [Basic Partytown knowledge](https://dev.to/adamdbradley/introducing-partytown-run-third-party-scripts-from-a-web-worker-2cnp) - Introducing Partytown: Run Third-Party Scripts From a Web Worker

## Install

Setup a new project with this example:

```bash
npm create @shopify/hydrogen@latest -- --template partytown
```

## Key files

The following files have been added (🆕) or changed from the default Hydration template:

| File                                                                                              | Description                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🆕 [`.env`](.env)                                                                                 | Example environment variable file. Copy the relevant variables to your existing `.env` file, if you have one.                                                                                     |
| 🆕 [`app/components/PartytownGoogleTagManager.tsx`](app/components/PartytownGoogleTagManager.tsx) | A component that loads Google Tag Manager in a web worker via Partytown with built-in CSP support.                                                                                                |
| 🆕 [`app/utils/partytown/maybeProxyRequest.ts`](app/utils/partytown/maybeProxyRequest.ts)         | A Partytown url resolver to control which 3P scripts should be reverse-proxied. Used in Partytown's [resolveUrl](https://partytown.builder.io/proxying-requests#configuring-url-proxies) property |
| 🆕 [`app/utils/partytown/partytownAtomicHeaders.ts`](app/lib/partytown/partytownAtomicHeaders.ts) | Utility that returns the required headers to enable [Atomics mode](https://partytown.builder.io/atomics) for added performance                                                                    |
| 🆕 [`app/routes/reverse-proxy.ts`](app/routes/reverse-proxy.ts)                                   | A route that acts as a [reverse proxy](https://partytown.builder.io/proxying-requests#reverse-proxy) for 3P scripts that require CORS headers                                                     |
| [`app/root.tsx`](app/root.tsx)                                                                    | The root layout where Partytown and GTM is implemented                                                                                                                                            |
| [`app/routes/_index.tsx`](app/routes/_index.tsx)                                                  | The home route where a GTM `pageView` event is emmited                                                                                                                                            |
| [`app/entry.server.tsx`](app/entry.server.tsx)                                                    | Add GTM domain to the script-src directive                                                                                                                                                        |

## Dependencies

| Module                                                                          | Description                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 🆕 [@builder.io/partytown](https://www.npmjs.com/package/@builder.io/partytown) | Party town helps relocate resource intensive scripts off the main thread into a web worker. |

## Instructions

### 1. Install required dependencies

```bash
npm i @builder.io/partytown
```

### 2. Modify npm scripts

In `package.json` modify the `build` script and add the `partytown` script

Add the `partytown` script which copies the [library files](https://partytown.builder.io/copy-library-files) to `/public`

```diff
  "scripts": {
+    "partytown": "partytown copylib public/~partytown"
  },
```

Modify the `build` script to copy the partytown library files to `/public` before every build

```diff
  "scripts": {
-    "build": "shopify hydrogen build",
+    "build": "npm run partytown && shopify hydrogen build",
  },
```

[View the complete component file](package.json) to see these updates in context.

### 3. Copy the library files

```bash
npm run partytown
```

### 4. Copy over the new files

- In your Hydrogen app, create the new files from the file list above, copying in the code as you go.
- If you already have a `.env` file, copy over these key-value pairs:
  - `GTM_CONTAINER_ID` - To obtain your GTM container ID follow these [instructions](https://support.google.com/tagmanager/answer/6103696?hl=en&ref_topic=3441530&sjid=7981978906794913873-NC)

### 5. Edit the `root.tsx` layout file

Import the required components and utilties

```ts
import {Partytown} from '@builder.io/partytown/react';
import {PartytownGoogleTagManager} from '~/components/PartytownGoogleTagManager';
import {maybeProxyRequest} from '~/utils/partytown/maybeProxyRequest';
import {partytownAtomicHeaders} from '~/utils/partytown/partytownAtomicHeaders';
```

Update the `loader` function

```ts
export async function loader({context}: LoaderFunctionArgs) {
  const layout = await context.storefront.query<{shop: Shop}>(LAYOUT_QUERY);
  return data(
    {
      layout,
      // 1. Pass the GTM container ID to the client
      gtmContainerId: context.env.GTM_CONTAINER_ID,
    },
    {
      // 2. Enable atomic mode
      headers: partytownAtomicHeaders(),
    },
  );
}
```

Update the App component

```ts
export default function App() {
  // 1. Retrieve the GTM container ID
  const {gtmContainerId} = useLoaderData<typeof loader>();
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>

      <body>
        <Outlet />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />

        {/* 2. Initialize the GTM dataLayer container */}
        <Script
          type="text/partytown"
          dangerouslySetInnerHTML={{
            __html: `
              dataLayer = window.dataLayer || [];

              window.gtag = function () {
                dataLayer.push(arguments);
              };

              window.gtag('js', new Date());
              window.gtag('config', "${gtmContainerId}");
            `,
          }}
        />

        {/* 3. Include the GTM component */}
        <PartytownGoogleTagManager gtmContainerId={gtmContainerId} />

        {/* 4. Initialize PartyTown */}
        <Partytown
          nonce={nonce}
          forward={['dataLayer.push', 'gtag']}
          resolveUrl={maybeProxyRequest}
        />
      </body>
    </html>
  );
}
```

[View the complete component file](app/root.tsx) to see these updates in context.

## 6. (Optional) - Update Content Security Policy

Add `wwww.googletagmanager.com` domain to the `scriptSrc` directive

```diff
//...other code

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
- const {nonce, header, NonceProvider} = createContentSecurityPolicy();
+  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
+    scriptSrc: ["'self'", 'cdn.shopify.com', 'www.googletagmanager.com'],
+ });

  //...other code

  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

```

[View the complete component file](app/entry.server.tsx) to see these updates in context.

## 7. (TypeScript only) - Add the new environment variable to the `ENV` type definition

Update the `remix.d.ts` file

```diff
// ...other code

declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: {env: {NODE_ENV: 'production' | 'development'}};

  /**
   * Declare expected Env parameter in fetch handler.
   */
  interface Env extends HydrogenEnv {
+   GTM_CONTAINER_ID: `GTM-${string}`;
  }
}

// ...other code
```

[View the complete component file](remix.d.ts) to see these updates in context.
