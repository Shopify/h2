import type {LoaderArgs} from '@shopify/remix-oxygen';
import {redirect} from '@shopify/remix-oxygen';
import {localizePath} from '~/i18n';

export async function loader({context}: LoaderArgs) {
  if (await context.session.get('customerAccessToken')) {
    return redirect(localizePath('/account', context.i18n));
  }
  return redirect(localizePath('/account/login', context.i18n));
}
