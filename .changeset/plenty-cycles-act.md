---
'skeleton': patch
---

[**Breaking change**]

Turn on Remix `v3_singleFetch` future flag

Remix single fetch migration quick guide: https://remix.run/docs/en/main/start/future-flags#v3_singlefetch
Remix single fetch migration guide: https://remix.run/docs/en/main/guides/single-fetch

**Note:** If you have any routes that appends (or looks for) a search param named `_data`, make sure to rename it to something else.

1. In your `vite.config.ts`, add the single fetch future flag.

    ```diff
    +  declare module "@remix-run/server-runtime" {
    +    interface Future {
    +     v3_singleFetch: true;
    +    }
    +  }

      export default defineConfig({
        plugins: [
          hydrogen(),
          oxygen(),
          remix({
            presets: [hydrogen.preset()],
            future: {
              v3_fetcherPersist: true,
              v3_relativeSplatPath: true,
              v3_throwAbortReason: true,
              v3_lazyRouteDiscovery: true,
    +         v3_singleFetch: true,
            },
          }),
          tsconfigPaths(),
        ],
    ```

2. In your `entry.server.tsx`, add `nonce` to the `<RemixServer>`.

   ```diff
   const body = await renderToReadableStream(
     <NonceProvider>
       <RemixServer
         context={remixContext}
         url={request.url}
   +     nonce={nonce}
       />
     </NonceProvider>,
   ```
3. Deprecate `json` and `defer` import usage from `@shopify/remix-oxygen`.

    Remove `json()`/`defer()` in favor of raw objects.

    Single Fetch supports JSON objects and Promises out of the box, so you can return the raw data from your loader/action functions:

    ```diff
    - import {json} from "@shopify/remix-oxygen";

      export async function loader({}: LoaderFunctionArgs) {
        let tasks = await fetchTasks();
    -   return json(tasks);
    +   return tasks;
      }
    ```

    ```diff
    - import {defer} from "@shopify/remix-oxygen";

      export async function loader({}: LoaderFunctionArgs) {
        let lazyStuff = fetchLazyStuff();
        let tasks = await fetchTasks();
    -   return defer({ tasks, lazyStuff });
    +   return { tasks, lazyStuff };
      }
   ```

    If you were using the second parameter of json/defer to set a custom status or headers on your response, you can continue doing so via the new data API:

    ```diff
    -  import {json} from "@shopify/remix-oxygen";
    +  import {data} from "@shopify/remix-oxygen";

      export async function loader({}: LoaderFunctionArgs) {
        let tasks = await fetchTasks();
    -    return json(tasks, {
    +    return data(tasks, {
          headers: {
            "Cache-Control": "public, max-age=604800"
          }
        });
      }
    ```
