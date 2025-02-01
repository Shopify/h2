import {useLoaderData} from '@remix-run/react';
import {LoaderFunctionArgs} from '@remix-run/server-runtime';
import {useOptimisticVariant} from '@shopify/hydrogen';

export async function loader({context}: LoaderFunctionArgs) {
  return {
    product: await context.storefront.query('/** product query */'),
    // Note that variants does not need to be awaited to be used by `useOptimisticVariant`
    variants: context.storefront.query('/** variants query */'),
  };
}

function Product() {
  const {product, variants} = useLoaderData<typeof loader>();

  // The selectedVariant optimistically changes during page
  // transitions with one of the preloaded product variants
  const selectedVariant = useOptimisticVariant(
    product.selectedVariant,
    variants,
  );

  // @ts-ignore
  return <ProductMain selectedVariant={selectedVariant} />;
}
