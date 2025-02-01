import {Link} from '@remix-run/react';
import {CartForm, useOptimisticCart} from '@shopify/hydrogen';

// Root loader returns the cart data
export async function loader({context}) {
  return {
    cart: context.cart.get(),
  };
}

// The cart component renders each line item in the cart.
export function Cart({cart}) {
  // `useOptimisticCart` adds optimistic line items to the cart.
  // These line items are displayed in the cart until the server responds.
  const optimisticCart = useOptimisticCart(cart);

  if (!optimisticCart?.lines?.nodes?.length) return <p>Nothing in cart</p>;

  return optimisticCart.lines.nodes.map((line) => (
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
