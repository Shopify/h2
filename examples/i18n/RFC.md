# RFC: Hydrogen markets & i18n

Shopify [markets](https://help.shopify.com/en/manual/markets/managing-markets)
allows merchants to serve localized experiences from a single store. With Markets,
you can configure markets to target specific countries or regions, or you can group
countries and regions together to simplify your expansion efforts.

The native [Shopify Translate & Adapt app](https://apps.shopify.com/translate-and-adapt),
allows merchants to easily translate and adapt any store content for any market language.
This powerful app allows you to translate traditional Shopify resources such as `products`,
`collections`, `pages`, `blogs` and `menus` and `carts`, but also newer content
primitives such as `metafields` and `metaobjects`.

The GraphQL Storefront API [@inContext directive](https://shopify.dev/changelog/storefront-api-incontext-directive-supports-languages)
allows merchants to retrieve localized Shopify by passing `language` and
`country` arguments to any query. If the requested language is active in the given
country, as configured within the shop's Market settings, then the query will return
translated values.

Although these three pieces provide the core requirement to implement a solid internalized
experience, there is still the challenge of how to translate static content served
directly from the headless storefront (Account routes, Cart, Search etc). It is
also unfortunately very easy to get all these pieces working sub-optimally in terms
of performance, because of the various interdependencies across the different
components of the architecture.

This RFC aims to provide a recommended reference architecture to deliver performant-focused
localized Hydrogen storefronts, as well as, a set of primitives to help reduce the
complexity and time to production.

## Reference Implementation

The examples/i18n folder should serve as an reference implementation of this RFC.

## i18 Setup

### 1. Determine your URL localization strategy

- Prefix-based: e.g
  - language-COUNTRY: `/en-CA` and `/fr-CA`
  - language-country: `/en-ca/`
  - LANGUAGE-country: `/EN-ca/`
  - LANGUAGE-COUNTRY: `/EN-CA/`
- Domain-based: e.g
  - `ca.demo.shop/` english
  - `ca.demo.shop/fr` french
- Toplevel domain based: e.g
  - `demo.ca/`
  - `demo.ca/fr`

### 2. Create localization json files

This i18n solution requires 3 different json file types

1. `all.json` - an array that holds all the markets/countries that will be
   available in the CountrySelector
2. `/country/**.json` - a country definition for each market
3. `/language/**.json` - a language definition for each supported language

```bash
/public/locales
├── all.json
├── country
│   ├── CA.json
│   ├── DE.json
│   ├── ES.json
│   ├── FR.json
│   └── US.json
└── language
    ├── ca.json
    ├── de.json
    ├── en.json
    ├── es.json
    └── fr.json
```

#### Example country `US.json`

```json
{
  "code": "US",
  "name": "United States",
  "languages": ["en"]
}
```

#### Example language `en.json`

```json
{
  "name": "English",
  "code": "en",
  "translation": {
    "layout": {
      "header": {
        "ctas": {
          "login": "Login",
          "account": "Account",
          "search": "Search",
          "cart": "Cart"
        }
      },
      "cart": {
        "checkout": "Continue to checkout",
        "continueShopping": "Continue shopping",
        "empty": "Looks like you haven’t added anything yet, let’s get you started!",
        "loading": "Loading search...",
        "remove": "Remove",
        "subtotal": "Subtotal",
        "title": "Cart",
        "total": "Total",
        "quantity": "Quantity",
        "discounts": {
          "title": "Discount(s)",
          "remove": "Remove",
          "form": {
            "label": "Discount code",
            "placeholder": "Enter a discount code",
            "submit": "Apply"
          }
        }
      },
      "search": {
        "noResults": "No results found for \"{{query}}\"",
        "results": {
          "articles": "Articles",
          "collections": "Collections",
          "products": "Products",
          "pages": "Pages",
          "suggestions": "Suggestions"
        },
        "loading": "Loading search...",
        "title": "Search",
        "viewAll": "View all results for \"{{query}}\"",
        "form": {
          "placeholder": "Enter a search term",
          "label": "Search",
          "submit": "Search"
        }
      },
      "pagination": {
        "next": "Load more ↓",
        "previous": "↑ Load previous",
        "loading": "Loading..."
      }
    },
    "home": {
      "welcome": {
        "title": "Hello world",
        "subtitle": "Hydrogen meets i18n",
        "description": "Fast-track your storefront build with Hydrogen, our React-based headless toolkit, built on Remix. Deploy for free on Oxygen, our global hosting solution."
      }
    },
    "notFound": {
      "title": "Page not found",
      "subtitle": "Sorry, we couldn't find the page you were looking for.",
      "description": "Please check the URL in the address bar and try again.",
      "cta": "Go to homepage"
    },
    "account": {
      "home": {
        "greeting": "Welcome to your account.",
        "personalGreeting": "Welcome, {{firstName}}",
        "menu": {
          "orders": "Orders",
          "profile": "Profile",
          "addresses": "Addresses",
          "logout": "Sign out"
        }
      },
      "login": {
        "title": "Sign in.",
        "form": {
          "email": {
            "label": "Email",
            "placeholder": "Enter your email address"
          },
          "password": {
            "label": "Password",
            "placeholder": "Enter your password"
          },
          "submit": "Sign in"
        },
        "forgot": "Forgot password?",
        "register": "Register"
      },
      "register": {
        "title": "Register.",
        "description": "Create your account",
        "form": {
          "email": {
            "label": "Email address",
            "placeholder": "Enter your email address"
          },
          "password": {
            "label": "Password",
            "placeholder": "Enter your password"
          },
          "confirmPassword": {
            "label": "Re-enter password",
            "placeholder": "Re-enter your password"
          },
          "submit": "Register"
        },
        "login": "Login"
      },
      "recover": {
        "title": "Forgot password.",
        "description": "Enter the email address associated with your account to receive a link to reset your password",
        "form": {
          "email": {
            "label": "Email address",
            "placeholder": "Enter your email address"
          },
          "submit": "Reset password"
        },
        "login": "Login"
      }
    }
  }
}
```

#### Example `all.json`

```json
[
  {
    "isDefault": true,
    "code": "US",
    "name": "United States (USD $)",
    "languages": [{"code": "en", "name": "English"}],
    "prefixes": ["/en-US"]
  },
  {
    "code": "CA",
    "name": "Canada (CAD $)",
    "languages": [
      {"code": "en", "name": "English"},
      {"code": "fr", "name": "French"}
    ],
    "prefixes": ["/en-CA", "/fr-CA"]
  },
  {
    "code": "ES",
    "name": "Spain (EUR €)",
    "languages": [
      {"code": "es", "name": "Spanish"},
      {"code": "ca", "name": "Catalan"},
      {"code": "eu", "name": "Basque"},
      {"code": "gl", "name": "Galician"}
    ],
    "prefixes": ["/es-ES", "/ca-ES", "/eu-ES", "/gl-ES"]
  },
  {
    "code": "FR",
    "name": "France (EUR €)",
    "languages": [{"code": "fr", "name": "French"}],
    "prefixes": ["/fr-FR"]
  },
  {
    "code": "DE",
    "name": "Germany (EUR €)",
    "languages": [{"code": "de", "name": "German"}],
    "prefixes": ["/de-DE"]
  }
]
```

### 2. Create a locale parser for your given localization strategy

The localization parser allows you to configure fine-grained details about your localization
strategy. It allows you to configure the casing the country and language codes
in the url. Here we create a `subfolder` locale parser that support urls such as:

- example.com/en-CA/
- example.com/fr-CA/
  ....

```ts
// file: /utils.ts

import {createSubfolderLocaleParser} from '@shopify/hydrogen/i18n';

// Configure the i18n locale format. e.g this will match /fr-CA/ or /en-CA
export const subfolderLocaleParser = createSubfolderLocaleParser({
  parser: ({COUNTRY, language, delimiter}) =>
    `/${language}${delimiter['-']}${COUNTRY}`,
});
```

### 3. Update `server.ts` to support i18n

To help your retrieve the correct i18n localization for a given request, we add
the `getI18n` utility which correctly parses a request url and automatically
retrieves the correct jsons for a given locale and returns them as the i18n

```ts
// file: server.ts

// step 1. import the parser and utility function
import {getI18n} from '@shopify/hydrogen/i18n';
import {subfolderLocaleParser} from '~/utils';

// step 2. Statically import your default country and language .jsons to avoid making
// additional localization requests for users in the default locale
import defaultCountry from './public/locales/country/US.json';
import defaultLanguage from './public/locales/language/en.json';

// step 3. Create the default i18n
const DEFAULT_I18N = {
  isDefault: true,
  country: defaultCountry,
  language: defaultLanguage,
  prefix: subfolderLocaleParser({
    country: defaultCountry.code,
    language: defaultLanguage.code,
  }),
};

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    //....

  // Step.4. get the locale from the request
  const {i18n, i18nSfApi} = await getI18n<typeof DEFAULT_I18N>({
    cache,
    defaultI18n: DEFAULT_I18N,
    prefixParser: subfolderLocaleParser,
    request,
    strategy: 'subfolder',
    waitUntil,
  });

  const cart = createCartHandler({
    storefront,
    getCartId: cartGetIdDefault(request.headers),
    setCartId: cartSetIdDefault(),
    cartQueryFragment: CART_QUERY_FRAGMENT,
    cartMutateFragment: CART_MUTATE_FRAGMENT, // Step.5 pass custom mutation fragment
  });

  const handleRequest = createRequestHandler({
    build: remixBuild,
    mode: process.env.NODE_ENV,
    getLoadContext: () => ({
      cart,
      i18n, // Step 5. pass i18n to the Remix context
      publicEnv,
      session,
      storefront,
    }),
  });

  // ...
}

const CART_MUTATE_FRAGMENT = `#graphql
  fragment CartApiMutation on Cart {
    id
    totalQuantity
    buyerIdentity {
      countryCode # needed because CountrySelector updates the countryCode on change
    }
  }
`;
```

### 4. Add type to the i18n context

```ts
// file: remix.d.ts

// Step 1. import `GetLocalFromRequestConfi
import type {HydrogenSession, I18n} from 'server';

declare module '@shopify/remix-oxygen' {
  export interface AppLoadContext {
    cart: HydrogenCart;
    env: Env;
    publicEnv: PublicEnv;
    session: HydrogenSession;
    storefront: Storefront;
    i18n: I18n; // Step 2. type the context property
    oxygen: OxygenHeaders;
  }
}
```

### 5. Update `/app/root.tsx`

#### Update the loader to return the i18n to make it available across the app

```ts
// file: app/root.tsx`

export async function loader({context}: LoaderArgs) {
  // ...
  return defer({
    // return i18n so that it is available throughout the app
    i18n: context.i18n,
    // ...
  });
}
```

#### Update the root component to support localization

```ts
// Update
export default function App() {
  const {i18n, ...data} = useLoaderData<typeof loader>();

  return (
    <html lang={i18n.language.code}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Layout {...data} key={`${i18n.language.code}-${i18n.country.code}`}>
          <Outlet />
        </Layout>
        <ScrollRestoration />
        <Scripts />
        <PublicEnvScript />
      </body>
    </html>
  );
}
```

### 6. Add the `<LocaleSelector />` component to the header

```ts
// file: /components/Header.tsx

// Step 1. import the `<LocaleSelector />` and `<AsyncLocalizations />` components
import {Await} from '@remix-run/react';
import {Suspense, lazy} from 'react';
import {LocaleSelector} from './components/LocaleSelector';
import {LocalizedLink} from '@shopify/hydrogen/i18n';

// Step 2. Lazy load the `<AsyncLocalizations />` component to avoid
// that prevents `/public/locales/all.json` to be added to the main JS bundle
const Localizations = lazy(() =>
  import('~/components/AsyncLocalizations').then((mod) => ({
    default: mod.AsyncLocalizations,
  })),
);

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  return (
    <nav className="header-ctas" role="navigation">
      {/* Step 3. Dynamically load the all.json and pass it to the LocaleSelector */}
      <Suspense fallback={<LocaleSelector localizations={null} />}>
        <Localizations>
          {({localizations}) => (
            {/* Step 4. Add the LocaleSelector to add country and language dropdowns */}
            <LocaleSelector localizations={localizations} />
          )}
        </Localizations>
      </Suspense>
      <HeaderMenuMobileToggle />
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}
```

### 7. Replace all `<Link />` component instances with `<LocalizedLink />`

```ts
// file: components/Header.tsx (one example)

// Step 1. import `LocalizedLink` component
import {LocalizedLink} from '@shopify/hydrogen/i18n';

export function Header({header, isLoggedIn, cart}: HeaderProps) {
  const {shop, menu} = header;
  return (
    <header className="header">
      {/* Step 2. replace each <Link /> with the <LocalizedLink /> component */}
      <LocalizedLink prefetch="intent" to="/">
        <strong>{shop.name}</strong>
      </LocalizedLink>
      <HeaderMenu menu={menu} viewport="desktop" />
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}
```

### 8. Implement localized content with the `useTranslation` hook

```ts
// file: components/Header.tsx

// Step 1. import the useTranslation hook
import {useTranslation, LocalizedLink} from '@shopify/hydrogen/i18n';

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  // Step 2. instanciate the translator
  const {t} = useTranslation();

  // Step 3. use localized content for the account a login CTA's
  const loginLabel = isLoggedIn
    ? t('layout.header.ctas.account')
    : t('layout.header.ctas.login');

  return (
    <nav className="header-ctas" role="navigation">
      <Suspense fallback={<LocaleSelector localizations={null} />}>
        <Localizations>
          {({localizations}) => (
            <LocaleSelector localizations={localizations} />
          )}
        </Localizations>
      </Suspense>
      <HeaderMenuMobileToggle />
      <LocalizedLink prefetch="intent" to="/account">
        {loginLabel}
      </LocalizedLink>
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}
```

### 9. Localize all Remix `redirect` urls in loaders and actions

```ts
// file app/routes/(locale).account.login.tsx (one example)

// Step 1. Import the `localizePath` utility
import {localizePath} from '@shopify/hydrogen/i18n';

export async function loader({context}: LoaderArgs) {
  if (await context.session.get('customerAccessToken')) {
    // Step 2. wrap your path with lozalizePath
    return redirect(localizePath('/account', context.i18n));
  }
  return json({});
}

export async function action({request, context}: ActionArgs) {
  const {session, storefront} = context;
  //...
  return redirect(localizePath('/account', context.i18n), {
    headers: {
      'Set-Cookie': await session.commit(),
    },
  });
}
```
