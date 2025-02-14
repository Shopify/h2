import {useLocale} from './useLocale';
import {Link} from '@remix-run/react';
import {localizePath} from './localizePath';

export type LocalizedLinkProps = Parameters<typeof Link>[0];

export function LocalizedLink({to, children, ...props}: LocalizedLinkProps) {
  const i18n = useLocale();
  if (typeof to !== 'string') {
    return (
      <Link {...props} to={to}>
        {children}
      </Link>
    );
  }
  if (to.startsWith('http')) {
    return (
      <a {...props} href={to}>
        {children}
      </a>
    );
  }
  return (
    <Link {...props} to={localizePath(to, i18n)}>
      {children}
    </Link>
  );
}
