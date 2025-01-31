import {defer, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction} from '@remix-run/react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductImage} from '~/components/ProductImage';
import {ProductForm} from '~/components/ProductForm';
import {QuantityRules, hasQuantityRules} from '~/components/QuantityRules';
import {PriceBreaks} from '~/components/PriceBreaks';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Hydrogen | ${data?.product.title ?? ''}`}];
};

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
type BuyerVariables = {
  buyer: {
    companyLocationId: string;
    customerAccessToken: string;
  };
} | {};
/**********   EXAMPLE UPDATE END   *************/
/***********************************************/

export async function loader(args: LoaderFunctionArgs) {

  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  const buyer = await args.context.customerAccount.getBuyer();

  const buyerVariables: BuyerVariables =
    buyer?.companyLocationId && buyer?.customerAccessToken
      ? {
          buyer: {
            companyLocationId: buyer.companyLocationId,
            customerAccessToken: buyer.customerAccessToken,
          },
        }
      : {};

  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args, buyerVariables);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args, buyerVariables);
  /**********   EXAMPLE UPDATE END   *************/
  /***********************************************/

  return defer({...deferredData, ...criticalData});
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs, buyerVariables: BuyerVariables) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {
        handle,
        selectedOptions: getSelectedProductOptions(request),
        ...buyerVariables,
      },
      cache: storefront.CacheNone(),
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);
/**********   EXAMPLE UPDATE END   *************/
/***********************************************/

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  return {
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
function loadDeferredData({context, params}: LoaderFunctionArgs, buyerVariables: BuyerVariables) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  // Make sure to pass in buyerVariables to any deferred queries to SFAPI

  return {};
}
/**********   EXAMPLE UPDATE END   *************/
/***********************************************/

export default function Product() {
  const {product} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;

  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <div className="product-main">
        <h1>{title}</h1>
        <ProductPrice
          price={selectedVariant?.price}
          compareAtPrice={selectedVariant?.compareAtPrice}
        />
        <br />
        <ProductForm
          productOptions={productOptions}
          selectedVariant={selectedVariant}
          /***********************************************/
          /**********  EXAMPLE UPDATE STARTS  ************/
          quantity={selectedVariant?.quantityRule?.increment || 1}
          /**********   EXAMPLE UPDATE END   ************/
          /***********************************************/
        />
        <br />
        {
          /***********************************************/
          /**********  EXAMPLE UPDATE STARTS  ************/
          hasQuantityRules(selectedVariant?.quantityRule) ? (
            <QuantityRules
              maximum={selectedVariant?.quantityRule.maximum}
              minimum={selectedVariant?.quantityRule.minimum}
              increment={selectedVariant?.quantityRule.increment}
            />
          ) : null
        }
        <br />
        {
          selectedVariant?.quantityPriceBreaks?.nodes &&
          selectedVariant?.quantityPriceBreaks?.nodes?.length > 0 ? (
            <PriceBreaks
              priceBreaks={selectedVariant?.quantityPriceBreaks?.nodes}
            />
          ) : null
          /**********   EXAMPLE UPDATE END   ************/
          /***********************************************/
        }
        <br />
        <p>
          <strong>Description</strong>
        </p>
        <br />
        <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
        <br />
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    quantityRule {
      maximum
      minimum
      increment
    }
    quantityPriceBreaks(first: 5) {
      nodes {
        minimumQuantity
        price {
          amount
          currencyCode
        }
      }
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;
/**********   EXAMPLE UPDATE END   ************/
/***********************************************/

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $buyer: BuyerInput
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language, buyer: $buyer) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
/**********   EXAMPLE UPDATE END   ************/
/***********************************************/
