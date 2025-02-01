import {Suspense} from 'react';
import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  Await,
  Link,
  useLoaderData,
  type MetaFunction,
  type FetcherWithComponents,
} from '@remix-run/react';
import type {
  ProductFragment,
  ProductVariantsQuery,
  ProductVariantFragment,
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  SellingPlanFragment,
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/
} from 'storefrontapi.generated';
import {
  Image,
  Money,
  VariantSelector,
  type VariantOption,
  getSelectedProductOptions,
  CartForm,
  Analytics,
  type CartViewPayload,
  useAnalytics,
  type OptimisticCartLineInput,
} from '@shopify/hydrogen';
import type {
  SelectedOption,
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  CurrencyCode,
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/
} from '@shopify/hydrogen/storefront-api-types';
import {getVariantUrl} from '~/lib/variants';
import {useAside} from '~/components/Aside';
/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
// 1. Import the SellingPlanSelector component and type
import {
  SellingPlanSelector,
  type SellingPlanGroup,
} from '~/components/SellingPlanSelector';
import sellingPanStyle from '~/styles/selling-plan.css?url';
import type {LinksFunction} from '@remix-run/node';

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: sellingPanStyle},
];
/**********   EXAMPLE UPDATE END   ************/
/***********************************************/

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Hydrogen | ${data?.product.title ?? ''}`}];
};

export async function loader({params, request, context}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // await the query for the critical product data
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle, selectedOptions: getSelectedProductOptions(request)},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  // 2. Get the selected selling plan id from the request url
  const selectedSellingPlanId =
    new URL(request.url).searchParams.get('selling_plan') ?? null;
  // 3. Get the selected selling plan from the product
  const selectedSellingPlan =
    product.sellingPlanGroups.nodes?.[0]?.sellingPlans.nodes?.find(
      (sellingPlan: SellingPlanFragment) =>
        sellingPlan.id === selectedSellingPlanId,
    ) ?? null;

  // 4. If the product includes selling plans but no selling plan is selected,
  // we redirect to the first selling plan, so that's is selected by default
  if (product.sellingPlanGroups.nodes?.length && !selectedSellingPlan) {
    const firstSellingPlanId =
      product.sellingPlanGroups.nodes[0].sellingPlans.nodes[0].id;
    return redirect(
      `/products/${product.handle}?${new URLSearchParams({
        selling_plan: firstSellingPlanId,
      }).toString()}`,
    );
  }
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option: SelectedOption) =>
        option.name === 'Title' && option.value === 'Default Title',
    ),
  );

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  } else {
    // if no selected variant was returned from the selected options,
    // we redirect to the first variant's url with it's selected options applied
    if (!product.selectedVariant) {
      throw redirectToFirstVariant({product, request});
    }
  }

  // In order to show which variants are available in the UI, we need to query
  // all of them. But there might be a *lot*, so instead separate the variants
  // into it's own separate query that is deferred. So there's a brief moment
  // where variant options might show as available when they're not, but after
  // this deffered query resolves, the UI will update.
  const variants = storefront.query(VARIANTS_QUERY, {
    variables: {handle},
  });

  return {
    product,
    variants,
    /***********************************************/
    /**********  EXAMPLE UPDATE STARTS  ************/
    // 5. Pass the selectedSellingPlan to the client
    selectedSellingPlan,
    /**********   EXAMPLE UPDATE END   ************/
    /***********************************************/
  };
}

function redirectToFirstVariant({
  product,
  request,
}: {
  product: ProductFragment;
  request: Request;
}) {
  const url = new URL(request.url);
  const firstVariant = product.variants.nodes[0];

  return redirect(
    getVariantUrl({
      pathname: url.pathname,
      handle: product.handle,
      selectedOptions: firstVariant.selectedOptions,
      searchParams: new URLSearchParams(url.search),
    }),
    {
      status: 302,
    },
  );
}

export default function Product() {
  const {
    product,
    variants,
    /***********************************************/
    /**********  EXAMPLE UPDATE STARTS  ************/
    selectedSellingPlan,
    /**********   EXAMPLE UPDATE END   ************/
    /***********************************************/
  } = useLoaderData<typeof loader>();
  const {selectedVariant} = product;
  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        variants={variants}
        /***********************************************/
        /**********  EXAMPLE UPDATE STARTS  ************/
        selectedSellingPlan={selectedSellingPlan}
        /**********   EXAMPLE UPDATE END   ************/
        /***********************************************/
      />
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

function ProductImage({image}: {image: ProductVariantFragment['image']}) {
  if (!image) {
    return <div className="product-image" />;
  }
  return (
    <div className="product-image">
      <Image
        alt={image.altText || 'Product Image'}
        aspectRatio="1/1"
        data={image}
        key={image.id}
        sizes="(min-width: 45em) 50vw, 100vw"
      />
    </div>
  );
}

function ProductMain({
  selectedVariant,
  product,
  variants,
  selectedSellingPlan,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Promise<ProductVariantsQuery>;
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  selectedSellingPlan: SellingPlanFragment | null;
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/
}) {
  const {
    title,
    descriptionHtml,
    /***********************************************/
    /**********  EXAMPLE UPDATE STARTS  ************/
    sellingPlanGroups,
    /**********   EXAMPLE UPDATE END   ************/
    /***********************************************/
  } = product;

  return (
    <div className="product-main">
      <h1>{title}</h1>
      <ProductPrice
        selectedVariant={selectedVariant}
        /***********************************************/
        /**********  EXAMPLE UPDATE STARTS  ************/
        selectedSellingPlan={selectedSellingPlan}
        /**********   EXAMPLE UPDATE END   ************/
        /***********************************************/
      />
      <br />
      <Suspense
        fallback={
          <ProductForm
            product={product}
            selectedVariant={selectedVariant}
            variants={[]}
            /***********************************************/
            /**********  EXAMPLE UPDATE STARTS  ************/
            selectedSellingPlan={selectedSellingPlan}
            sellingPlanGroups={sellingPlanGroups}
            /**********   EXAMPLE UPDATE END   ************/
            /***********************************************/
          />
        }
      >
        <Await
          errorElement="There was a problem loading product variants"
          resolve={variants}
        >
          {(data) => (
            <ProductForm
              product={product}
              selectedVariant={selectedVariant}
              variants={data.product?.variants.nodes || []}
              /***********************************************/
              /**********  EXAMPLE UPDATE STARTS  ************/
              selectedSellingPlan={selectedSellingPlan}
              sellingPlanGroups={sellingPlanGroups}
              /**********   EXAMPLE UPDATE END   ************/
              /***********************************************/
            />
          )}
        </Await>
      </Suspense>
      <br />
      <br />
      <p>
        <strong>Description</strong>
      </p>
      <br />
      <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
      <br />
    </div>
  );
}

function ProductPrice({
  selectedVariant,
  selectedSellingPlan,
}: {
  selectedVariant: ProductFragment['selectedVariant'];
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  selectedSellingPlan: SellingPlanFragment | null;
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/
}) {
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  if (selectedSellingPlan) {
    return (
      <SellingPlanPrice
        selectedSellingPlan={selectedSellingPlan}
        selectedVariant={selectedVariant}
      />
    );
  }
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/

  return (
    <div className="product-price">
      {selectedVariant?.compareAtPrice ? (
        <>
          <p>Sale</p>
          <br />
          <div className="product-price-on-sale">
            {selectedVariant ? <Money data={selectedVariant.price} /> : null}
            <s>
              <Money data={selectedVariant.compareAtPrice} />
            </s>
          </div>
        </>
      ) : (
        selectedVariant?.price && <Money data={selectedVariant?.price} />
      )}
    </div>
  );
}

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
type SellingPlanPrice = {
  amount: number;
  currencyCode: CurrencyCode;
};

/*
  Render the selected selling plan price is available
*/
function SellingPlanPrice({
  selectedSellingPlan,
  selectedVariant,
}: {
  selectedSellingPlan: SellingPlanFragment;
  selectedVariant: ProductFragment['selectedVariant'];
}) {
  if (!selectedVariant) {
    return null;
  }

  const sellingPlanPriceAdjustments = selectedSellingPlan?.priceAdjustments;

  if (!sellingPlanPriceAdjustments?.length) {
    return selectedVariant ? <Money data={selectedVariant.price} /> : null;
  }

  const selectedVariantPrice: SellingPlanPrice = {
    amount: parseFloat(selectedVariant.price.amount),
    currencyCode: selectedVariant.price.currencyCode,
  };

  const sellingPlanPrice: SellingPlanPrice = sellingPlanPriceAdjustments.reduce(
    (acc, adjustment) => {
      switch (adjustment.adjustmentValue.__typename) {
        case 'SellingPlanFixedAmountPriceAdjustment':
          return {
            amount:
              acc.amount +
              parseFloat(adjustment.adjustmentValue.adjustmentAmount.amount),
            currencyCode: acc.currencyCode,
          };
        case 'SellingPlanFixedPriceAdjustment':
          return {
            amount: parseFloat(adjustment.adjustmentValue.price.amount),
            currencyCode: acc.currencyCode,
          };
        case 'SellingPlanPercentagePriceAdjustment':
          return {
            amount:
              acc.amount *
              (1 - adjustment.adjustmentValue.adjustmentPercentage / 100),
            currencyCode: acc.currencyCode,
          };
        default:
          return acc;
      }
    },
    selectedVariantPrice,
  );

  return (
    <div className="selling-plan-price">
      <Money
        data={{
          amount: `${sellingPlanPrice.amount}`,
          currencyCode: sellingPlanPrice.currencyCode,
        }}
      />
    </div>
  );
}

// Update as you see fit to match your design and requirements
function SellingPlanGroup({
  sellingPlanGroup,
}: {
  sellingPlanGroup: SellingPlanGroup;
}) {
  return (
    <div key={sellingPlanGroup.name}>
      <p className="mb-2">
        <strong>{sellingPlanGroup.name}:</strong>
      </p>
      {sellingPlanGroup.sellingPlans.nodes.map((sellingPlan) => {
        return (
          <Link
            key={sellingPlan.id}
            prefetch="intent"
            to={sellingPlan.url}
            className={`selling-plan ${
              sellingPlan.isSelected ? 'selected' : 'unselected'
            }`}
            preventScrollReset
            replace
          >
            <p>
              {sellingPlan.options.map(
                (option) => `${option.name} ${option.value}`,
              )}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
/**********   EXAMPLE UPDATE END   ************/
/***********************************************/

function ProductForm({
  product,
  selectedVariant,
  variants,
  selectedSellingPlan,
  sellingPlanGroups,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Array<ProductVariantFragment>;
  /***********************************************/
  /**********  EXAMPLE UPDATE STARTS  ************/
  selectedSellingPlan: SellingPlanFragment | null;
  sellingPlanGroups: ProductFragment['sellingPlanGroups'];
  /**********   EXAMPLE UPDATE END   ************/
  /***********************************************/
}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <div className="product-form">
      {/***********************************************/
      /**********  EXAMPLE UPDATE STARTS  ************/}
      {sellingPlanGroups.nodes.length > 0 ? (
        <>
          {/* 4. Add the SellingPlanSelector component inside the ProductForm */}
          <SellingPlanSelector
            sellingPlanGroups={sellingPlanGroups}
            selectedSellingPlan={selectedSellingPlan}
          >
            {({sellingPlanGroup}) => (
              /* 5. Render the SellingPlanGroup component inside the SellingPlanSelector */
              <SellingPlanGroup
                key={sellingPlanGroup.name}
                sellingPlanGroup={sellingPlanGroup}
              />
            )}
          </SellingPlanSelector>
        </>
      ) : (
        <VariantSelector
          handle={product.handle}
          options={product.options}
          variants={variants}
        >
          {({option}) => <ProductOptions key={option.name} option={option} />}
        </VariantSelector>
      )}
      {/**********   EXAMPLE UPDATE END   ************/
      /***********************************************/}
      <br />
      <AddToCartButton
        disabled={
          !selectedVariant ||
          !selectedVariant.availableForSale ||
          /***********************************************/
          /**********  EXAMPLE UPDATE STARTS  ************/
          (sellingPlanGroups.nodes.length > 0 && !selectedSellingPlan)
          /**********   EXAMPLE UPDATE END   ************/
          /***********************************************/
        }
        onClick={() => {
          open('cart');
          publish('cart_viewed', {
            cart,
            prevCart,
            shop,
            url: window.location.href || '',
          } as CartViewPayload);
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                  selectedVariant,
                  /***********************************************/
                  /**********  EXAMPLE UPDATE STARTS  ************/
                  sellingPlanId: selectedSellingPlan?.id,
                  /**********   EXAMPLE UPDATE END   ************/
                  /***********************************************/
                },
              ]
            : []
        }
      >
        {/***********************************************/
        /**********  EXAMPLE UPDATE STARTS  ************/}
        {sellingPlanGroups.nodes.length > 0
          ? selectedSellingPlan
            ? 'Subscribe'
            : 'Select a subscription'
          : selectedVariant?.availableForSale
          ? 'Add to cart'
          : 'Sold out'}
        {/**********   EXAMPLE UPDATE END   ************/
        /***********************************************/}
      </AddToCartButton>
    </div>
  );
}

function ProductOptions({option}: {option: VariantOption}) {
  return (
    <div className="product-options" key={option.name}>
      <h5>{option.name}</h5>
      <div className="product-options-grid">
        {option.values.map(({value, isAvailable, isActive, to}) => {
          return (
            <Link
              className="product-options-item"
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
              style={{
                border: isActive ? '1px solid black' : '1px solid transparent',
                opacity: isAvailable ? 1 : 0.3,
              }}
            >
              {value}
            </Link>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            type="submit"
            onClick={onClick}
            disabled={disabled ?? fetcher.state !== 'idle'}
          >
            {children}
          </button>
        </>
      )}
    </CartForm>
  );
}

/***********************************************/
/**********  EXAMPLE UPDATE STARTS  ************/
// 7. Add the SellingPlanGroup fragment to the Product fragment
const SELLING_PLAN_FRAGMENT = `#graphql
  fragment SellingPlanMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment SellingPlan on SellingPlan {
    id
    options {
      name
      value
    }
    priceAdjustments {
      adjustmentValue {
        ... on SellingPlanFixedAmountPriceAdjustment {
          __typename
          adjustmentAmount {
            ... on MoneyV2 {
               ...SellingPlanMoney
            }
          }
        }
        ... on SellingPlanFixedPriceAdjustment {
          __typename
          price {
            ... on MoneyV2 {
              ...SellingPlanMoney
            }
          }
        }
        ... on SellingPlanPercentagePriceAdjustment {
          __typename
          adjustmentPercentage
        }
      }
      orderCount
    }
    recurringDeliveries
    checkoutCharge {
      type
      value {
        ... on MoneyV2 {
          ...SellingPlanMoney
        }
        ... on SellingPlanCheckoutChargePercentageValue {
          percentage
        }
      }
    }
 }
