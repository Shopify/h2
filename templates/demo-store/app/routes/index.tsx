import {
  type LoaderArgs,
  defer,
  RESOURCE_TYPES,
  notFoundMaybeRedirect,
} from '@shopify/hydrogen-remix';
import {Suspense} from 'react';
import {Await, useLoaderData} from '@remix-run/react';
import {ProductSwimlane, FeaturedCollections, Hero} from '~/components';
import {COLLECTION_CONTENT_FRAGMENT} from '~/data';
import {getHeroPlaceholder} from '~/lib/placeholders';
import {getLocaleFromRequest} from '~/lib/utils';
import type {Metafield} from '@shopify/hydrogen-react/storefront-api-types';
import type * as Generated from './index.generated';

interface HomeSeoData {
  shop: {
    name: string;
    description: string;
  };
}

interface CollectionHero {
  byline: Metafield;
  cta: Metafield;
  handle: string;
  heading: Metafield;
  height?: 'full';
  loading?: 'eager' | 'lazy';
  spread: Metafield;
  spreadSecondary: Metafield;
  top?: boolean;
}

export const handle = {
  hydrogen: {
    resourceType: RESOURCE_TYPES.FRONT_PAGE,
  },
};

export async function loader({request, params, context}: LoaderArgs) {
  const {language, country} = getLocaleFromRequest(request);

  if (
    params.lang &&
    params.lang.toLowerCase() !== `${language}-${country}`.toLowerCase()
  ) {
    // If the lang URL param is defined, yet we still are on `EN-US`
    // the the lang param must be invalid, send to the 404 page
    throw await notFoundMaybeRedirect(request, context);
  }

  const {shop, hero} =
    await context.storefront.query<Generated.HomepageSeoQuery>(
      HOMEPAGE_SEO_QUERY,
      {
        variables: {
          handle: 'freestyle',
        },
      },
    );

  return defer({
    shop,
    primaryHero: hero,
    // @feedback
    // Should these all be deferred? Can any of them be combined?
    // Should there be fallback rendering while deferred?
    featuredProducts:
      context.storefront.query<Generated.HomepageFeatureProductsQuery>(
        HOMEPAGE_FEATURED_PRODUCTS_QUERY,
      ),
    secondaryHero: context.storefront.query<Generated.CollectionHeroQuery>(
      COLLECTION_HERO_QUERY,
      {
        variables: {
          handle: 'backcountry',
        },
      },
    ),
    featuredCollections:
      context.storefront.query<Generated.FeaturedCollectionsQuery>(
        FEATURED_COLLECTIONS_QUERY,
      ),
    tertiaryHero: context.storefront.query<Generated.CollectionHeroQuery>(
      COLLECTION_HERO_QUERY,
      {
        variables: {
          handle: 'winter-2022',
        },
      },
    ),
  });
}

export default function Homepage() {
  const {
    primaryHero,
    secondaryHero,
    tertiaryHero,
    featuredCollections,
    featuredProducts,
  } = useLoaderData<typeof loader>();

  // TODO: skeletons vs placeholders
  const skeletons = getHeroPlaceholder([{}, {}, {}]);

  // TODO: analytics
  // useServerAnalytics({
  //   shopify: {
  //     pageType: ShopifyAnalyticsConstants.pageType.home,
  //   },
  // });

  return (
    <>
      {primaryHero && (
        <Hero {...primaryHero} height="full" top loading="eager" />
      )}

      {featuredProducts && (
        <Suspense>
          <Await resolve={featuredProducts}>
            {({products}) => {
              if (!products?.nodes) return null;
              return (
                <ProductSwimlane
                  products={products.nodes}
                  title="Featured Products"
                  count={4}
                />
              );
            }}
          </Await>
        </Suspense>
      )}

      {secondaryHero && (
        <Suspense fallback={<Hero {...skeletons[1]} />}>
          <Await resolve={secondaryHero}>
            {({hero}) => {
              if (!hero) return null;
              return <Hero {...hero} />;
            }}
          </Await>
        </Suspense>
      )}

      {featuredCollections && (
        <Suspense>
          <Await resolve={featuredCollections}>
            {({collections}) => {
              if (!collections?.nodes) return null;
              return (
                <FeaturedCollections
                  collections={collections.nodes}
                  title="Collections"
                />
              );
            }}
          </Await>
        </Suspense>
      )}

      {tertiaryHero && (
        <Suspense fallback={<Hero {...skeletons[2]} />}>
          <Await resolve={tertiaryHero}>
            {({hero}) => {
              if (!hero) return null;
              return <Hero {...hero} />;
            }}
          </Await>
        </Suspense>
      )}
    </>
  );
}

const HOMEPAGE_SEO_QUERY = /* GraphQL */ `
  ${COLLECTION_CONTENT_FRAGMENT}
  query HomepageSeo(
    $handle: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    hero: collection(handle: $handle) {
      ...CollectionContent
    }
    shop {
      name
      description
    }
  }
`;

const COLLECTION_HERO_QUERY = /* GraphQL */ `
  ${COLLECTION_CONTENT_FRAGMENT}
  query CollectionHero(
    $handle: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    hero: collection(handle: $handle) {
      ...CollectionContent
    }
  }
`;

// TODO: for some reason, importing the fragment doesn't work. Maybe it's a race condition and when it's imported, it's resolved too late?
const PRODUCT_CARD_FRAGMENT = /* GraphQL */ `
  fragment ProductCard on Product {
    id
    title
    publishedAt
    handle
    variants(first: 1) {
      nodes {
        id
        image {
          url
          altText
          width
          height
        }
        price: priceV2 {
          amount
          currencyCode
        }
        compareAtPrice: compareAtPriceV2 {
          amount
          currencyCode
        }
        selectedOptions {
          name
          value
        }
        product {
          handle
          title
        }
      }
    }
  }
`;

// @see: https://shopify.dev/api/storefront/latest/queries/products
export const HOMEPAGE_FEATURED_PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_CARD_FRAGMENT}
  query HomepageFeatureProducts($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 8) {
      nodes {
        ...ProductCard
      }
    }
  }
`;

// @see: https://shopify.dev/api/storefront/latest/queries/collections
export const FEATURED_COLLECTIONS_QUERY = /* GraphQL */ `
  query FeaturedCollections($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    collections(first: 4, sortKey: UPDATED_AT) {
      nodes {
        id
        title
        handle
        image {
          altText
          width
          height
          url
        }
      }
    }
  }
`;
