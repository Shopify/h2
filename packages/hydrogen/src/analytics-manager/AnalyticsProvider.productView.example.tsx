import {useLoaderData} from '@remix-run/react';
import {Analytics} from '@shopify/hydrogen';

export async function loader() {
  return {
    product: {
      id: '123',
      title: 'ABC',
      vendor: 'abc',
      selectedVariant: {
        id: '456',
        title: 'DEF',
        price: {
          amount: '100',
        },
      },
    },
  };
}

export default function Product() {
  const {product} = useLoaderData<typeof loader>();
  const {selectedVariant} = product;

  return (
    <div className="product">
      <h1>{product.title}</h1>
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
