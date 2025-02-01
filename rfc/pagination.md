# Pagination

Pagination is a complex component, that becomes even more complex for online storefronts. The goal of our Pagination component should be to take on the undifferentiated difficult parts of paginating a Storefront APO collection in Hydrogen projects. This includes:

- Caching already loaded items
- Dealing with cursors
- Drop-in bi-directional infinite loading
- Traditional load more or prev/next UI
- Consistent scroll position after navigations
- Support permalinks to a given slice of items
- Easy turn-key DX

## Usage

## Create route

Add a `/products` route is you don't already have one.

```bash
touch routes/products.tsx
```

## Fetch a Storefront connection in the loader

Add a loader and query for the products in the shop. This is what a typical loader might look like without pagination applied.

```tsx
export async function loader({context, request}: LoaderArgs) {
  const {products} = await context.storefront.query<{
    products: ProductConnection;
  }>(PRODUCTS_QUERY, {
    variables: {
      country: context.storefront.i18n?.country,
      language: context.storefront.i18n?.language,
    },
  });

  if (!products) {
    throw new Response(null, {status: 404});
  }

  return {products};
}
```

And a sample query:

```tsx
const PRODUCTS_QUERY = `#graphql
  query (
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products() {
      nodes {
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
          }
        }
      }
    }
  }
`;
```

### Add the pagination variables to the query

First import and use a helper `getPaginationVariables(request: Request)` to build the pagination variables from the request object. We spread those values into the query, and also need to add those variables to the query along with the associated fragment.

```diff
+  import {getPaginationVariables, PAGINATION_PAGE_INFO_FRAGMENT} from '~/components';

export async function loader({context, request}: LoaderArgs) {
  const variables = getPaginationVariables(request, 4);
  const {products} = await context.storefront.query<{
    products: ProductConnection;
  }>(PRODUCTS_QUERY, {
    variables: {
+     ...variables,
      country: context.storefront.i18n?.country,
      language: context.storefront.i18n?.language,
    },
  });

  if (!products) {
    throw new Response(null, {status: 404});
  }

  return {products};
}
```

And a add the fragment and variables to the query:

```diff
const PRODUCTS_QUERY = `#graphql
+ ${PAGINATION_PAGE_INFO_FRAGMENT}
  query (
    $country: CountryCode
    $language: LanguageCode
+   $first: Int
+   $last: Int
+   $startCursor: String
+   $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(
+     first: $first,
+     last: $last,
+     before: $startCursor,
+     after: $endCursor
    ) {
      nodes {
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
          }
        }
      }
+     pageInfo {
+       ...PaginationPageInfoFragment
+     }
    }
  }
`;
```

### Render the `<Pagination />` component

In the default export, we can start to build our UI. This starts with rendering the `<Pagination >` component and passing the `products` loader data to the `connection` prop. The other prop this component takes is a boolean called `autoLoadOnScroll` that toggles infinite scrolling.

```tsx
export default function Products() {
  const {products} = useLoaderData<typeof loader>();

  return (
    <>
      <Pagination connection={products} autoLoadOnScroll />
    </>
  );
}
```

Next we can expand the render prop to build our grid and navigation elements. We receive a number of helpful bits of information in the render prop that we can use to build the interface we want.

To enable the state-based cache, we pass the variables along to the Link component's state. This may be something we want to abstract away, but wanted to leave these guts-out for now.

```tsx
export default function Products() {
  const {products} = useLoaderData<typeof loader>();

  return (
    <>
      <Pagination connection={products} autoLoadOnScroll>
        {({
          endCursor,
          hasNextPage,
          hasPreviousPage,
          nextPageUrl,
          nodes,
          prevPageUrl,
          startCursor,
          nextLinkRef,
          isLoading,
        }) => {
          const itemsMarkup = nodes.map((product, i) => (
            <Link to={`/products/${product.handle}`} key={product.id}>
              {product.title}
            </Link>
          ));

          return (
            <>
              {hasPreviousPage && (
                <Link
                  preventScrollReset={true}
                  to={prevPageUrl}
                  prefetch="intent"
                  state={{
                    pageInfo: {
                      endCursor,
                      hasNextPage,
                      startCursor,
                      hasPreviousPage: undefined,
                    },
                    nodes,
                  }}
                >
                  {isLoading ? 'Loading...' : 'Previous'}
                </Link>
              )}
              {itemsMarkup}
              {hasNextPage && (
                <Link
                  preventScrollReset={true}
                  ref={nextLinkRef}
                  to={nextPageUrl}
                  prefetch="intent"
                  state={{
                    pageInfo: {
                      endCursor,
                      hasPreviousPage,
                      hasNextPage: undefined,
                      startCursor,
                    },
                    nodes,
                  }}
                >
                  {isLoading ? 'Loading...' : 'Next'}
                </Link>
              )}
            </>
          );
        }}
      </Pagination>
    </>
  );
}
```

## Conclusion

And that's it! You should now have a working pagination with all goals we outlined above.
