import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui';
import type {RemixConfig} from './remix-config.js';

const RESERVED_ROUTES = ['^api/[^/]+/graphql.json', '^cdn/', '^_t/'];

export function findReservedRoutes(config: {routes: RemixConfig['routes']}) {
  const routes = new Set<string>();

  Object.values(config.routes)
    .filter((route) =>
      RESERVED_ROUTES.some((pattern) =>
        new RegExp(pattern).test(route.path ?? ''),
      ),
    )
    .forEach((route) => {
      if (route.path) {
        routes.add(route.path);
      }
    });

  return [...routes];
}

// Sorted by importance for better warnings.
const REQUIRED_ROUTES = [
  '',
  'cart',
  // 'products',
  'products/:productHandle',

  'collections',
  //   'collections/all',
  'collections/:collectionHandle',
  //   'collections/:collectionHandle/:constraint',
  //   'collections/:collectionHandle/products/:productHandle',

  'sitemap.xml',
  'robots.txt',

  'pages/:pageHandle',
  //   'blogs/:blogHandle/tagged/:tagHandle',
  //   'blogs/:blogHandle/:articleHandle',
  //   'blogs/:blogHandle/:articleHandle/comments',

  'policies/:policyHandle',
  //   'variants/:variantId',
  'search',
  //   'gift_cards/:storeId/:cardId',
  // 'discount/:discountCode', => Handled in storefrontRedirect

  'account',
  'account/login',
  // 'account/addresses',
  // 'account/orders',
  'account/orders/:orderId',
  // -- Added for CAAPI:
  'account/authorize',

  // -- These were removed when migrating to CAAPI:
  // 'account/register',
  // 'account/reset/:id/:token',
  // 'account/activate/:id/:token',

  //   'password',
  //   'opening_soon',
];

export function findMissingRoutes(
  config: {routes: RemixConfig['routes']},
  requiredRoutes = REQUIRED_ROUTES,
) {
  const userRoutes = Object.values(config.routes);
  const missingRoutes = new Set(requiredRoutes);

  for (const requiredRoute of requiredRoutes) {
    for (const userRoute of userRoutes) {
      if (!requiredRoute && !userRoute.path) {
        missingRoutes.delete(requiredRoute);
      } else if (requiredRoute && userRoute.path) {
        const currentRoute = {
          path: userRoute.path,
          parentId: userRoute.parentId,
        };

        // Compose the path for nested routes:
        while (currentRoute.parentId && currentRoute.parentId !== 'root') {
          const parentRoute = userRoutes.find(
            (r) => r.id === currentRoute.parentId,
          );

          if (!parentRoute) break;

          currentRoute.path =
            parentRoute.path == null
              ? currentRoute.path
              : `${parentRoute.path}/${currentRoute.path}`;
          currentRoute.parentId = parentRoute.parentId;
        }

        const optionalSegment = ':?[^\\/\\?]+\\?';
        const reString =
          `^(${optionalSegment}\\/)?` + // Starts with an optional segment
          requiredRoute
            .replaceAll('.', '\\.') // Escape dots
            .replace(/\//g, `\\/(${optionalSegment}\\/)?`) // Has optional segments in the middle
            .replace(/:[^/)?]+/g, '(:[^\\/]+|\\*)') + // Replace params with regex
          `(\\/${optionalSegment})?$`; // Ends with an optional segment

        if (new RegExp(reString).test(currentRoute.path)) {
          missingRoutes.delete(requiredRoute);
        }
      }
    }
  }

  return [...missingRoutes];
}

const LINE_LIMIT = 100;
export function logMissingRoutes(routes: string[]) {
  if (routes.length) {
    renderWarning({
      headline: 'Standard Shopify routes missing',
      body:
        `Your Hydrogen project is missing ${
          routes.length
        } standard Shopify route${routes.length > 1 ? 's' : ''}.\n` +
        'Including these routes improves compatibility with Shopify’s platform:\n\n' +
        routes
          .slice(0, LINE_LIMIT - (routes.length <= LINE_LIMIT ? 0 : 1))
          .map((route) => `• /${route}`)
          .join('\n') +
        (routes.length > LINE_LIMIT
          ? `\n• ...and ${routes.length - LINE_LIMIT + 1} more`
          : ''),
    });
  } else {
    renderSuccess({
      headline: 'All standard Shopify routes present',
    });
  }
}

export function warnReservedRoutes(routes: string[]) {
  if (routes.length) {
    renderWarning({
      headline: 'Reserved routes present',
      body:
        `Your Hydrogen project is using ${routes.length} reserved route${
          routes.length > 1 ? 's' : ''
        }.\n` +
        'These routes are reserved by Shopify and may cause issues with your storefront:\n\n' +
        routes
          .slice(0, LINE_LIMIT - (routes.length <= LINE_LIMIT ? 0 : 1))
          .map((route) => `• /${route}`)
          .join('\n') +
        (routes.length > LINE_LIMIT
          ? `\n• ...and ${routes.length - LINE_LIMIT + 1} more`
          : ''),
    });
  }
}
