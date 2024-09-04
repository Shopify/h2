import {
  useNonce,
  getShopAnalytics,
  Analytics,
  getSeoMeta,
  SeoConfig,
} from '@shopify/hydrogen';
import {defer, MetaArgs, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  useRouteError,
  useRouteLoaderData,
  ScrollRestoration,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
} from '@remix-run/react';
import favicon from '~/assets/favicon.svg';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import {PageLayout} from '~/components/PageLayout';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {B2BLocationProvider} from '~/components/B2BLocationProvider';
import {B2BLocationSelector} from '~/components/B2BLocationSelector';
import type {
  Company,
  CompanyAddress,
  CompanyLocation,
  Maybe,
} from '@shopify/hydrogen/customer-account-api-types';
import {seoPayload} from '~/lib/seo';

export type RootLoader = typeof loader;

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') {
    return true;
  }

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) {
    return true;
  }

  return false;
};

export function links() {
  return [
    {rel: 'stylesheet', href: resetStyles},
    {rel: 'stylesheet', href: appStyles},
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
export type CustomerCompanyLocation = Pick<CompanyLocation, 'name' | 'id'> & {
  shippingAddress?:
    | Maybe<Pick<CompanyAddress, 'countryCode' | 'formattedAddress'>>
    | undefined;
};

export type CustomerCompanyLocationConnection = {
  node: CustomerCompanyLocation;
};

export type CustomerCompany =
  | Maybe<
      Pick<Company, 'name' | 'id'> & {
        locations: {
          edges: CustomerCompanyLocationConnection[];
        };
      }
    >
  | undefined;
/**********   EXAMPLE UPDATE END   ************/
/***********************************************/

export const meta = ({data}: MetaArgs<typeof loader>) => {
  return getSeoMeta(data!.seo as SeoConfig);
};

export async function loader({context, request}: LoaderFunctionArgs) {
  const {storefront, customerAccount, cart, env} = context;
  const publicStoreDomain = env.PUBLIC_STORE_DOMAIN;

  const isLoggedInPromise = customerAccount.isLoggedIn();
  const cartPromise = cart.get();

  // defer the footer query (below the fold)
  const footerPromise = storefront.query(FOOTER_QUERY, {
    cache: storefront.CacheLong(),
    variables: {
      footerMenuHandle: 'footer', // Adjust to your footer menu handle
    },
  });

  // await the header query (above the fold)
  const header = await storefront.query(HEADER_QUERY, {
    cache: storefront.CacheLong(),
    variables: {
      headerMenuHandle: 'main-menu', // Adjust to your header menu handle
    },
  });

  const seo = seoPayload.root({shop: header.shop, url: request.url});

  return defer({
    cart: cartPromise,
    footer: footerPromise,
    header,
    isLoggedIn: isLoggedInPromise,
    publicStoreDomain,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    seo,
  });
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>('root');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {data ? (
          <Analytics.Provider
            cart={data.cart}
            shop={data.shop}
            consent={data.consent}
          >
            {/***********************************************/
            /**********  EXAMPLE UPDATE STARTS  ************/}
            <B2BLocationProvider>
              <PageLayout {...data}>{children}</PageLayout>
            </B2BLocationProvider>
            {/**********   EXAMPLE UPDATE END   ************/
            /***********************************************/}
          </Analytics.Provider>
        ) : (
          children
        )}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{errorStatus}</h2>
      {errorMessage && (
        <fieldset>
          <pre>{errorMessage}</pre>
        </fieldset>
      )}
    </div>
  );
}
