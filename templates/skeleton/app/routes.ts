import {flatRoutes} from '@remix-run/fs-routes';
import {layout, type RouteConfig} from '@remix-run/route-config';
import {hydrogenRoutes} from '@shopify/hydrogen';

export default hydrogenRoutes([
  layout('./layout.tsx', (await flatRoutes())),
]) satisfies RouteConfig;
