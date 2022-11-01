import {json, type LoaderArgs, type MetaFunction} from '@hydrogen/remix';
import {useLoaderData} from '@remix-run/react';

import {PageHeader, Section, Button} from '~/components';
import invariant from 'tiny-invariant';
import {getLocalizationFromLang} from '~/lib/utils';
import {ShopPolicy} from '@shopify/hydrogen-react/storefront-api-types';

export async function loader({params, context: {storefront}}: LoaderArgs) {
  invariant(params.policyHandle, 'Missing policy handle');
  const handle = params.policyHandle;

  const {language} = getLocalizationFromLang(params.lang);

  const policyName = handle.replace(/-([a-z])/g, (_: unknown, m1: string) =>
    m1.toUpperCase(),
  );

  const data = await storefront.query<{
    shop: Record<string, ShopPolicy>;
  }>({
    query: POLICY_CONTENT_QUERY,
    variables: {
      language,
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyName]: true,
    },
  });

  invariant(data, 'No data returned from Shopify API');
  const policy = data.shop?.[policyName];

  if (!policy) {
    throw new Response('Not found', {status: 404});
  }

  return json(
    {policy},
    {
      headers: {
        // TODO cacheLong()
      },
    },
  );
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return {
    title: data?.policy?.title ?? 'Policies',
  };
};

export default function Policies() {
  const {policy} = useLoaderData<typeof loader>();

  return (
    <>
      <Section
        padding="all"
        display="flex"
        className="flex-col items-baseline w-full gap-8 md:flex-row"
      >
        <PageHeader
          heading={policy.title}
          className="grid items-start flex-grow gap-4 md:sticky top-36 md:w-5/12"
        >
          <Button
            className="justify-self-start"
            variant="inline"
            to={'/policies'}
          >
            &larr; Back to Policies
          </Button>
        </PageHeader>
        <div className="flex-grow w-full md:w-7/12">
          <div
            dangerouslySetInnerHTML={{__html: policy.body}}
            className="prose dark:prose-invert"
          />
        </div>
      </Section>
    </>
  );
}

const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }

  query PoliciesQuery(
    $languageCode: LanguageCode
    $privacyPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
    $refundPolicy: Boolean!
  ) @inContext(language: $languageCode) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
    }
  }
`;
