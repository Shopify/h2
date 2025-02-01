import {Pagination, getPaginationVariables} from '@shopify/hydrogen';
import {useLoaderData, Link} from '@remix-run/react';

export async function loader({request, context: {storefront}}) {
  const variables = getPaginationVariables(request, {pageBy: 8});

  const data = await storefront.query(ALL_PRODUCTS_QUERY, {
    variables,
  });

  return {products: data.products};
}

export default function List() {
  const {products} = useLoaderData();

  return (
    <Pagination connection={products}>
      {({nodes, PreviousLink, NextLink}) => (
        <>
          <PreviousLink>Previous</PreviousLink>
          <div>
            {nodes.map((product) => (
              <Link key={product.id} to={`/products/${product.handle}`}>
                {product.title}
              </Link>
            ))}
          </div>
          <NextLink>Next</NextLink>
        </>
      )}
    </Pagination>
  );
}

const ALL_PRODUCTS_QUERY = `#graphql
  query AllProducts(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes { id
        title
        handle
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
`;
