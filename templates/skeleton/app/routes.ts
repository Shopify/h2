import {flatRoutes} from '@remix-run/fs-routes';
import type {RouteConfig} from '@remix-run/route-config';
import {hydrogenRoutes} from '@shopify/hydrogen';

export default hydrogenRoutes([...(await flatRoutes())]) satisfies RouteConfig;
