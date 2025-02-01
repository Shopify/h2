import {Analytics, getShopAnalytics} from '@shopify/hydrogen';
import {Outlet, useLoaderData} from '@remix-run/react';

export async function loader({context}) {
  const {cart, env} = context;
  const cartPromise = cart.get();

  return {
    cart: cartPromise,
    shop: getShopAnalytics(context),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: true, // false stops the privacy banner from being displayed
      // localize the privacy banner
      country: context.storefront.i18n.country,
      language: context.storefront.i18n.language,
    },
  };
}

export default function App() {
  const data = useLoaderData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <Analytics.Provider
          cart={data.cart}
          shop={data.shop}
          consent={data.consent}
        >
          <Outlet />
        </Analytics.Provider>
      </body>
    </html>
  );
}
