import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Link} from '@remix-run/react';
import {CartForm, useOptimisticCart} from '@shopify/hydrogen';
import type {Cart} from '@shopify/hydrogen/storefront-api-types';

// Root loader returns the cart data
export async function loader({context}: LoaderFunctionArgs) {
  return {
    cart: context.cart.get(),
  };
}

// The cart component renders each line item in the cart.
export function Cart({cart: originalCart}: {cart: Cart}) {
  // `useOptimisticCart` adds optimistic line items to the cart.
  // These line items are displayed in the cart until the server responds.
  const cart = useOptimisticCart(originalCart);
  if (!cart?.lines?.nodes?.length) return <p>Nothing in cart</p>;

  return cart.lines.nodes.map((line) => (
    <div key={line.id}>
      <Link to={`/products${line.merchandise.product.handle}`}>
        {line.merchandise.product.title}
      </Link>
      <CartForm
        route="/cart"
        action={CartForm.ACTIONS.LinesRemove}
        inputs={{lineIds: [line.id]}}
      >
        {/* Each line item has an `isOptimistic` property. Optimistic line items
        should have actions disabled */}
        <button type="submit" disabled={!!line.isOptimistic}>
          Remove
        </button>
      </CartForm>
    </div>
  ));
}