` as const;

//  8. Add the SellingPlanGroup fragment to the Product fragment
const SELLING_PLAN_GROUP_FRAGMENT = `#graphql
  fragment SellingPlanGroup on SellingPlanGroup {
    name
    options {
      name
      values
    }
    sellingPlans(first:10) {
      nodes {
        ...SellingPlan
      }
    }
  }
  ${SELLING_PLAN_FRAGMENT}
` as const;
/**********   EXAMPLE UPDATE END   ************/
/***********************************************/

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
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    options {
      name
      values
    }
    selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    variants(first: 1) {
      nodes {
        ...ProductVariant
      }
    }
    seo {
      description
      title
    }
    #/***********************************************/
    #/**********  EXAMPLE UPDATE STARTS  ************/
    # 9. Add the SellingPlanGroups fragment to the Product fragment
    sellingPlanGroups(first:10) {
      nodes {
        ...SellingPlanGroup
      }
    }
    #/**********   EXAMPLE UPDATE END   ************/
    #/***********************************************/
  }
  ${PRODUCT_VARIANT_FRAGMENT}
  #/***********************************************/
  #/**********  EXAMPLE UPDATE STARTS  ************/
  ${SELLING_PLAN_GROUP_FRAGMENT}
  #/**********   EXAMPLE UPDATE END   ************/
  #/***********************************************/
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const VARIANTS_QUERY = `#graphql
  ${PRODUCT_VARIANTS_FRAGMENT}
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
` as const;
