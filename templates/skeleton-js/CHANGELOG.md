# skeleton

## 2025.1.0

### Patch Changes

- Bump vite, Remix versions and tailwind v4 alpha to beta ([#2696](https://github.com/Shopify/hydrogen/pull/2696)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Workaround for "Error: failed to execute 'insertBefore' on 'Node'" that sometimes happen during development. ([#2701](https://github.com/Shopify/hydrogen/pull/2701)) by [@wizardlyhel](https://github.com/wizardlyhel)

  ```diff
  // root.tsx

  /**
   * The main and reset stylesheets are added in the Layout component
   * to prevent a bug in development HMR updates.
   *
   * This avoids the "failed to execute 'insertBefore' on 'Node'" error
   * that occurs after editing and navigating to another page.
   *
   * It's a temporary fix until the issue is resolved.
   * https://github.com/remix-run/remix/issues/9242
   */
  export function links() {
    return [
  -    {rel: 'stylesheet', href: resetStyles},
  -    {rel: 'stylesheet', href: appStyles},
      {
        rel: 'preconnect',
        href: 'https://cdn.shopify.com',
      },
      {
        rel: 'preconnect',
        href: 'https://shop.app',
      },
      {rel: 'icon', type: 'image/svg+xml', href: favicon},
    ];
  }

  ...

  export function Layout({children}: {children?: React.ReactNode}) {
    const nonce = useNonce();
    const data = useRouteLoaderData<RootLoader>('root');

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
  +        <link rel="stylesheet" href={resetStyles}></link>
  +        <link rel="stylesheet" href={appStyles}></link>

  ```

- Turn on future flag `v3_lazyRouteDiscovery` ([#2702](https://github.com/Shopify/hydrogen/pull/2702)) by [@wizardlyhel](https://github.com/wizardlyhel)

  In your vite.config.ts, add the following line:

  ```diff
  export default defineConfig({
    plugins: [
      hydrogen(),
      oxygen(),
      remix({
        presets: [hydrogen.preset()],
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
  +        v3_lazyRouteDiscovery: true,
        },
      }),
      tsconfigPaths(),
    ],
  ```

  Test your app by running `npm run dev` and nothing should break

- Fix image size warnings on collections page ([#2703](https://github.com/Shopify/hydrogen/pull/2703)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Bump cli version ([#2732](https://github.com/Shopify/hydrogen/pull/2732)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Bump SFAPI to 2025-01 ([#2715](https://github.com/Shopify/hydrogen/pull/2715)) by [@rbshop](https://github.com/rbshop)

- Updated dependencies [[`fdab06f5`](https://github.com/Shopify/hydrogen/commit/fdab06f5d34076b526d406698bdf6fca6787660b), [`ae6d71f0`](https://github.com/Shopify/hydrogen/commit/ae6d71f0976f520ca177c69ff677f852af63859e), [`650d57b3`](https://github.com/Shopify/hydrogen/commit/650d57b3e07125661e23900e73c0bb3027ddbcde), [`064de138`](https://github.com/Shopify/hydrogen/commit/064de13890c68cabb1c3fdbe7f77409a0cf1c384)]:
  - @shopify/remix-oxygen@2.0.10
  - @shopify/hydrogen@2025.1.0

## 2024.10.4

### Patch Changes

- Bump cli version ([#2694](https://github.com/Shopify/hydrogen/pull/2694)) by [@wizardlyhel](https://github.com/wizardlyhel)

## 2024.10.3

### Patch Changes

- Prevent scroll reset on variant change ([#2672](https://github.com/Shopify/hydrogen/pull/2672)) by [@scottdixon](https://github.com/scottdixon)

## 2024.10.2

### Patch Changes

- Remove initial redirect from product display page ([#2643](https://github.com/Shopify/hydrogen/pull/2643)) by [@scottdixon](https://github.com/scottdixon)

- Optional updates for the product route and product form to handle combined listing and 2000 variant limit. ([#2659](https://github.com/Shopify/hydrogen/pull/2659)) by [@wizardlyhel](https://github.com/wizardlyhel)

  1. Update your SFAPI product query to bring in the new query fields:

  ```diff
  const PRODUCT_FRAGMENT = `#graphql
    fragment Product on Product {
      id
      title
      vendor
      handle
      descriptionHtml
      description
  +    encodedVariantExistence
  +    encodedVariantAvailability
      options {
        name
        optionValues {
          name
  +        firstSelectableVariant {
  +          ...ProductVariant
  +        }
  +        swatch {
  +          color
  +          image {
  +            previewImage {
  +              url
  +            }
  +          }
  +        }
        }
      }
  -    selectedVariant: selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
  +    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
  +      ...ProductVariant
  +    }
  +    adjacentVariants (selectedOptions: $selectedOptions) {
  +      ...ProductVariant
  +    }
  -    variants(first: 1) {
  -      nodes {
  -        ...ProductVariant
  -      }
  -    }
      seo {
        description
        title
      }
    }
    ${PRODUCT_VARIANT_FRAGMENT}
  ` as const;
  ```

  2. Update `loadDeferredData` function. We no longer need to load in all the variants. You can also remove `VARIANTS_QUERY` variable.

  ```diff
  function loadDeferredData({context, params}: LoaderFunctionArgs) {
  +  // Put any API calls that is not critical to be available on first page render
  +  // For example: product reviews, product recommendations, social feeds.
  -  // In order to show which variants are available in the UI, we need to query
  -  // all of them. But there might be a *lot*, so instead separate the variants
  -  // into it's own separate query that is deferred. So there's a brief moment
  -  // where variant options might show as available when they're not, but after
  -  // this deferred query resolves, the UI will update.
  -  const variants = context.storefront
  -    .query(VARIANTS_QUERY, {
  -      variables: {handle: params.handle!},
  -    })
  -    .catch((error) => {
  -      // Log query errors, but don't throw them so the page can still render
  -      console.error(error);
  -      return null;
  -    });

  +  return {}
  -  return {
  -    variants,
  -  };
  }
  ```

  3. Remove the redirect logic in the `loadCriticalData` function and completely remove `redirectToFirstVariant` function

  ```diff
  async function loadCriticalData({
    context,
    params,
    request,
  }: LoaderFunctionArgs) {
    const {handle} = params;
    const {storefront} = context;
    if (!handle) {
      throw new Error('Expected product handle to be defined');
    }
    const [{product}] = await Promise.all([
      storefront.query(PRODUCT_QUERY, {
        variables: {handle, selectedOptions: getSelectedProductOptions(request)},
      }),
      // Add other queries here, so that they are loaded in parallel
    ]);

    if (!product?.id) {
      throw new Response(null, {status: 404});
    }

  -  const firstVariant = product.variants.nodes[0];
  -  const firstVariantIsDefault = Boolean(
  -    firstVariant.selectedOptions.find(
  -      (option: SelectedOption) =>
  -        option.name === 'Title' && option.value === 'Default Title',
  -    ),
  -  );

  -  if (firstVariantIsDefault) {
  -    product.selectedVariant = firstVariant;
  -  } else {
  -    // if no selected variant was returned from the selected options,
  -    // we redirect to the first variant's url with it's selected options applied
  -    if (!product.selectedVariant) {
  -      throw redirectToFirstVariant({product, request});
  -    }
  -  }

    return {
      product,
    };
  }

  ...

  -  function redirectToFirstVariant({
  -    product,
  -    request,
  -  }: {
  -    product: ProductFragment;
  -    request: Request;
  -  }) {
  -    ...
  -  }
  ```

  4. Update the `Product` component to use the new data fields.

  ```diff
  import {
    getSelectedProductOptions,
    Analytics,
    useOptimisticVariant,
  +  getAdjacentAndFirstAvailableVariants,
  } from '@shopify/hydrogen';

  export default function Product() {
  +  const {product} = useLoaderData<typeof loader>();
  -  const {product, variants} = useLoaderData<typeof loader>();

  +  // Optimistically selects a variant with given available variant information
  +  const selectedVariant = useOptimisticVariant(
  +    product.selectedOrFirstAvailableVariant,
  +    getAdjacentAndFirstAvailableVariants(product),
  +  );
  -  const selectedVariant = useOptimisticVariant(
  -    product.selectedVariant,
  -    variants,
  -  );
  ```

  5. Handle missing search query param in url from selecting a first variant

  ```diff
  import {
    getSelectedProductOptions,
    Analytics,
    useOptimisticVariant,
    getAdjacentAndFirstAvailableVariants,
  +  useSelectedOptionInUrlParam,
  } from '@shopify/hydrogen';

  export default function Product() {
    const {product} = useLoaderData<typeof loader>();

    // Optimistically selects a variant with given available variant information
    const selectedVariant = useOptimisticVariant(
      product.selectedOrFirstAvailableVariant,
      getAdjacentAndFirstAvailableVariants(product),
    );

  +  // Sets the search param to the selected variant without navigation
  +  // only when no search params are set in the url
  +  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);
  ```

  6. Get the product options array using `getProductOptions`

  ```diff
  import {
    getSelectedProductOptions,
    Analytics,
    useOptimisticVariant,
  +  getProductOptions,
    getAdjacentAndFirstAvailableVariants,
    useSelectedOptionInUrlParam,
  } from '@shopify/hydrogen';

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

  +  // Get the product options array
  +  const productOptions = getProductOptions({
  +    ...product,
  +    selectedOrFirstAvailableVariant: selectedVariant,
  +  });
  ```

  7. Remove the `Await` and `Suspense` from the `ProductForm`. We no longer have any queries that we need to wait for.

  ```diff
  export default function Product() {

    ...

    return (
      ...
  +        <ProductForm
  +          productOptions={productOptions}
  +          selectedVariant={selectedVariant}
  +        />
  -        <Suspense
  -          fallback={
  -            <ProductForm
  -              product={product}
  -              selectedVariant={selectedVariant}
  -              variants={[]}
  -            />
  -          }
  -        >
  -          <Await
  -            errorElement="There was a problem loading product variants"
  -            resolve={variants}
  -          >
  -            {(data) => (
  -              <ProductForm
  -                product={product}
  -                selectedVariant={selectedVariant}
  -                variants={data?.product?.variants.nodes || []}
  -              />
  -            )}
  -          </Await>
  -        </Suspense>
  ```

  8. Update the `ProductForm` component.

  ```tsx
  import {Link, useNavigate} from '@remix-run/react';
  import {type MappedProductOptions} from '@shopify/hydrogen';
  import type {
    Maybe,
    ProductOptionValueSwatch,
  } from '@shopify/hydrogen/storefront-api-types';
  import {AddToCartButton} from './AddToCartButton';
  import {useAside} from './Aside';
  import type {ProductFragment} from 'storefrontapi.generated';

  export function ProductForm({
    productOptions,
    selectedVariant,
  }: {
    productOptions: MappedProductOptions[];
    selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  }) {
    const navigate = useNavigate();
    const {open} = useAside();
    return (
      <div className="product-form">
        {productOptions.map((option) => (
          <div className="product-options" key={option.name}>
            <h5>{option.name}</h5>
            <div className="product-options-grid">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
                  return (
                    <button
                      type="button"
                      className={`product-options-item${
                        exists && !selected ? ' link' : ''
                      }`}
                      key={option.name + name}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          navigate(`?${variantUriQuery}`, {
                            replace: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
            <br />
          </div>
        ))}
        <AddToCartButton
          disabled={!selectedVariant || !selectedVariant.availableForSale}
          onClick={() => {
            open('cart');
          }}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    selectedVariant,
                  },
                ]
              : []
          }
        >
          {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
        </AddToCartButton>
      </div>
    );
  }

  function ProductOptionSwatch({
    swatch,
    name,
  }: {
    swatch?: Maybe<ProductOptionValueSwatch> | undefined;
    name: string;
  }) {
    const image = swatch?.image?.previewImage?.url;
    const color = swatch?.color;

    if (!image && !color) return name;

    return (
      <div
        aria-label={name}
        className="product-option-label-swatch"
        style={{
          backgroundColor: color || 'transparent',
        }}
      >
        {!!image && <img src={image} alt={name} />}
      </div>
    );
  }
  ```

  9. Update `app.css`

  ```diff
  +  /*
  +  * --------------------------------------------------
  +  * Non anchor links
  +  * --------------------------------------------------
  +  */
  +  .link:hover {
  +    text-decoration: underline;
  +    cursor: pointer;
  +  }

  ...

  -  .product-options-item {
  +  .product-options-item,
  +  .product-options-item:disabled {
  +    padding: 0.25rem 0.5rem;
  +    background-color: transparent;
  +    font-size: 1rem;
  +    font-family: inherit;
  +  }

  +  .product-option-label-swatch {
  +    width: 1.25rem;
  +    height: 1.25rem;
  +    margin: 0.25rem 0;
  +  }

  +  .product-option-label-swatch img {
  +    width: 100%;
  +  }
  ```

  10. Update `lib/variants.ts`

  Make `useVariantUrl` and `getVariantUrl` flexible to supplying a selected option param

  ```diff
  export function useVariantUrl(
    handle: string,
  -  selectedOptions: SelectedOption[],
  +  selectedOptions?: SelectedOption[],
  ) {
    const {pathname} = useLocation();

    return useMemo(() => {
      return getVariantUrl({
        handle,
        pathname,
        searchParams: new URLSearchParams(),
        selectedOptions,
      });
    }, [handle, selectedOptions, pathname]);
  }
  export function getVariantUrl({
    handle,
    pathname,
    searchParams,
    selectedOptions,
  }: {
    handle: string;
    pathname: string;
    searchParams: URLSearchParams;
  -  selectedOptions: SelectedOption[];
  +  selectedOptions?: SelectedOption[],
  }) {
    const match = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/g.exec(pathname);
    const isLocalePathname = match && match.length > 0;
    const path = isLocalePathname
      ? `${match![0]}products/${handle}`
      : `/products/${handle}`;

  -  selectedOptions.forEach((option) => {
  +  selectedOptions?.forEach((option) => {
      searchParams.set(option.name, option.value);
    });
  ```

  11. Update `routes/collections.$handle.tsx`

  We no longer need to query for the variants since product route can efficiently
  obtain the first available variants. Update the code to reflect that:

  ```diff
  const PRODUCT_ITEM_FRAGMENT = `#graphql
    fragment MoneyProductItem on MoneyV2 {
      amount
      currencyCode
    }
    fragment ProductItem on Product {
      id
      handle
      title
      featuredImage {
        id
        altText
        url
        width
        height
      }
      priceRange {
        minVariantPrice {
          ...MoneyProductItem
        }
        maxVariantPrice {
          ...MoneyProductItem
        }
      }
  -    variants(first: 1) {
  -      nodes {
  -        selectedOptions {
  -          name
  -          value
  -        }
  -      }
  -    }
    }
  ` as const;
  ```

  and remove the variant reference

  ```diff
  function ProductItem({
    product,
    loading,
  }: {
    product: ProductItemFragment;
    loading?: 'eager' | 'lazy';
  }) {
  -  const variant = product.variants.nodes[0];
  -  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);
  +  const variantUrl = useVariantUrl(product.handle);
    return (
  ```

  12. Update `routes/collections.all.tsx`

  Same reasoning as `collections.$handle.tsx`

  ```diff
  const PRODUCT_ITEM_FRAGMENT = `#graphql
    fragment MoneyProductItem on MoneyV2 {
      amount
      currencyCode
    }
    fragment ProductItem on Product {
      id
      handle
      title
      featuredImage {
        id
        altText
        url
        width
        height
      }
      priceRange {
        minVariantPrice {
          ...MoneyProductItem
        }
        maxVariantPrice {
          ...MoneyProductItem
        }
      }
  -    variants(first: 1) {
  -      nodes {
  -        selectedOptions {
  -          name
  -          value
  -        }
  -      }
  -    }
    }
  ` as const;
  ```

  and remove the variant reference

  ```diff
  function ProductItem({
    product,
    loading,
  }: {
    product: ProductItemFragment;
    loading?: 'eager' | 'lazy';
  }) {
  -  const variant = product.variants.nodes[0];
  -  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);
  +  const variantUrl = useVariantUrl(product.handle);
    return (
  ```

  13. Update `routes/search.tsx`

  Instead of using the first variant, use `selectedOrFirstAvailableVariant`

  ```diff
  const SEARCH_PRODUCT_FRAGMENT = `#graphql
    fragment SearchProduct on Product {
      __typename
      handle
      id
      publishedAt
      title
      trackingParameters
      vendor
  -    variants(first: 1) {
  -      nodes {
  +    selectedOrFirstAvailableVariant(
  +      selectedOptions: []
  +      ignoreUnknownOptions: true
  +      caseInsensitiveMatch: true
  +    ) {
          id
          image {
            url
            altText
            width
            height
          }
          price {
            amount
            currencyCode
          }
          compareAtPrice {
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
  -    }
    }
  ` as const;
  ```

  ```diff
  const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
    fragment PredictiveProduct on Product {
      __typename
      id
      title
      handle
      trackingParameters
  -    variants(first: 1) {
  -      nodes {
  +    selectedOrFirstAvailableVariant(
  +      selectedOptions: []
  +      ignoreUnknownOptions: true
  +      caseInsensitiveMatch: true
  +    ) {
          id
          image {
            url
            altText
            width
            height
          }
          price {
            amount
            currencyCode
          }
       }
  -    }
    }
  ```

  14. Update `components/SearchResults.tsx`

  ```diff
  function SearchResultsProducts({
    term,
    products,
  }: PartialSearchResult<'products'>) {
    if (!products?.nodes.length) {
      return null;
    }

    return (
      <div className="search-result">
        <h2>Products</h2>
        <Pagination connection={products}>
          {({nodes, isLoading, NextLink, PreviousLink}) => {
            const ItemsMarkup = nodes.map((product) => {
              const productUrl = urlWithTrackingParams({
                baseUrl: `/products/${product.handle}`,
                trackingParams: product.trackingParameters,
                term,
              });

  +            const price = product?.selectedOrFirstAvailableVariant?.price;
  +            const image = product?.selectedOrFirstAvailableVariant?.image;

              return (
                <div className="search-results-item" key={product.id}>
                  <Link prefetch="intent" to={productUrl}>
  -                  {product.variants.nodes[0].image && (
  +                  {image && (
                      <Image
  -                      data={product.variants.nodes[0].image}
  +                      data={image}
                        alt={product.title}
                        width={50}
                      />
                    )}
                    <div>
                      <p>{product.title}</p>
                      <small>
  -                      <Money data={product.variants.nodes[0].price} />
  +                      {price &&
  +                        <Money data={price} />
  +                      }
                      </small>
                    </div>
                  </Link>
                </div>
              );
            });
  ```

  15. Update `components/SearchResultsPredictive.tsx`

  ```diff
  function SearchResultsPredictiveProducts({
    term,
    products,
    closeSearch,
  }: PartialPredictiveSearchResult<'products'>) {
    if (!products.length) return null;

    return (
      <div className="predictive-search-result" key="products">
        <h5>Products</h5>
        <ul>
          {products.map((product) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term: term.current,
            });

  +          const price = product?.selectedOrFirstAvailableVariant?.price;
  -          const image = product?.variants?.nodes?.[0].image;
  +          const image = product?.selectedOrFirstAvailableVariant?.image;
            return (
              <li className="predictive-search-result-item" key={product.id}>
                <Link to={productUrl} onClick={closeSearch}>
                  {image && (
                    <Image
                      alt={image.altText ?? ''}
                      src={image.url}
                      width={50}
                      height={50}
                    />
                  )}
                  <div>
                    <p>{product.title}</p>
                    <small>
  -                    {product?.variants?.nodes?.[0].price && (
  +                    {price && (
  -                      <Money data={product.variants.nodes[0].price} />
  +                      <Money data={price} />
                      )}
                    </small>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  ```

- Update `Aside` to have an accessible close button label ([#2639](https://github.com/Shopify/hydrogen/pull/2639)) by [@lb-](https://github.com/lb-)

- Fix cart route so that it works with no-js ([#2665](https://github.com/Shopify/hydrogen/pull/2665)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Bump Shopify cli version ([#2667](https://github.com/Shopify/hydrogen/pull/2667)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Updated dependencies [[`8f64915e`](https://github.com/Shopify/hydrogen/commit/8f64915e934130299307417627a12caf756cd8da), [`a57d5267`](https://github.com/Shopify/hydrogen/commit/a57d5267daa2f22fe1a426fb9f62c242957f95b6), [`91d60fd2`](https://github.com/Shopify/hydrogen/commit/91d60fd2174b7c34f9f6b781cd5f0a70371fd899), [`23a80f3e`](https://github.com/Shopify/hydrogen/commit/23a80f3e7bf9f9908130fc9345397fc694420364)]:
  - @shopify/hydrogen@2024.10.1

## 2024.10.1

### Patch Changes

- Bump to get new cli package version by [@wizardlyhel](https://github.com/wizardlyhel)

## 2024.10.0

### Patch Changes

- Stabilize `getSitemap`, `getSitemapIndex` and implement on skeleton ([#2589](https://github.com/Shopify/hydrogen/pull/2589)) by [@juanpprieto](https://github.com/juanpprieto)

  1. Update the `getSitemapIndex` at `/app/routes/[sitemap.xml].tsx`

  ```diff
  - import {unstable__getSitemapIndex as getSitemapIndex} from '@shopify/hydrogen';
  + import {getSitemapIndex} from '@shopify/hydrogen';
  ```

  2. Update the `getSitemap` at `/app/routes/sitemap.$type.$page[.xml].tsx`

  ```diff
  - import {unstable__getSitemap as getSitemap} from '@shopify/hydrogen';
  + import {getSitemap} from '@shopify/hydrogen';
  ```

  For a reference implementation please see the skeleton template sitemap routes

- [**Breaking change**] ([#2588](https://github.com/Shopify/hydrogen/pull/2588)) by [@wizardlyhel](https://github.com/wizardlyhel)

  Set up Customer Privacy without the Shopify's cookie banner by default.

  If you are using Shopify's cookie banner to handle user consent in your app, you need to set `withPrivacyBanner: true` to the consent config. Without this update, the Shopify cookie banner will not appear.

  ```diff
    return defer({
      ...
      consent: {
        checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
        storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
  +      withPrivacyBanner: true,
        // localize the privacy banner
        country: args.context.storefront.i18n.country,
        language: args.context.storefront.i18n.language,
      },
    });
  ```

- Update to 2024-10 SFAPI ([#2570](https://github.com/Shopify/hydrogen/pull/2570)) by [@wizardlyhel](https://github.com/wizardlyhel)

- [**Breaking change**] ([#2546](https://github.com/Shopify/hydrogen/pull/2546)) by [@frandiox](https://github.com/frandiox)

  Update `createWithCache` to make it harder to accidentally cache undesired results. `request` is now mandatory prop when initializing `createWithCache`.

  ```diff
  // server.ts
  export default {
    async fetch(
      request: Request,
      env: Env,
      executionContext: ExecutionContext,
    ): Promise<Response> {
      try {
        // ...
  -     const withCache = createWithCache({cache, waitUntil});
  +     const withCache = createWithCache({cache, waitUntil, request});
  ```

  `createWithCache` now returns an object with two utility functions: `withCache.run` and `withCache.fetch`. Both have a new prop `shouldCacheResult` that must be defined.

  The original `withCache` callback function is now `withCache.run`. This is useful to run _multiple_ fetch calls and merge their responses, or run any arbitrary code. It caches anything you return, but you can throw if you don't want to cache anything.

  ```diff
    const withCache = createWithCache({cache, waitUntil, request});

    const fetchMyCMS = (query) => {
  -    return withCache(['my-cms', query], CacheLong(), async (params) => {
  +    return withCache.run({
  +      cacheKey: ['my-cms', query],
  +      cacheStrategy: CacheLong(),
  +      // Cache if there are no data errors or a specific data that make this result not suited for caching
  +      shouldCacheResult: (result) => !result?.errors,
  +    }, async(params) => {
        const response = await fetch('my-cms.com/api', {
          method: 'POST',
          body: query,
        });
        if (!response.ok) throw new Error(response.statusText);
        const {data, error} = await response.json();
        if (error || !data) throw new Error(error ?? 'Missing data');
        params.addDebugData({displayName: 'My CMS query', response});
        return data;
      });
    };
  ```

  New `withCache.fetch` is for caching simple fetch requests. This method caches the responses if they are OK responses, and you can pass `shouldCacheResponse`, `cacheKey`, etc. to modify behavior. `data` is the consumed body of the response (we need to consume to cache it).

  ```ts
  const withCache = createWithCache({cache, waitUntil, request});

  const {data, response} = await withCache.fetch<{data: T; error: string}>(
    'my-cms.com/api',
    {
      method: 'POST',
      headers: {'Content-type': 'application/json'},
      body,
    },
    {
      cacheStrategy: CacheLong(),
      // Cache if there are no data errors or a specific data that make this result not suited for caching
      shouldCacheResponse: (result) => !result?.error,
      cacheKey: ['my-cms', body],
      displayName: 'My CMS query',
    },
  );
  ```

- [**Breaking change**] ([#2585](https://github.com/Shopify/hydrogen/pull/2585)) by [@wizardlyhel](https://github.com/wizardlyhel)

  Deprecate usages of `product.options.values` and use `product.options.optionValues` instead.

  1. Update your product graphql query to use the new `optionValues` field.

  ```diff
    const PRODUCT_FRAGMENT = `#graphql
      fragment Product on Product {
        id
        title
        options {
          name
  -        values
  +        optionValues {
  +          name
  +        }
        }
  ```

  2. Update your `<VariantSelector>` to use the new `optionValues` field.

  ```diff
    <VariantSelector
      handle={product.handle}
  -    options={product.options.filter((option) => option.values.length > 1)}
  +    options={product.options.filter((option) => option.optionValues.length > 1)}
      variants={variants}
    >
  ```

- Updated dependencies [[`d97cd56e`](https://github.com/Shopify/hydrogen/commit/d97cd56e859abf8dd005fef2589d99e07fa87b6e), [`809c9f3d`](https://github.com/Shopify/hydrogen/commit/809c9f3d342b56dd3c0d340cb733e6f00053b71d), [`8c89f298`](https://github.com/Shopify/hydrogen/commit/8c89f298a8d9084ee510fb4d0d17766ec43c249c), [`a253ef97`](https://github.com/Shopify/hydrogen/commit/a253ef971acb08f2ee3a2743ca5c901c2922acc0), [`84a66b1e`](https://github.com/Shopify/hydrogen/commit/84a66b1e9d07bd6d6a10e5379ad3350b6bbecde9), [`227035e7`](https://github.com/Shopify/hydrogen/commit/227035e7e11df5fec5ac475b98fa6a318bdbe366), [`ac12293c`](https://github.com/Shopify/hydrogen/commit/ac12293c7b36e1b278bc929c682c65779c300cc7), [`c7c9f2eb`](https://github.com/Shopify/hydrogen/commit/c7c9f2ebd869a9d361504a10566c268e88b6096a), [`76cd4f9b`](https://github.com/Shopify/hydrogen/commit/76cd4f9ba3dd8eff4433d72f4422c06a7d567537), [`8337e534`](https://github.com/Shopify/hydrogen/commit/8337e5342ecca563fab557c3e833485466456cd5)]:
  - @shopify/hydrogen@2024.10.0
  - @shopify/remix-oxygen@2.0.9

## 2024.7.10

### Patch Changes

- Use HTML datalist element for query suggestions for autocomplete experience ([#2506](https://github.com/Shopify/hydrogen/pull/2506)) by [@frontsideair](https://github.com/frontsideair)

- Bump cli packages version ([#2592](https://github.com/Shopify/hydrogen/pull/2592)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Updated dependencies [[`e963389d`](https://github.com/Shopify/hydrogen/commit/e963389d011b1cb44e2874fa332dc355c0d38eb9), [`d08d8c37`](https://github.com/Shopify/hydrogen/commit/d08d8c3779564cc55749f24bed1f6a2958a0a865)]:
  - @shopify/hydrogen@2024.7.9

## 2024.7.9

### Patch Changes

- Updated dependencies [[`f3363030`](https://github.com/Shopify/hydrogen/commit/f3363030a50bd24d946427e01b88ba77253a6cc9), [`bb5b0979`](https://github.com/Shopify/hydrogen/commit/bb5b0979ddffb007111885b3a9b7aa490a3c6882)]:
  - @shopify/hydrogen@2024.7.8
  - @shopify/remix-oxygen@2.0.8

## 2024.7.8

### Patch Changes

- Updated dependencies [[`39f8f8fd`](https://github.com/Shopify/hydrogen/commit/39f8f8fd42766d02c6e98f8090608e641db9f002)]:
  - @shopify/hydrogen@2024.7.7

## 2024.7.7

### Patch Changes

- Updated dependencies [[`d0ff37a9`](https://github.com/Shopify/hydrogen/commit/d0ff37a995bb64598930f8aa53f2612f3b1ea476)]:
  - @shopify/hydrogen@2024.7.6

## 2024.7.6

### Patch Changes

- Update Shopify CLI and cli-kit dependencies to 3.66.1 ([#2512](https://github.com/Shopify/hydrogen/pull/2512)) by [@frandiox](https://github.com/frandiox)

- createCartHandler supplies updateGiftCardCodes method ([#2298](https://github.com/Shopify/hydrogen/pull/2298)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Fix menu links in side panel not working on mobile devices ([#2450](https://github.com/Shopify/hydrogen/pull/2450)) by [@wizardlyhel](https://github.com/wizardlyhel)

  ```diff
  // /app/components/Header.tsx

  export function HeaderMenu({
    menu,
    primaryDomainUrl,
    viewport,
    publicStoreDomain,
  }: {
    menu: HeaderProps['header']['menu'];
    primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
    viewport: Viewport;
    publicStoreDomain: HeaderProps['publicStoreDomain'];
  }) {
    const className = `header-menu-${viewport}`;
  +  const {close} = useAside();

  -  function closeAside(event: React.MouseEvent<HTMLAnchorElement>) {
  -    if (viewport === 'mobile') {
  -      event.preventDefault();
  -      window.location.href = event.currentTarget.href;
  -    }
  -  }

    return (
      <nav className={className} role="navigation">
        {viewport === 'mobile' && (
          <NavLink
            end
  -          onClick={closeAside}
  +          onClick={close}
            prefetch="intent"
            style={activeLinkStyle}
            to="/"
          >
            Home
          </NavLink>
        )}
        {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
          if (!item.url) return null;

          // if the url is internal, we strip the domain
          const url =
            item.url.includes('myshopify.com') ||
            item.url.includes(publicStoreDomain) ||
            item.url.includes(primaryDomainUrl)
              ? new URL(item.url).pathname
              : item.url;
          return (
            <NavLink
              className="header-menu-item"
              end
              key={item.id}
  -            onClick={closeAside}
  +            onClick={close}
              prefetch="intent"
              style={activeLinkStyle}
              to={url}
            >
              {item.title}
            </NavLink>
          );
        })}
      </nav>
    );
  }
  ```

- Add localization support to consent privacy banner ([#2457](https://github.com/Shopify/hydrogen/pull/2457)) by [@juanpprieto](https://github.com/juanpprieto)

- Updated dependencies [[`d633e49a`](https://github.com/Shopify/hydrogen/commit/d633e49aff244a985c58ec77fc2796c9c1cd5df4), [`1b217cd6`](https://github.com/Shopify/hydrogen/commit/1b217cd68ffd5362d201d4bd225ec72e99713461), [`d929b561`](https://github.com/Shopify/hydrogen/commit/d929b5612ec28e53ec216844add33682f131aba7), [`664a09d5`](https://github.com/Shopify/hydrogen/commit/664a09d57ef5d3c67da947a4e8546527c01e37c4), [`0c1e511d`](https://github.com/Shopify/hydrogen/commit/0c1e511df72e9605534bb9c960e86d5c9a4bf2ea), [`eefa8203`](https://github.com/Shopify/hydrogen/commit/eefa820383fa93657ca214991f6099ce9268a4ee)]:
  - @shopify/hydrogen@2024.7.5
  - @shopify/remix-oxygen@2.0.7

## 2024.7.5

### Patch Changes

- Updated dependencies [[`b0d3bc06`](https://github.com/Shopify/hydrogen/commit/b0d3bc0696d266fcfc4eb93d0a4adb9ccb56ade6)]:
  - @shopify/hydrogen@2024.7.4

## 2024.7.4

### Patch Changes

- Search & Predictive Search improvements ([#2363](https://github.com/Shopify/hydrogen/pull/2363)) by [@juanpprieto](https://github.com/juanpprieto)

- 1. Create a app/lib/context file and use `createHydrogenContext` in it. ([#2333](https://github.com/Shopify/hydrogen/pull/2333)) by [@michenly](https://github.com/michenly)

  ```.ts
  // in app/lib/context

  import {createHydrogenContext} from '@shopify/hydrogen';

  export async function createAppLoadContext(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ) {
      const hydrogenContext = createHydrogenContext({
        env,
        request,
        cache,
        waitUntil,
        session,
        i18n: {language: 'EN', country: 'US'},
        cart: {
          queryFragment: CART_QUERY_FRAGMENT,
        },
        // ensure to overwrite any options that is not using the default values from your server.ts
      });

    return {
      ...hydrogenContext,
      // declare additional Remix loader context
    };
  }

  ```

  2. Use `createAppLoadContext` method in server.ts Ensure to overwrite any options that is not using the default values in `createHydrogenContext`.

  ```diff
  // in server.ts

  - import {
  -   createCartHandler,
  -   createStorefrontClient,
  -   createCustomerAccountClient,
  - } from '@shopify/hydrogen';
  + import {createAppLoadContext} from '~/lib/context';

  export default {
    async fetch(
      request: Request,
      env: Env,
      executionContext: ExecutionContext,
    ): Promise<Response> {

  -   const {storefront} = createStorefrontClient(
  -     ...
  -   );

  -   const customerAccount = createCustomerAccountClient(
  -     ...
  -   );

  -   const cart = createCartHandler(
  -     ...
  -   );

  +   const appLoadContext = await createAppLoadContext(
  +      request,
  +      env,
  +      executionContext,
  +   );

      /**
        * Create a Remix request handler and pass
        * Hydrogen's Storefront client to the loader context.
        */
      const handleRequest = createRequestHandler({
        build: remixBuild,
        mode: process.env.NODE_ENV,
  -      getLoadContext: (): AppLoadContext => ({
  -        session,
  -        storefront,
  -        customerAccount,
  -        cart,
  -        env,
  -        waitUntil,
  -      }),
  +      getLoadContext: () => appLoadContext,
      });
    }
  ```

  3. Use infer type for AppLoadContext in env.d.ts

  ```diff
  // in env.d.ts

  + import type {createAppLoadContext} from '~/lib/context';

  + interface AppLoadContext extends Awaited<ReturnType<typeof createAppLoadContext>> {
  - interface AppLoadContext {
  -  env: Env;
  -  cart: HydrogenCart;
  -  storefront: Storefront;
  -  customerAccount: CustomerAccount;
  -  session: AppSession;
  -  waitUntil: ExecutionContext['waitUntil'];
  }

  ```

- Use type `HydrogenEnv` for all the env.d.ts ([#2333](https://github.com/Shopify/hydrogen/pull/2333)) by [@michenly](https://github.com/michenly)

  ```diff
  // in env.d.ts

  + import type {HydrogenEnv} from '@shopify/hydrogen';

  + interface Env extends HydrogenEnv {}
  - interface Env {
  -   SESSION_SECRET: string;
  -  PUBLIC_STOREFRONT_API_TOKEN: string;
  -  PRIVATE_STOREFRONT_API_TOKEN: string;
  -  PUBLIC_STORE_DOMAIN: string;
  -  PUBLIC_STOREFRONT_ID: string;
  -  PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: string;
  -  PUBLIC_CUSTOMER_ACCOUNT_API_URL: string;
  -  PUBLIC_CHECKOUT_DOMAIN: string;
  - }

  ```

- Add a hydration check for google web cache. This prevents an infinite redirect when viewing the cached version of a hydrogen site on Google. ([#2334](https://github.com/Shopify/hydrogen/pull/2334)) by [@blittle](https://github.com/blittle)

  Update your entry.server.jsx file to include this check:

  ```diff
  + if (!window.location.origin.includes("webcache.googleusercontent.com")) {
     startTransition(() => {
       hydrateRoot(
         document,
         <StrictMode>
           <RemixBrowser />
         </StrictMode>
       );
     });
  + }
  ```

- Updated dependencies [[`a2d9acf9`](https://github.com/Shopify/hydrogen/commit/a2d9acf95e019c39df0b10f4841a1d809b810c80), [`c0d7d917`](https://github.com/Shopify/hydrogen/commit/c0d7d9176c80b996064d8e897876f954807c7640), [`b09e9a4c`](https://github.com/Shopify/hydrogen/commit/b09e9a4ca7b931e48462c2d174ca9f67c37f1da2), [`c204eacf`](https://github.com/Shopify/hydrogen/commit/c204eacf0273f625109523ee81053cdc0c4de7e1), [`bf4e3d3c`](https://github.com/Shopify/hydrogen/commit/bf4e3d3c00744a066b50250a12e4f3c675691811), [`20a8e63b`](https://github.com/Shopify/hydrogen/commit/20a8e63b5fd1c8acadda7612c5d4cc411e0c5932), [`6e5d8ea7`](https://github.com/Shopify/hydrogen/commit/6e5d8ea71a2639925d5817b662af26a6b2ba3c6d), [`7c4f67a6`](https://github.com/Shopify/hydrogen/commit/7c4f67a684ad31edea10d1407d00201bbaaa9822), [`dfb9be77`](https://github.com/Shopify/hydrogen/commit/dfb9be7721c7d10cf4354fda60db4e666625518e), [`31ea19e8`](https://github.com/Shopify/hydrogen/commit/31ea19e8957dbc4487314b014a14920444d37f78)]:
  - @shopify/cli-hydrogen@8.4.0
  - @shopify/hydrogen@2024.7.3
  - @shopify/remix-oxygen@2.0.6

## 2024.7.3

### Patch Changes

- Updated dependencies [[`150854ed`](https://github.com/Shopify/hydrogen/commit/150854ed1352245eef180cc6b2bceb41dd8cc898)]:
  - @shopify/hydrogen@2024.7.2

## 2024.7.2

### Patch Changes

- Changed the GraphQL config file format to be TS/JS instead of YAML. ([#2311](https://github.com/Shopify/hydrogen/pull/2311)) by [@frandiox](https://github.com/frandiox)

- Updated dependencies [[`18ea233c`](https://github.com/Shopify/hydrogen/commit/18ea233cd327bf3001ec9b107ad66b05c9c78584), [`8b2322d7`](https://github.com/Shopify/hydrogen/commit/8b2322d783078298cd5d20ec5f3b1faf99b7895b)]:
  - @shopify/cli-hydrogen@8.3.0

## 2024.7.1

### Patch Changes

- Update `@shopify/oxygen-workers-types` to fix issues on Windows. ([#2252](https://github.com/Shopify/hydrogen/pull/2252)) by [@michenly](https://github.com/michenly)

- [**Breaking change**] ([#2113](https://github.com/Shopify/hydrogen/pull/2113)) by [@blittle](https://github.com/blittle)

  Previously the `VariantSelector` component would filter out options that only had one value. This is undesireable for some apps. We've removed that filter, if you'd like to retain the existing functionality, simply filter the options prop before it is passed to the `VariantSelector` component:

  ```diff
   <VariantSelector
     handle={product.handle}
  +  options={product.options.filter((option) => option.values.length > 1)}
  -  options={product.options}
     variants={variants}>
   </VariantSelector>
  ```

  Fixes [#1198](https://github.com/Shopify/hydrogen/discussions/1198)

- Update remix to v2.10.1 ([#2290](https://github.com/Shopify/hydrogen/pull/2290)) by [@michenly](https://github.com/michenly)

- Update root to use [Remix's Layout Export pattern](https://remix.run/docs/en/main/file-conventions/root#layout-export) and eliminate the use of `useLoaderData` in root. ([#2292](https://github.com/Shopify/hydrogen/pull/2292)) by [@michenly](https://github.com/michenly)

  The diff below showcase how you can make this refactor in existing application.

  ```diff
  import {
    Outlet,
  -  useLoaderData,
  +  useRouteLoaderData,
  } from '@remix-run/react';
  -import {Layout} from '~/components/Layout';
  +import {PageLayout} from '~/components/PageLayout';

  -export default function App() {
  +export function Layout({children}: {children?: React.ReactNode}) {
    const nonce = useNonce();
  -  const data = useLoaderData<typeof loader>();
  +  const data = useRouteLoaderData<typeof loader>('root');

    return (
      <html>
      ...
        <body>
  -        <Layout {...data}>
  -          <Outlet />
  -        </Layout>
  +        {data? (
  +          <PageLayout {...data}>{children}</PageLayout>
  +         ) : (
  +          children
  +        )}
        </body>
      </html>
    );
  }

  +export default function App() {
  +  return <Outlet />;
  +}

  export function ErrorBoundary() {
  - const rootData = useLoaderData<typeof loader>();

    return (
  -    <html>
  -    ...
  -      <body>
  -        <Layout {...rootData}>
  -          <div className="route-error">
  -            <h1>Error</h1>
  -            ...
  -          </div>
  -        </Layout>
  -      </body>
  -    </html>
  +    <div className="route-error">
  +      <h1>Error</h1>
  +      ...
  +    </div>
    );
  }

  ```

- Refactor the cart and product form components ([#2132](https://github.com/Shopify/hydrogen/pull/2132)) by [@blittle](https://github.com/blittle)

- Remove manual setting of session in headers and recommend setting it in server after response is created. ([#2137](https://github.com/Shopify/hydrogen/pull/2137)) by [@michenly](https://github.com/michenly)

  Step 1: Add `isPending` implementation in session

  ```diff
  // in app/lib/session.ts
  export class AppSession implements HydrogenSession {
  +  public isPending = false;

    get unset() {
  +    this.isPending = true;
      return this.#session.unset;
    }

    get set() {
  +    this.isPending = true;
      return this.#session.set;
    }

    commit() {
  +    this.isPending = false;
      return this.#sessionStorage.commitSession(this.#session);
    }
  }
  ```

  Step 2: update response header if `session.isPending` is true

  ```diff
  // in server.ts
  export default {
    async fetch(request: Request): Promise<Response> {
      try {
        const response = await handleRequest(request);

  +      if (session.isPending) {
  +        response.headers.set('Set-Cookie', await session.commit());
  +      }

        return response;
      } catch (error) {
        ...
      }
    },
  };
  ```

  Step 3: remove setting cookie with session.commit() in routes

  ```diff
  // in route files
  export async function loader({context}: LoaderFunctionArgs) {
    return json({},
  -    {
  -      headers: {
  -        'Set-Cookie': await context.session.commit(),
  -      },
      },
    );
  }
  ```

- Moved `@shopify/cli` from `dependencies` to `devDependencies`. ([#2312](https://github.com/Shopify/hydrogen/pull/2312)) by [@frandiox](https://github.com/frandiox)

- The `@shopify/cli` package now bundles the `@shopify/cli-hydrogen` plugin. Therefore, you can now remove the latter from your local dependencies: ([#2306](https://github.com/Shopify/hydrogen/pull/2306)) by [@frandiox](https://github.com/frandiox)

  ```diff
      "@shopify/cli": "3.64.0",
  -   "@shopify/cli-hydrogen": "^8.1.1",
      "@shopify/hydrogen": "2024.7.0",
  ```

- Updated dependencies [[`a0e84d76`](https://github.com/Shopify/hydrogen/commit/a0e84d76b67d4c57c4defee06185949c41782eab), [`426bb390`](https://github.com/Shopify/hydrogen/commit/426bb390b25f51e57499ff6673aef70ded935e87), [`4337200c`](https://github.com/Shopify/hydrogen/commit/4337200c7908d56c039171c283a4d92c31a8b7b6), [`710625c7`](https://github.com/Shopify/hydrogen/commit/710625c740a6656488d4b419e2d2451bef9d076f), [`8b9c726d`](https://github.com/Shopify/hydrogen/commit/8b9c726d34f3482b5b5a0da4c7c0c2f20e2c9caa), [`10a419bf`](https://github.com/Shopify/hydrogen/commit/10a419bf1db79cdfd8c41c0223ce695959f60da9), [`6a6278bb`](https://github.com/Shopify/hydrogen/commit/6a6278bb9187b3b5a98cd98ec9dd278882d03c0d), [`66236ca6`](https://github.com/Shopify/hydrogen/commit/66236ca65ddefac99eaa553c7877c85863d84cc2), [`dcbd0bbf`](https://github.com/Shopify/hydrogen/commit/dcbd0bbf4073a3e35e96f3cce257f7b19b2b2aea), [`a5e03e2a`](https://github.com/Shopify/hydrogen/commit/a5e03e2a1e99fcd83ee5a2be7bf6f5f6b47984b3), [`c2690653`](https://github.com/Shopify/hydrogen/commit/c2690653b6b24f7318e9088551a37195255a2247), [`54c2f7ad`](https://github.com/Shopify/hydrogen/commit/54c2f7ad3d0d52e6be10b2a54a1a4fd0cc107a35), [`4337200c`](https://github.com/Shopify/hydrogen/commit/4337200c7908d56c039171c283a4d92c31a8b7b6), [`e96b332b`](https://github.com/Shopify/hydrogen/commit/e96b332ba1aba79aa3d5c2ce18001292070faf49), [`f3065371`](https://github.com/Shopify/hydrogen/commit/f3065371c1dda222c6e40bd8c20528dc9fdea9a5), [`6cd5554b`](https://github.com/Shopify/hydrogen/commit/6cd5554b160d314d35964a5ee8976ed60972bf17), [`9eb60d73`](https://github.com/Shopify/hydrogen/commit/9eb60d73e552c3d22b9325ecbcd5878810893ad3), [`e432533e`](https://github.com/Shopify/hydrogen/commit/e432533e7391ec3fe16a4a24f2b3363206842580), [`de3f70be`](https://github.com/Shopify/hydrogen/commit/de3f70be1a838eda746903cbb38cc25cf0e09fa3), [`83cb96f4`](https://github.com/Shopify/hydrogen/commit/83cb96f42078bf79b20a153d8a8461f75d573ab1)]:
  - @shopify/remix-oxygen@2.0.5
  - @shopify/cli-hydrogen@8.2.0
  - @shopify/hydrogen@2024.7.1

## 2024.4.5

### Patch Changes

- Update remix to v2.9.2 ([#2135](https://github.com/Shopify/hydrogen/pull/2135)) by [@michenly](https://github.com/michenly)

- `<Analytics>` and `useAnalytics` are now stable. ([#2141](https://github.com/Shopify/hydrogen/pull/2141)) by [@wizardlyhel](https://github.com/wizardlyhel)

- Update the skeleton template to use React state in the aside dialogs ([#2088](https://github.com/Shopify/hydrogen/pull/2088)) by [@blittle](https://github.com/blittle)

- Updated dependencies [[`fe82119f`](https://github.com/Shopify/hydrogen/commit/fe82119f5e75df5a0f727bab6a2186e679abc73d), [`32d4c33e`](https://github.com/Shopify/hydrogen/commit/32d4c33e4421a9c56f62a8c392f5417edddd0402), [`8eea75ec`](https://github.com/Shopify/hydrogen/commit/8eea75ec5ead4de98d7d1b2baedce8511029bcae), [`27e51abf`](https://github.com/Shopify/hydrogen/commit/27e51abfc1f5444afa952c503886bfa12fc55c7e), [`f29c9085`](https://github.com/Shopify/hydrogen/commit/f29c9085eb1adbde9e01226484eba8a85b5074ed), [`7b838beb`](https://github.com/Shopify/hydrogen/commit/7b838beb7c43380ffc9c32c2bb9f34291912fa42), [`d702aec2`](https://github.com/Shopify/hydrogen/commit/d702aec2214646a78cdafc2c25d510489db73f6d), [`ca4cf045`](https://github.com/Shopify/hydrogen/commit/ca4cf045f7fb72ad98b62af7bd172ff8cf553de2), [`5a554b2e`](https://github.com/Shopify/hydrogen/commit/5a554b2e9d91894c2db8032f0c29666dce1ea3f2), [`27e51abf`](https://github.com/Shopify/hydrogen/commit/27e51abfc1f5444afa952c503886bfa12fc55c7e), [`5d6465b3`](https://github.com/Shopify/hydrogen/commit/5d6465b32d90052e5580fcb81d98427bcb8ad528), [`608389d6`](https://github.com/Shopify/hydrogen/commit/608389d6d69c6a9801935d528507c165d1dd4ccf), [`9dfd1cfe`](https://github.com/Shopify/hydrogen/commit/9dfd1cfeb3e96c6d3426427a4b5d97ef475dab6d), [`7def3e9f`](https://github.com/Shopify/hydrogen/commit/7def3e9fa6e28f4fde7af43e2f346aa32267c38e), [`65239c76`](https://github.com/Shopify/hydrogen/commit/65239c76ca1d0b294b59b1ad53624485859c4da5), [`ca7f2888`](https://github.com/Shopify/hydrogen/commit/ca7f28887367a4882e57a67c4e248b0f0bba1c9b)]:
  - @shopify/hydrogen@2024.4.3
  - @shopify/cli-hydrogen@8.1.0

## 2024.4.4

### Patch Changes

- Add JSdoc to `getSelectedProductOptions` utility and cleanup the skeleton implementation ([#2089](https://github.com/Shopify/hydrogen/pull/2089)) by [@juanpprieto](https://github.com/juanpprieto)

- Updated dependencies [[`286589ee`](https://github.com/Shopify/hydrogen/commit/286589ee281c161ad323e3d45a8b9b859aa5b11f), [`6f5061d9`](https://github.com/Shopify/hydrogen/commit/6f5061d9432f749fde7902548894e98c0d3f899c), [`ae262b61`](https://github.com/Shopify/hydrogen/commit/ae262b616127a7173d23a1a38a6e658af3105ce8), [`2c11ca3b`](https://github.com/Shopify/hydrogen/commit/2c11ca3b7a00ccca2b621dbc29abd319f9598cc8), [`b70f9c2c`](https://github.com/Shopify/hydrogen/commit/b70f9c2c3db8e863c65509097454b9ad7c81cd52), [`17528db1`](https://github.com/Shopify/hydrogen/commit/17528db1eb3d1baa001bafe0684b4bce28d2e271), [`58ea9bb0`](https://github.com/Shopify/hydrogen/commit/58ea9bb0f0eee83ff89e34e2f1f6ac3c4999e213)]:
  - @shopify/cli-hydrogen@8.0.4
  - @shopify/hydrogen@2024.4.2

## 1.0.10

### Patch Changes

- Update `@shopify/cli` dependency to avoid React version mismatches in your project: ([#2059](https://github.com/Shopify/hydrogen/pull/2059)) by [@frandiox](https://github.com/frandiox)

  ```diff
    "dependencies": {
      ...
  -   "@shopify/cli": "3.58.0",
  +   "@shopify/cli": "3.59.2",
      ...
    }
  ```

- Updated dependencies [[`d2bc720b`](https://github.com/Shopify/hydrogen/commit/d2bc720bb5f7cfb5f42617f98ad2dfcd29891f4b)]:
  - @shopify/cli-hydrogen@8.0.3

## 1.0.9

### Patch Changes

- Pin React dependency to 18.2.0 to avoid mismatches. ([#2051](https://github.com/Shopify/hydrogen/pull/2051)) by [@frandiox](https://github.com/frandiox)

- Updated dependencies [[`9c36c8a5`](https://github.com/Shopify/hydrogen/commit/9c36c8a566b1ae2ceac4846c4c9fe4f63f6f4ab3)]:
  - @shopify/cli-hydrogen@8.0.2

## 1.0.8

### Patch Changes

- Stop inlining the favicon in base64 to avoid issues with the Content-Security-Policy. In `vite.config.js`: ([#2006](https://github.com/Shopify/hydrogen/pull/2006)) by [@frandiox](https://github.com/frandiox)

  ```diff
  export default defineConfig({
    plugins: [
      ...
    ],
  + build: {
  +   assetsInlineLimit: 0,
  + },
  });
  ```

- To improve HMR in Vite, move the `useRootLoaderData` function from `app/root.tsx` to a separate file like `app/lib/root-data.ts`. This change avoids circular imports: ([#2014](https://github.com/Shopify/hydrogen/pull/2014)) by [@frandiox](https://github.com/frandiox)

  ```tsx
  // app/lib/root-data.ts
  import {useMatches} from '@remix-run/react';
  import type {SerializeFrom} from '@shopify/remix-oxygen';
  import type {loader} from '~/root';

  /**
   * Access the result of the root loader from a React component.
   */
  export const useRootLoaderData = () => {
    const [root] = useMatches();
    return root?.data as SerializeFrom<typeof loader>;
  };
  ```

  Import this hook from `~/lib/root-data` instead of `~/root` in your components.

- Updated dependencies [[`b4dfda32`](https://github.com/Shopify/hydrogen/commit/b4dfda320ca52855b2d4493a4306d15a883ca843), [`ffa57bdb`](https://github.com/Shopify/hydrogen/commit/ffa57bdbcdf51e03d565736f9388b5bb4f46292c), [`ac4e1670`](https://github.com/Shopify/hydrogen/commit/ac4e1670f0361a2cd2c6827e4162bbbee0ca37f3), [`0af624d5`](https://github.com/Shopify/hydrogen/commit/0af624d51afc7250db889ba5e736c85a6070c8b2), [`9723eaf3`](https://github.com/Shopify/hydrogen/commit/9723eaf3e5a42c30e657d1cadb123ed775d620e4), [`e842f68c`](https://github.com/Shopify/hydrogen/commit/e842f68c8e879d4c54e0730f3cb55214a760d7f5)]:
  - @shopify/cli-hydrogen@8.0.1
  - @shopify/hydrogen@2024.4.1

## 1.0.7

### Patch Changes

- Update internal libraries for parsing `.env` files. ([#1946](https://github.com/Shopify/hydrogen/pull/1946)) by [@aswamy](https://github.com/aswamy)

  Please update the `@shopify/cli` dependency in your app to avoid duplicated subdependencies:

  ```diff
  "dependencies": {
  -   "@shopify/cli": "3.56.3",
  +   "@shopify/cli": "3.58.0",
  }
  ```

- Add Adds magic Catalog route ([#1967](https://github.com/Shopify/hydrogen/pull/1967)) by [@juanpprieto](https://github.com/juanpprieto)

- Update Vite plugin imports, and how their options are passed to Remix: ([#1935](https://github.com/Shopify/hydrogen/pull/1935)) by [@frandiox](https://github.com/frandiox)

  ```diff
  -import {hydrogen, oxygen} from '@shopify/cli-hydrogen/experimental-vite';
  +import {hydrogen} from '@shopify/hydrogen/vite';
  +import {oxygen} from '@shopify/mini-oxygen/vite';
  import {vitePlugin as remix} from '@remix-run/dev';

  export default defineConfig({
      hydrogen(),
      oxygen(),
      remix({
  -     buildDirectory: 'dist',
  +     presets: [hydrogen.preset()],
        future: {
  ```

- Add `@shopify/mini-oxygen` as a dev dependency for local development: ([#1891](https://github.com/Shopify/hydrogen/pull/1891)) by [@frandiox](https://github.com/frandiox)

  ```diff
    "devDependencies": {
      "@remix-run/dev": "^2.8.0",
      "@remix-run/eslint-config": "^2.8.0",
  +   "@shopify/mini-oxygen": "^3.0.0",
      "@shopify/oxygen-workers-types": "^4.0.0",
      ...
    },
  ```

- Add the `customer-account push` command to the Hydrogen CLI. This allows you to push the current `--dev-origin` URL to the Shopify admin to enable secure connection to the Customer Account API for local development. ([#1804](https://github.com/Shopify/hydrogen/pull/1804)) by [@michenly](https://github.com/michenly)

- Fix types returned by the `session` object. ([#1869](https://github.com/Shopify/hydrogen/pull/1869)) by [@frandiox](https://github.com/frandiox)

  In `remix.env.d.ts` or `env.d.ts`, add the following types:

  ```diff
  import type {
    // ...
    HydrogenCart,
  + HydrogenSessionData,
  } from '@shopify/hydrogen';

  // ...

  declare module '@shopify/remix-oxygen' {
    // ...

  + interface SessionData extends HydrogenSessionData {}
  }
  ```

- Codegen dependencies must be now listed explicitly in `package.json`: ([#1962](https://github.com/Shopify/hydrogen/pull/1962)) by [@frandiox](https://github.com/frandiox)

  ```diff
  {
    "devDependencies": {
  +   "@graphql-codegen/cli": "5.0.2",
      "@remix-run/dev": "^2.8.0",
      "@remix-run/eslint-config": "^2.8.0",
  +   "@shopify/hydrogen-codegen": "^0.3.0",
      "@shopify/mini-oxygen": "^2.2.5",
      "@shopify/oxygen-workers-types": "^4.0.0",
      ...
    }
  }
  ```

- Updated dependencies [[`4eaec272`](https://github.com/Shopify/hydrogen/commit/4eaec272696f1a718aa7cab1070a54385ebc3686), [`14bb5df1`](https://github.com/Shopify/hydrogen/commit/14bb5df1c1513a7991183d34e72220cb2b139cf5), [`646b78d4`](https://github.com/Shopify/hydrogen/commit/646b78d4bc26310121b16000ed4d1c5d5e63957d), [`87072950`](https://github.com/Shopify/hydrogen/commit/870729505f7eb1f1c709799dd036ad02fd94be95), [`5f1295fe`](https://github.com/Shopify/hydrogen/commit/5f1295fe60b86396f364fefef339248a444c988a), [`3c8a7313`](https://github.com/Shopify/hydrogen/commit/3c8a7313cafb0ca21bbca19ac0b3f8ef4ab12655), [`ca1dcbb7`](https://github.com/Shopify/hydrogen/commit/ca1dcbb7d69c458006e25892c86c4478d394a428), [`11879b17`](https://github.com/Shopify/hydrogen/commit/11879b175d78e3326de090a56a044d1e55d0bae8), [`f4d6e5b0`](https://github.com/Shopify/hydrogen/commit/f4d6e5b0244392a7c13b9fa51c5046fd103c3e4f), [`788d86b3`](https://github.com/Shopify/hydrogen/commit/788d86b3a737bff53b4ec3aa9667458b2d45ade7), [`ebaf5529`](https://github.com/Shopify/hydrogen/commit/ebaf5529287b24a70b3146444b18f95b64f9f336), [`da95bb1c`](https://github.com/Shopify/hydrogen/commit/da95bb1c8c644f450053ce649b40dc380e7375dc), [`5bb43304`](https://github.com/Shopify/hydrogen/commit/5bb43304c08427786cfd4f2529e59bd38f593252), [`140e4768`](https://github.com/Shopify/hydrogen/commit/140e4768c880aaed4ba95b1d4c707df6963e011c), [`062d6be7`](https://github.com/Shopify/hydrogen/commit/062d6be7e031c388498ec3d359de51a4bfdfdfd8), [`b3323e59`](https://github.com/Shopify/hydrogen/commit/b3323e59a4381647f1df797c5dc54793f6e0a29a), [`ab0df5a5`](https://github.com/Shopify/hydrogen/commit/ab0df5a52bc587515880ae26f4edd18ba2be83cd), [`ebaf5529`](https://github.com/Shopify/hydrogen/commit/ebaf5529287b24a70b3146444b18f95b64f9f336), [`ebaf5529`](https://github.com/Shopify/hydrogen/commit/ebaf5529287b24a70b3146444b18f95b64f9f336), [`9e899218`](https://github.com/Shopify/hydrogen/commit/9e8992181ce7d27548d35f98b5a4f78b80795ce8), [`a209019f`](https://github.com/Shopify/hydrogen/commit/a209019f722ece4b65f8d5f37c8018c949956b1e), [`d007b7bc`](https://github.com/Shopify/hydrogen/commit/d007b7bc6f6c36e984d937108230ecc7c202fa42), [`a5511cd7`](https://github.com/Shopify/hydrogen/commit/a5511cd7bf9b0f0c4ef0e52cd72418f78c04785b), [`4afedb4d`](https://github.com/Shopify/hydrogen/commit/4afedb4d7202715df9a153e877e8eb281cc3e928), [`34fbae23`](https://github.com/Shopify/hydrogen/commit/34fbae23999eefbd1af1dff44816a52813d75b44), [`e3baaba5`](https://github.com/Shopify/hydrogen/commit/e3baaba54c701a48923ab3fe8078278f2db2c53f), [`99d72f7a`](https://github.com/Shopify/hydrogen/commit/99d72f7afc354abb66ed0e4ffb020bede2781286), [`9351f9f5`](https://github.com/Shopify/hydrogen/commit/9351f9f564267124bcbf986f5550a542c4bf1e30)]:
  - @shopify/cli-hydrogen@8.0.0
  - @shopify/hydrogen@2024.4.0
  - @shopify/remix-oxygen@2.0.4

## 1.0.6

### Patch Changes

- Improve performance of predictive search: ([#1823](https://github.com/Shopify/hydrogen/pull/1823)) by [@frandiox](https://github.com/frandiox)

  - Change the request to be GET instead of POST to avoid Remix route revalidations.
  - Add Cache-Control headers to the response to get quicker results when typing.

  Aside from that, it now shows a loading state when fetching the results instead of "No results found.".

- Updated dependencies [[`351b3c1b`](https://github.com/Shopify/hydrogen/commit/351b3c1b7768870793ff072ba91426107ba0180c), [`5060cf57`](https://github.com/Shopify/hydrogen/commit/5060cf57f69d8391b425b54acaa487af1f7405ae), [`2888014e`](https://github.com/Shopify/hydrogen/commit/2888014e54fab72c150e9eca55df3c6dd789503e)]:
  - @shopify/hydrogen@2024.1.4
  - @shopify/cli-hydrogen@7.1.2

## 1.0.5

### Patch Changes

- Update the `@shopify/cli` dependency: ([#1786](https://github.com/Shopify/hydrogen/pull/1786)) by [@frandiox](https://github.com/frandiox)

  ```diff
  - "@shopify/cli": "3.52.0",
  + "@shopify/cli": "3.56.3",
  ```

- Update Remix and associated packages to 2.8.0. ([#1781](https://github.com/Shopify/hydrogen/pull/1781)) by [@frandiox](https://github.com/frandiox)

  ```diff
  "dependencies": {
  -  "@remix-run/react": "^2.6.0",
  -  "@remix-run/server-runtime": "^2.6.0",
  +  "@remix-run/react": "^2.8.0",
  +  "@remix-run/server-runtime": "^2.8.0",
      //...
    },
    "devDependencies": {
  -   "@remix-run/dev": "^2.6.0",
  -   "@remix-run/eslint-config": "^2.6.0",
  +  "@remix-run/dev": "^2.8.0",
  +  "@remix-run/eslint-config": "^2.8.0",
      //...
    },
  ```

- Updated dependencies [[`ced1d4cb`](https://github.com/Shopify/hydrogen/commit/ced1d4cb5b1eeeb4303449eb1d60aac44f33480e), [`fc013401`](https://github.com/Shopify/hydrogen/commit/fc013401c5727948b602c9c6b6963a2df21cbd38), [`e641255e`](https://github.com/Shopify/hydrogen/commit/e641255eccc5783b41c8fabbc88313a610f539d0), [`d7e04cb6`](https://github.com/Shopify/hydrogen/commit/d7e04cb6a33d40ea86fa8ac2712d7a5ea785de2d), [`eedd9c49`](https://github.com/Shopify/hydrogen/commit/eedd9c497b36aba47a641cecbc710e18f5b14e46)]:
  - @shopify/cli-hydrogen@7.1.1
  - @shopify/hydrogen@2024.1.3

## 1.0.4

### Patch Changes

- This is an important fix to a bug with 404 routes and path-based i18n projects where some unknown routes would not properly render a 404. This fixes all new projects, but to fix existing projects, add a `($locale).tsx` route with the following contents: ([#1732](https://github.com/Shopify/hydrogen/pull/1732)) by [@blittle](https://github.com/blittle)

  ```ts
  import {type LoaderFunctionArgs} from '@remix-run/server-runtime';

  export async function loader({params, context}: LoaderFunctionArgs) {
    const {language, country} = context.storefront.i18n;

    if (
      params.locale &&
      params.locale.toLowerCase() !== `${language}-${country}`.toLowerCase()
    ) {
      // If the locale URL param is defined, yet we still are still at the default locale
      // then the the locale param must be invalid, send to the 404 page
      throw new Response(null, {status: 404});
    }

    return null;
  }
  ```

- Add defensive null checks to the default cart implementation in the starter template ([#1746](https://github.com/Shopify/hydrogen/pull/1746)) by [@blittle](https://github.com/blittle)

- 🐛 Fix issue where customer login does not persist to checkout ([#1719](https://github.com/Shopify/hydrogen/pull/1719)) by [@michenly](https://github.com/michenly)

  ✨ Add `customerAccount` option to `createCartHandler`. Where a `?logged_in=true` will be added to the checkoutUrl for cart query if a customer is logged in.

- Updated dependencies [[`faeba9f8`](https://github.com/Shopify/hydrogen/commit/faeba9f8947d6b9420b33274a0f39b62418ff2e5), [`6d585026`](https://github.com/Shopify/hydrogen/commit/6d585026623204e99d54a5f2efa3d1c74f690bb6), [`fcecfb23`](https://github.com/Shopify/hydrogen/commit/fcecfb2307210b9d73a7cc90ba865508937217ba), [`28864d6f`](https://github.com/Shopify/hydrogen/commit/28864d6ffbb19b62a5fb8f4c9bbe27568de62411), [`c0ec7714`](https://github.com/Shopify/hydrogen/commit/c0ec77141fb1d7a713d91219b8777bc541780ae8), [`226cf478`](https://github.com/Shopify/hydrogen/commit/226cf478a5bdef1cca33fe8f69832ae0e557d9d9), [`06d9fd91`](https://github.com/Shopify/hydrogen/commit/06d9fd91140bd52a8ee41a20bc114ce2e7fb67dc)]:
  - @shopify/cli-hydrogen@7.1.0
  - @shopify/hydrogen@2024.1.2

## 1.0.3

### Patch Changes

- ♻️ `CustomerClient` type is deprecated and replaced by `CustomerAccount` ([#1692](https://github.com/Shopify/hydrogen/pull/1692)) by [@michenly](https://github.com/michenly)

- Updated dependencies [[`02798786`](https://github.com/Shopify/hydrogen/commit/02798786bf8ae5c53f6430723a86d62b8e94d120), [`52b15df4`](https://github.com/Shopify/hydrogen/commit/52b15df457ce723bbc83ad594ded73a7b06447d6), [`a2664362`](https://github.com/Shopify/hydrogen/commit/a2664362a7d89b34835553a9b0eb7af55ca70ae4), [`eee5d927`](https://github.com/Shopify/hydrogen/commit/eee5d9274b72404dfb0ffef30d5503fd553be5fe), [`c7b2017f`](https://github.com/Shopify/hydrogen/commit/c7b2017f11a2cb4d280dfd8f170e65a908b9ea02), [`06320ee4`](https://github.com/Shopify/hydrogen/commit/06320ee48b94dbfece945461031a252f454fd0a3)]:
  - @shopify/hydrogen@2024.1.1
  - @shopify/cli-hydrogen@7.0.1

## 1.0.2

### Patch Changes

- Use new parameters introduced in Storefront API v2024-01 to fix redirection to the product's default variant when there are unknown query params in the URL. ([#1642](https://github.com/Shopify/hydrogen/pull/1642)) by [@wizardlyhel](https://github.com/wizardlyhel)

  ```diff
  -   selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions) {
  +   selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
        ...ProductVariant
      }
  ```

- Update the GraphQL config in `.graphqlrc.yml` to use the more modern `projects` structure: ([#1577](https://github.com/Shopify/hydrogen/pull/1577)) by [@frandiox](https://github.com/frandiox)

  ```diff
  -schema: node_modules/@shopify/hydrogen/storefront.schema.json
  +projects:
  + default:
  +    schema: 'node_modules/@shopify/hydrogen/storefront.schema.json'
  ```

  This allows you to add additional projects to the GraphQL config, such as third party CMS schemas.

  Also, you can modify the document paths used for the Storefront API queries. This is useful if you have a large codebase and want to exclude certain files from being used for codegen or other GraphQL utilities:

  ```yaml
  projects:
    default:
      schema: 'node_modules/@shopify/hydrogen/storefront.schema.json'
      documents:
        - '!*.d.ts'
        - '*.{ts,tsx,js,jsx}'
        - 'app/**/*.{ts,tsx,js,jsx}'
  ```

- Improve resiliency of `HydrogenSession` ([#1583](https://github.com/Shopify/hydrogen/pull/1583)) by [@blittle](https://github.com/blittle)

- Update `@shopify/cli` dependency in `package.json`: ([#1579](https://github.com/Shopify/hydrogen/pull/1579)) by [@frandiox](https://github.com/frandiox)

  ```diff
  -   "@shopify/cli": "3.51.0",
  +   "@shopify/cli": "3.52.0",
  ```

- - Update example and template Remix versions to `^2.5.1` ([#1639](https://github.com/Shopify/hydrogen/pull/1639)) by [@wizardlyhel](https://github.com/wizardlyhel)

  - Enable Remix future flags:
    - [`v3_fetcherPersist`](https://remix.run/docs/en/main/hooks/use-fetchers#additional-resources)
    - [`v3_relativeSplatpath`](https://remix.run/docs/en/main/hooks/use-resolved-path#splat-paths)

- Updated dependencies [[`810f48cf`](https://github.com/Shopify/hydrogen/commit/810f48cf5d55f0cfcac6e01fe481db8c76e77cd2), [`8c477cb5`](https://github.com/Shopify/hydrogen/commit/8c477cb565c3e018bf4e13bad01804c21611fb8a), [`42ac4138`](https://github.com/Shopify/hydrogen/commit/42ac4138553c7e1a438b075c4f9cb781edffebc4), [`0241b7d2`](https://github.com/Shopify/hydrogen/commit/0241b7d2dcb887d259ce9033aca356d391bc07df), [`6a897586`](https://github.com/Shopify/hydrogen/commit/6a897586bd0908db90736921d11e4b6bdf29c912), [`0ff63bed`](https://github.com/Shopify/hydrogen/commit/0ff63bed840f5b8a5eb9968b67bd9a5a57099253), [`6bc1d61c`](https://github.com/Shopify/hydrogen/commit/6bc1d61c17a9c9be13f52338d2ab940e64e73495), [`eb0f4bcc`](https://github.com/Shopify/hydrogen/commit/eb0f4bccb57966a00ecb2b88d17dd694599da340), [`400bfee6`](https://github.com/Shopify/hydrogen/commit/400bfee6836a51c6ab5e4804e8b1e9ad48856dcb), [`a69c21ca`](https://github.com/Shopify/hydrogen/commit/a69c21caa15dfedb88afd50f262f17bf86f74836), [`970073e7`](https://github.com/Shopify/hydrogen/commit/970073e78258880505e0de563136b5379d5d24af), [`772118ca`](https://github.com/Shopify/hydrogen/commit/772118ca6aefbd47841fffc6ce42856c2dc779bd), [`335375a6`](https://github.com/Shopify/hydrogen/commit/335375a6b1a512f70e169a82bc87a8392dc8c92c), [`335371ce`](https://github.com/Shopify/hydrogen/commit/335371ceb6e1bd5aebb6104f131d3f22798a245f), [`94509b75`](https://github.com/Shopify/hydrogen/commit/94509b750afefd686971198ed86277e2c70f3176), [`36d6fa2c`](https://github.com/Shopify/hydrogen/commit/36d6fa2c4fa54ff79f06ef17aa41f60478977bc0), [`3e7b6e8a`](https://github.com/Shopify/hydrogen/commit/3e7b6e8a3bf66bad7fc0f9c224f1c163dbe3e288), [`cce65795`](https://github.com/Shopify/hydrogen/commit/cce6579580f849bec9a28cf575f7130ba3627f6b), [`9e3d88d4`](https://github.com/Shopify/hydrogen/commit/9e3d88d498efaa20fe23de9837e0f444180bc787), [`ca1161b2`](https://github.com/Shopify/hydrogen/commit/ca1161b29ad7b4d0838953782fb114d5fe82193a), [`92840e51`](https://github.com/Shopify/hydrogen/commit/92840e51820e5c7822f731affd3f591c0099be10), [`952fedf2`](https://github.com/Shopify/hydrogen/commit/952fedf27b869164550954d1c15f53b32ec02675), [`1bc053c9`](https://github.com/Shopify/hydrogen/commit/1bc053c94ba1be14ddc28be9eb70be7219b295d1)]:
  - @shopify/hydrogen@2024.1.0
  - @shopify/cli-hydrogen@7.0.0
  - @shopify/remix-oxygen@2.0.3

## 1.0.1

### Patch Changes

- Sync up environment variable names across all example & type files. ([#1542](https://github.com/Shopify/hydrogen/pull/1542)) by [@michenly](https://github.com/michenly)

- Remove error boundary from robots.txt file in the Skeleton template ([#1492](https://github.com/Shopify/hydrogen/pull/1492)) by [@andrewcohen](https://github.com/andrewcohen)

- Use the worker runtime by default when running the `dev` or `preview` commands. ([#1525](https://github.com/Shopify/hydrogen/pull/1525)) by [@frandiox](https://github.com/frandiox)

  Enable it in your project by adding the `--worker` flag to your package.json scripts:

  ```diff
  "scripts": {
    "build": "shopify hydrogen build",
  - "dev": "shopify hydrogen dev --codegen",
  + "dev": "shopify hydrogen dev --worker --codegen",
  - "preview": "npm run build && shopify hydrogen preview",
  + "preview": "npm run build && shopify hydrogen preview --worker",
    ...
  }
  ```

- Update to the latest version of `@shopify/oxygen-workers-types`. ([#1494](https://github.com/Shopify/hydrogen/pull/1494)) by [@frandiox](https://github.com/frandiox)

  In TypeScript projects, when updating to the latest `@shopify/remix-oxygen` adapter release, you should also update to the latest version of `@shopify/oxygen-workers-types`:

  ```diff
  "devDependencies": {
    "@remix-run/dev": "2.1.0",
    "@remix-run/eslint-config": "2.1.0",
  - "@shopify/oxygen-workers-types": "^3.17.3",
  + "@shopify/oxygen-workers-types": "^4.0.0",
    "@shopify/prettier-config": "^1.1.2",
    ...
  },
  ```

- Update internal dependencies for bug resolution. ([#1496](https://github.com/Shopify/hydrogen/pull/1496)) by [@vincentezw](https://github.com/vincentezw)

  Update your `@shopify/cli` dependency to avoid duplicated sub-dependencies:

  ```diff
    "dependencies": {
  -   "@shopify/cli": "3.50.2",
  +   "@shopify/cli": "3.51.0",
    }
  ```

- Update all Node.js dependencies to version 18. (Not a breaking change, since Node.js 18 is already required by Remix v2.) ([#1543](https://github.com/Shopify/hydrogen/pull/1543)) by [@michenly](https://github.com/michenly)

- 🐛 fix undefined menu error ([#1533](https://github.com/Shopify/hydrogen/pull/1533)) by [@michenly](https://github.com/michenly)

- Add `@remix-run/server-runtime` dependency. ([#1489](https://github.com/Shopify/hydrogen/pull/1489)) by [@frandiox](https://github.com/frandiox)

  Since Remix is now a peer dependency of `@shopify/remix-oxygen`, you need to add `@remix-run/server-runtime` to your dependencies, with the same version as the rest of your Remix dependencies.

  ```diff
  "dependencies": {
    "@remix-run/react": "2.1.0"
  + "@remix-run/server-runtime": "2.1.0"
    ...
  }
  ```

- Updated dependencies [[`b2a350a7`](https://github.com/Shopify/hydrogen/commit/b2a350a754ea2d29bc267c260dc298a02f8f4470), [`9b4f4534`](https://github.com/Shopify/hydrogen/commit/9b4f453407338874bd8f1a1f619b607670e021d0), [`74ea1dba`](https://github.com/Shopify/hydrogen/commit/74ea1dba9af37a146882df7ed9674be5659862b5), [`2be9ce82`](https://github.com/Shopify/hydrogen/commit/2be9ce82fd4a5121f1772bbb7349e96ed530e84e), [`a9b8bcde`](https://github.com/Shopify/hydrogen/commit/a9b8bcde96c22cedef7d87631d429199810b4a7a), [`bca112ed`](https://github.com/Shopify/hydrogen/commit/bca112ed7db49e533fe49898b663fa0dd318e6ba), [`848c6260`](https://github.com/Shopify/hydrogen/commit/848c6260a2db3a9cb0c86351f0f7128f61e028f0), [`d53b4ed7`](https://github.com/Shopify/hydrogen/commit/d53b4ed752eb0530622a666ea7dcf4b40239cafa), [`961fd8c6`](https://github.com/Shopify/hydrogen/commit/961fd8c630727784f77b9f693d2e8ff8601969fc), [`2bff9fc7`](https://github.com/Shopify/hydrogen/commit/2bff9fc75916fa95f9a9279d069408fb7a33755c), [`c8e8f6fd`](https://github.com/Shopify/hydrogen/commit/c8e8f6fd233e52cf5570b1904af710d6b907aae5), [`8fce70de`](https://github.com/Shopify/hydrogen/commit/8fce70de32bd61ee86a6d895ac43cc1f78f1bf49), [`f90e4d47`](https://github.com/Shopify/hydrogen/commit/f90e4d4713c6c1fc1e921a7ecd08e95fe5da1744), [`e8cc49fe`](https://github.com/Shopify/hydrogen/commit/e8cc49feff18f5ee72d5f6965ff2094addc23466)]:
  - @shopify/cli-hydrogen@6.1.0
  - @shopify/remix-oxygen@2.0.2
  - @shopify/hydrogen@2023.10.3

## 1.0.0

### Major Changes

- The Storefront API 2023-10 now returns menu item URLs that include the `primaryDomainUrl`, instead of defaulting to the Shopify store ID URL (example.myshopify.com). The skeleton template requires changes to check for the `primaryDomainUrl`: by [@blittle](https://github.com/blittle)

  1. Update the `HeaderMenu` component to accept a `primaryDomainUrl` and include
     it in the internal url check

  ```diff
  // app/components/Header.tsx

  + import type {HeaderQuery} from 'storefrontapi.generated';

  export function HeaderMenu({
    menu,
  +  primaryDomainUrl,
    viewport,
  }: {
    menu: HeaderProps['header']['menu'];
  +  primaryDomainUrl: HeaderQuery['shop']['primaryDomain']['url'];
    viewport: Viewport;
  }) {

    // ...code

    // if the url is internal, we strip the domain
    const url =
      item.url.includes('myshopify.com') ||
      item.url.includes(publicStoreDomain) ||
  +   item.url.includes(primaryDomainUrl)
        ? new URL(item.url).pathname
        : item.url;

     // ...code

  }
  ```

  2. Update the `FooterMenu` component to accept a `primaryDomainUrl` prop and include
     it in the internal url check

  ```diff
  // app/components/Footer.tsx

  - import type {FooterQuery} from 'storefrontapi.generated';
  + import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

  function FooterMenu({
    menu,
  +  primaryDomainUrl,
  }: {
    menu: FooterQuery['menu'];
  +  primaryDomainUrl: HeaderQuery['shop']['primaryDomain']['url'];
  }) {
    // code...

    // if the url is internal, we strip the domain
    const url =
      item.url.includes('myshopify.com') ||
      item.url.includes(publicStoreDomain) ||
  +   item.url.includes(primaryDomainUrl)
        ? new URL(item.url).pathname
        : item.url;

     // ...code

    );
  }
  ```

  3. Update the `Footer` component to accept a `shop` prop

  ```diff
  export function Footer({
    menu,
  + shop,
  }: FooterQuery & {shop: HeaderQuery['shop']}) {
    return (
      <footer className="footer">
  -      <FooterMenu menu={menu} />
  +      <FooterMenu menu={menu} primaryDomainUrl={shop.primaryDomain.url} />
      </footer>
    );
  }
  ```

  4. Update `Layout.tsx` to pass the `shop` prop

  ```diff
  export function Layout({
    cart,
    children = null,
    footer,
    header,
    isLoggedIn,
  }: LayoutProps) {
    return (
      <>
        <CartAside cart={cart} />
        <SearchAside />
        <MobileMenuAside menu={header.menu} shop={header.shop} />
        <Header header={header} cart={cart} isLoggedIn={isLoggedIn} />
        <main>{children}</main>
        <Suspense>
          <Await resolve={footer}>
  -          {(footer) => <Footer menu={footer.menu}  />}
  +          {(footer) => <Footer menu={footer.menu} shop={header.shop} />}
          </Await>
        </Suspense>
      </>
    );
  }
  ```

### Patch Changes

- If you are calling `useMatches()` in different places of your app to access the data returned by the root loader, you may want to update it to the following pattern to enhance types: ([#1289](https://github.com/Shopify/hydrogen/pull/1289)) by [@frandiox](https://github.com/frandiox)

  ```ts
  // root.tsx

  import {useMatches} from '@remix-run/react';
  import {type SerializeFrom} from '@shopify/remix-oxygen';

  export const useRootLoaderData = () => {
    const [root] = useMatches();
    return root?.data as SerializeFrom<typeof loader>;
  };

  export function loader(context) {
    // ...
  }
  ```

  This way, you can import `useRootLoaderData()` anywhere in your app and get the correct type for the data returned by the root loader.

- Updated dependencies [[`81400439`](https://github.com/Shopify/hydrogen/commit/814004397c1d17ef0a53a425ed28a42cf67765cf), [`a6f397b6`](https://github.com/Shopify/hydrogen/commit/a6f397b64dc6a0d856cb7961731ee1f86bf80292), [`3464ec04`](https://github.com/Shopify/hydrogen/commit/3464ec04a084e1ceb30ee19874dc1b9171ce2b34), [`7fc088e2`](https://github.com/Shopify/hydrogen/commit/7fc088e21bea47840788cb7c60f873ce1f253128), [`867e0b03`](https://github.com/Shopify/hydrogen/commit/867e0b033fc9eb04b7250baea97d8fd49d26ccca), [`ad45656c`](https://github.com/Shopify/hydrogen/commit/ad45656c5f663cc1a60eab5daab4da1dfd0e6cc3), [`f24e3424`](https://github.com/Shopify/hydrogen/commit/f24e3424c8e2b363b181b71fcbd3e45f696fdd3f), [`66a48573`](https://github.com/Shopify/hydrogen/commit/66a4857387148b6a104df5783314c74aca8aada0), [`0ae7cbe2`](https://github.com/Shopify/hydrogen/commit/0ae7cbe280d8351126e11dc13f35d7277d9b2d86), [`8198c1be`](https://github.com/Shopify/hydrogen/commit/8198c1befdfafb39fbcc88d71f91d21eae252973), [`ad45656c`](https://github.com/Shopify/hydrogen/commit/ad45656c5f663cc1a60eab5daab4da1dfd0e6cc3)]:
  - @shopify/hydrogen@2023.10.0
  - @shopify/remix-oxygen@2.0.0
  - @shopify/cli-hydrogen@6.0.0
