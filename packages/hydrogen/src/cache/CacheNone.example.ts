import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {CacheNone} from '@shopify/hydrogen';

export async function loader({context}: LoaderFunctionArgs) {
  const data = await context.storefront.query(
    `#grahpql
  {
    shop {
      name
      description
    }
  }`,
    {
      cache: CacheNone(),
    },
  );

  return data;
}
