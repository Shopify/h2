import {json, redirect, type LoaderArgs} from '@shopify/remix-oxygen';
import {Form, useActionData} from '@remix-run/react';
import {useTranslation, localizePath, LocalizedLink} from '~/i18n';

type ActionResponse = {
  error?: string;
  resetRequested?: boolean;
};

export async function loader({context}: LoaderArgs) {
  const customerAccessToken = await context.session.get('customerAccessToken');
  if (customerAccessToken) {
    return redirect(localizePath('/account', context.i18n));
  }

  return json({});
}

export async function action({request, context}: LoaderArgs) {
  const {storefront} = context;
  const form = await request.formData();
  const email = form.has('email') ? String(form.get('email')) : null;

  if (request.method !== 'POST') {
    return json({error: 'Method not allowed'}, {status: 405});
  }

  try {
    if (!email) {
      throw new Error('Please provide an email.');
    }
    await storefront.mutate(CUSTOMER_RECOVER_MUTATION, {
      variables: {email},
    });

    return json({resetRequested: true});
  } catch (error: unknown) {
    const resetRequested = false;
    if (error instanceof Error) {
      return json({error: error.message, resetRequested}, {status: 400});
    }
    return json({error, resetRequested}, {status: 400});
  }
}

export default function Recover() {
  const action = useActionData<ActionResponse>();
  const {t} = useTranslation();

  return (
    <div className="account-recover">
      <div>
        {action?.resetRequested ? (
          <>
            <h1>Request Sent.</h1>
            <p>
              If that email address is in our system, you will receive an email
              with instructions about how to reset your password in a few
              minutes.
            </p>
            <br />
            <LocalizedLink to="/account/login">Return to Login</LocalizedLink>
          </>
        ) : (
          <>
            <h1>{t('account.recover.title')}</h1>
            <p>{t('account.recover.description')}</p>
            <br />
            <Form method="POST">
              <fieldset>
                <label htmlFor="email">
                  {t('account.recover.form.email.label')}
                </label>
                <input
                  aria-label={t('account.recover.form.email.label')}
                  autoComplete="email"
                  autoFocus
                  id="email"
                  name="email"
                  placeholder={t('account.recover.form.email.placeholder')}
                  required
                  type="email"
                />
              </fieldset>
              {action?.error ? (
                <p>
                  <mark>
                    <small>{action.error}</small>
                  </mark>
                </p>
              ) : (
                <br />
              )}
              <button type="submit">{t('account.recover.form.submit')}</button>
            </Form>
            <div>
              <br />
              <p>
                <LocalizedLink to="/account/login">
                  {t('account.recover.login')} →
                </LocalizedLink>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerrecover
const CUSTOMER_RECOVER_MUTATION = `#graphql
  mutation customerRecover(
    $email: String!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerRecover(email: $email) {
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
