import {Await} from '@remix-run/react';
import {Suspense, lazy} from 'react';
import type {LayoutProps} from './Layout';
import {LocaleSelector} from './LocaleSelector';
import {LocalizedLink, useTranslation} from '~/i18n';
import {useMatches} from '@remix-run/react';

type HeaderProps = Pick<LayoutProps, 'header' | 'cart' | 'isLoggedIn'>;

type Viewport = 'desktop' | 'mobile';

const Localizations = lazy(() =>
  import('~/components/AsyncLocalizations').then((mod) => ({
    default: mod.AsyncLocalizations,
  })),
);

export function Header({header, isLoggedIn, cart}: HeaderProps) {
  const {shop, menu} = header;
  return (
    <header className="header">
      <LocalizedLink prefetch="intent" to="/">
        <strong>{shop.name}</strong>
      </LocalizedLink>
      <HeaderMenu menu={menu} viewport="desktop" />
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}

export function HeaderMenu({
  menu,
  viewport,
}: {
  menu: HeaderProps['header']['menu'];
  viewport: Viewport;
}) {
  const className = `header-menu-${viewport}`;
  const [root] = useMatches();
  const publicStoreDomain = root.data.publicStoreDomain;

  if (!publicStoreDomain) {
    throw new Error('HeaderMenu missing PUBLIC_STORE_DOMAIN');
  }

  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
    if (viewport === 'mobile') {
      event.preventDefault();
      window.location.href = event.currentTarget.href;
    }
  }

  return (
    <nav className={className} role="navigation">
      {viewport === 'mobile' && (
        <LocalizedLink prefetch="intent" to="/" onClick={closeAside}>
          Home
        </LocalizedLink>
      )}
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;

        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain)
            ? new URL(item.url).pathname
            : item.url;
        return (
          <LocalizedLink
            key={item.id}
            prefetch="intent"
            className="header-menu-item"
            to={url}
            onClick={closeAside}
          >
            {item.title}
          </LocalizedLink>
        );
      })}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  const {t} = useTranslation();
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

function HeaderMenuMobileToggle() {
  return (
    <a className="header-menu-mobile-toggle" href="#mobile-menu-aside">
      <h3>☰</h3>
    </a>
  );
}

function SearchToggle() {
  const {t} = useTranslation();
  return <a href="#search-aside">{t('layout.header.ctas.search')}</a>;
}

function CartBadge({count}: {count: number}) {
  const {t} = useTranslation();
  return (
    <a href="#cart-aside">
      {t('layout.header.ctas.cart')} {count}
    </a>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart}>
        {(cart) => {
          if (!cart) return <CartBadge count={0} />;
          return <CartBadge count={cart.totalQuantity || 0} />;
        }}
      </Await>
    </Suspense>
  );
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};
