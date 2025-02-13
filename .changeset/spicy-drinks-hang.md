---
'skeleton': patch
'@shopify/hydrogen': patch
'@shopify/cli-hydrogen': patch
---

Added support for the Remix future flag `v3_routeConfig`.

Remix documentation for the `v3_routeConfig`: [https://remix.run/docs/en/main/start/future-flags#v3_routeconfig](https://remix.run/docs/en/main/start/future-flags#v3_routeconfig)
Details the base changes that need to be made to enable the flag, including the up to 3 additional dependencies that need to be added.

Two files need to be changed once the above instructions have been applied.

1. In the `app/routes.ts` file, a support function needs to be included to get the additional routes that were originally added in the vite plugin. With a file like the following:

   ```typescript
   import {flatRoutes} from '@remix-run/fs-routes';
   import type {RouteConfig} from '@remix-run/route-config';
   import {route} from '@remix-run/route-config';
   import {remixRoutesOptionAdapter} from '@remix-run/routes-option-adapter';

   export default [
     ...(await flatRoutes({rootDirectory: 'fs-routes'})),

     ...(await remixRoutesOptionAdapter(/* ... */)),

     route('/hello', 'routes/hello.tsx'),
   ] satisfies RouteConfig;
   ```

   Include the `hydrogenRoutes` function like so:

   ```typescript
   import {flatRoutes} from '@remix-run/fs-routes';
   import type {RouteConfig} from '@remix-run/route-config';
   import {route} from '@remix-run/route-config';
   import {remixRoutesOptionAdapter} from '@remix-run/routes-option-adapter';
   import {hydrogenRoutes} from '@shopify/hydrogen';

   export default hydrogenRoutes([
     ...(await flatRoutes({rootDirectory: 'fs-routes'})),

     ...(await remixRoutesOptionAdapter(/* ... */)),

     route('/hello', 'routes/hello.tsx'),
   ]) satisfies RouteConfig;
   ```

   The function should wrap around all of the routes so that the priority of the routes is applied correctly.

2. In the Vite config (`vite.config.ts` usually) the `remix` plugin needs to have it's configuration slightly altered.

   From this:

   ```typescript
   ...
   remix({
     presets: [hydrogen.preset()],
   ...
   ```

   To this:

   ```typescript
   ...
   remix({
     presets: [hydrogen.v3preset()],
   ...
   ```

   This is due to the `routes` configuration option not being allowed with the `v3_routeConfig` future flag enabled.
