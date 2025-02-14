import {Form, NavLink, Outlet, useLoaderData} from '@remix-run/react';
import {json, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import type {CustomerFragment} from 'storefrontapi.generated';
import {useTranslation, localizePath, useLocalizedPath} from '~/i18n';

export function shouldRevalidate() {
  return true;
}

export async function loader({request, context}: LoaderArgs) {
  const {session, storefront} = context;
  const customerAccessToken = await session.get('customerAccessToken');
  const isLoggedIn = Boolean(customerAccessToken?.accessToken);
  const {isPrivateRoute, isAccountHome} = parseAccountRequest(request);

  if (!isLoggedIn) {
    if (isPrivateRoute || isAccountHome) {
      session.unset('customerAccessToken');
      return redirect(localizePath('/account/login', context.i18n), {
        headers: {
          'Set-Cookie': await session.commit(),
        },
      });
    } else {
      // public subroute such as /account/login...
      return json({
        isLoggedIn: false,
        isAccountHome,
        isPrivateRoute,
        customer: null,
      });
    }
  } else {
    // loggedIn, default redirect to the orders page
    if (isAccountHome) {
      return redirect(localizePath('/account/orders', context.i18n));
    }
  }

  try {
    const {customer} = await storefront.query(CUSTOMER_QUERY, {
      variables: {
        customerAccessToken: customerAccessToken.accessToken,
        country: storefront.i18n.country,
        language: storefront.i18n.language,
      },
      cache: storefront.CacheNone(),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return json(
      {isLoggedIn, isPrivateRoute, isAccountHome, customer},
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('There was a problem loading account', error);
    session.unset('customerAccessToken');
    return redirect(localizePath('/account/login', context.i18n), {
      headers: {
        'Set-Cookie': await session.commit(),
      },
    });
  }
}

export default function Acccount() {
  const {customer, isPrivateRoute, isAccountHome} =
    useLoaderData<typeof loader>();

  if (!isPrivateRoute && !isAccountHome) {
    return <Outlet context={{customer}} />;
  }

  return (
    <AccountLayout customer={customer as CustomerFragment}>
      <br />
      <br />
      <Outlet context={{customer}} />
    </AccountLayout>
  );
}

function AccountLayout({
  customer,
  children,
}: {
  customer: CustomerFragment;
  children: React.ReactNode;
}) {
  const {t} = useTranslation();
  const heading = customer.firstName
    ? t('account.home.personalGreeting', {firstName: customer.firstName})
    : t('account.home.greeting');

  return (
    <div className="account">
      <h1>{heading}</h1>
      <br />
      <AcccountMenu />
      {children}
    </div>
  );
}

function AcccountMenu() {
  const {t} = useTranslation();
  function isActiveStyle({
    isActive,
    isPending,
  }: {
    isActive: boolean;
    isPending: boolean;
  }) {
    return {
      fontWeight: isActive ? 'bold' : '',
      color: isPending ? 'grey' : 'black',
    };
  }
  return (
    <nav role="navigation">
      <NavLink to="/account/orders" style={isActiveStyle}>
        {t('account.home.menu.orders')} &nbsp;
      </NavLink>
      &nbsp;|&nbsp;
      <NavLink to="/account/profile" style={isActiveStyle}>
        &nbsp; {t('account.home.menu.profile')} &nbsp;
      </NavLink>
      &nbsp;|&nbsp;
      <NavLink to="/account/addresses" style={isActiveStyle}>
        &nbsp; {t('account.home.menu.addresses')} &nbsp;
      </NavLink>
      &nbsp;|&nbsp;
      <Logout />
    </nav>
  );
}

function Logout() {
  const {t} = useTranslation();
  const localizedLogoutPath = useLocalizedPath('/account/logout');
  return (
    <Form className="account-logout" method="POST" action={localizedLogoutPath}>
      &nbsp;<button type="submit">{t('account.home.menu.logout')}</button>
    </Form>
  );
}

/**
 * Parse the request to determine if it is a request for a private route or account home
 * This utility relies on a prefixed locale in the path, e.g. /es-ES/account/orders
 * @param request
 * @returns @type {isPrivateRoute: boolean, isAccountHome: boolean}
 * @example
 * ```ts
 * const {isPrivateRoute, isAccountHome} = parseAccountRequest(request);
 * ```
 */
function parseAccountRequest(request: Request) {
  const url = new URL(request.url);
  return {
    isAccountHome: /^\/(\w{2}-\w{2}\/)?account\/?$/.test(url.pathname),
    isPrivateRoute:
      /^\/(\w{2}-\w{2}\/)?account\/(orders|orders\/.*|profile|addresses|addresses\/.*)?$/.test(
        url.pathname,
      ),
  };
}

export const CUSTOMER_FRAGMENT = `#graphql
  fragment Customer on Customer {
    acceptsMarketing
    addresses(first: 6) {
      nodes {
        ...Address
      }
    }
    defaultAddress {
      ...Address
    }
    email
    firstName
    lastName
    numberOfOrders
    phone
  }
  fragment Address on MailingAddress {
    id
    formatted
    firstName
    lastName
    company
    address1
    address2
    country
    province
    city
    zip
    phone
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/customer
const CUSTOMER_QUERY = `#graphql
  query Customer(
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customer(customerAccessToken: $customerAccessToken) {
      ...Customer
    }
  }
  ${CUSTOMER_FRAGMENT}
` as const;
