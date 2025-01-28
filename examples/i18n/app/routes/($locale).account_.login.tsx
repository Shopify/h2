import {
  json,
  redirect,
  type ActionArgs,
  type LoaderArgs,
  type V2_MetaFunction,
} from '@shopify/remix-oxygen';
import {Form, useActionData} from '@remix-run/react';
import {useTranslation, LocalizedLink, localizePath} from '~/i18n';

type ActionResponse = {
  error: string | null;
};

export const meta: V2_MetaFunction = () => {
  return [{title: 'Login'}];
};

export async function loader({context}: LoaderArgs) {
  if (await context.session.get('customerAccessToken')) {
    return redirect(localizePath('/account', context.i18n));
  }
  return json({});
}

export async function action({request, context}: ActionArgs) {
  const {session, storefront} = context;

  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, {status: 405});
  }

  try {
    const form = await request.formData();
    const email = String(form.has('email') ? form.get('email') : '');
    const password = String(form.has('password') ? form.get('password') : '');
    const validInputs = Boolean(email && password);

    if (!validInputs) {
      throw new Error('Please provide both an email and a password.');
    }

    const {customerAccessTokenCreate} = await storefront.mutate(
      LOGIN_MUTATION,
      {
        variables: {
          input: {email, password},
        },
      },
    );

    if (!customerAccessTokenCreate?.customerAccessToken?.accessToken) {
      throw new Error(customerAccessTokenCreate?.customerUserErrors[0].message);
    }

    const {customerAccessToken} = customerAccessTokenCreate;
    session.set('customerAccessToken', customerAccessToken);

    return redirect(localizePath('/account', context.i18n), {
      headers: {
        'Set-Cookie': await session.commit(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return json({error: error.message}, {status: 400});
    }
    return json({error}, {status: 400});
  }
}

export default function Login() {
  const data = useActionData<ActionResponse>();
  const error = data?.error || null;
  const {t} = useTranslation();

  return (
    <div className="login">
      <h1>{t('account.login.title')}</h1>
      <Form method="POST">
        <fieldset>
          <label htmlFor="email">{t('account.login.form.email.label')}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t('account.login.form.email.placeholder')}
            aria-label={t('account.login.form.email.label')}
            autoFocus
          />
          <label htmlFor="password">
            {t('account.login.form.password.label')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t('account.login.form.password.placeholder')}
            aria-label={t('account.login.form.password.label')}
            minLength={8}
            required
          />
        </fieldset>
        {error ? (
          <p>
            <mark>
              <small>{error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        <button type="submit">{t('account.login.form.submit')}</button>
      </Form>
      <br />
      <div>
        <p>
          <LocalizedLink to="/account/recover">
            {t('account.login.forgot')} →
          </LocalizedLink>
        </p>
        <p>
          <LocalizedLink to="/account/register">
            {t('account.login.register')} →
          </LocalizedLink>
        </p>
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeraccesstokencreate
const LOGIN_MUTATION = `#graphql
  mutation login($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerUserErrors {
        code
        field
        message
      }
      customerAccessToken {
        accessToken
        expiresAt
      }
    }
  }
` as const;
