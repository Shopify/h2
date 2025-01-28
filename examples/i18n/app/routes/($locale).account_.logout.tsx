import type {
  LoaderArgs,
  ActionArgs,
  V2_MetaFunction,
} from '@shopify/remix-oxygen';
import {json, redirect} from '@shopify/remix-oxygen';
import {localizePath} from '~/i18n';

export const meta: V2_MetaFunction = () => {
  return [{title: 'Logout'}];
};

export async function loader({context}: LoaderArgs) {
  return redirect(localizePath('/account/login', context.i18n));
}

export async function action({request, context}: ActionArgs) {
  const {session} = context;
  session.unset('customerAccessToken');

  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, {status: 405});
  }

  return redirect(localizePath('/', context.i18n), {
    headers: {
      'Set-Cookie': await session.commit(),
    },
  });
}

export default function Logout() {
  return null;
}
