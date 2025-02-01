# How to implement Shopify cart with Remix

## 1. Make sure you have `storefront` in `context`

Whatever this integration ending up looking like but it would be the stuff in `server.ts`

## 2. Define your cart routes

```jsx
// app/routes/cart.jsx
import invariant from 'tiny-invariant';
import {json} from '@shopify/remix-oxygen';

export async function action({request, context}) {
  const {session, storefront} = context;
  const headers = new Headers();

  const [formData, storedCartId] = await Promise.all([
    request.formData(),
    session.get('cartId'),
  ]);

  let cartId = storedCartId;

  const cartAction = formData.get('cartAction');
  invariant(cartAction, 'No cartAction defined');

  let status = 200;
  let result = {};

  switch (cartAction) {
    case 'ADD_TO_CART':
      // Business logic for adding an item to cart

      // Validate form data
      const lines = formData.get('lines')
        ? JSON.parse(String(formData.get('lines')))
        : [];
      invariant(lines.length, 'No lines to add');

      // No previous cart, create and add line(s)
      if (!cartId) {
        result = await cartCreate({
          input: {lines},
          storefront,
        });
      } else {
        // Add line(s) to existing cart
        result = await cartAdd({
          cartId,
          lines,
          storefront,
        });
      }

      cartId = result.cart.id;

      break;
    default:
      invariant(false, `${cartAction} cart action is not defined`);
  }

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string' && isLocalPath(redirectTo)) {
    status = 303;
    headers.set('Location', redirectTo);
  }

  // The Cart ID may change after each mutation. We need to update it each time in the session.
  session.set('cartId', cartId);

  const {cart, errors} = result;
  return data({cart, errors}, {status, headers});
}

const USER_ERROR_FRAGMENT = `#graphql
  fragment ErrorFragment on CartUserError {
    message
    field
    code
  }
`;

const LINES_CART_FRAGMENT = `#graphql
  fragment CartLinesFragment on Cart {
    id
    totalQuantity
  }
`;

const CREATE_CART_MUTATION = `#graphql
  mutation ($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ...CartLinesFragment
      }
      errors: userErrors {
        ...ErrorFragment
      }
    }
  }
  ${LINES_CART_FRAGMENT}
  ${USER_ERROR_FRAGMENT}
`;

export async function cartCreate({input, storefront}) {
  const {cartCreate} = await storefront.mutate(CREATE_CART_MUTATION, {
    variables: {input},
  });

  invariant(cartCreate, 'No data returned from cartCreate mutation');

  return cartCreate;
}

const ADD_LINES_MUTATION = `#graphql
  mutation ($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartLinesFragment
      }
      errors: userErrors {
        ...ErrorFragment
      }
    }
  }
  ${LINES_CART_FRAGMENT}
  ${USER_ERROR_FRAGMENT}
`;

export async function cartAdd({cartId, lines, storefront}) {
  const {cartLinesAdd} = await storefront.mutate(ADD_LINES_MUTATION, {
    variables: {cartId, lines},
  });

  invariant(cartLinesAdd, 'No data returned from cartLinesAdd mutation');

  return cartLinesAdd;
}
```

## 3. Make a form request to your cart action

```jsx
import {useFetcher} from '@remix-run/react';
import {flattenConnection} from '@shopify/hydrogen-react';

export function ProductCard({product}) {
  const firstVariant = flattenConnection(product?.variants)[0];

  return (
    <div>
      <h2>{product.title}</h2>
      <AddToCartButton
        lines={[
          {
            quantity: 1,
            merchandiseId: firstVariant.id,
          },
        ]}
      />
    </div>
  );
}

function AddToCartButton({lines}) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form action="/cart" method="post">
      <input type="hidden" name="cartAction" value="ADD_TO_CART" />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <button type="submit">Add to Bag</button>
    </fetcher.Form>
  );
}
```

If you want to accept other form data, for example `cartNote`, update your
action and form for the new input.

```jsx
// app/routes/cart.jsx
switch (cartAction) {
  case 'ADD_TO_CART':
    ...

    const note = formData.get('cartNote') || null;

    if (!cartId) {
      result = await cartCreate({
        input: {lines, note},
        storefront,
      });
```

```jsx
// Add to cart form
<fetcher.Form action="/cart" method="post">
  <input type="hidden" name="cartAction" value="ADD_TO_CART" />
  <input type="hidden" name="lines" value={JSON.stringify(lines)} />
  <input type="hidden" name="cartNote" value={cartNotes} />
  <button type="submit">Add to Bag</button>
</fetcher.Form>
```

## 4. Open cart drawer on add to cart action

We can use `useFetchers` to know when a cart operation happens by
looking for a form request with form data named `cartAction`.

```jsx
import {useFetchers} from '@remix-run/react';

export function useCartFetchers(actionName) {
  const fetchers = useFetchers();
  const cartFetchers = [];

  for (const fetcher of fetchers) {
    const formData = fetcher.submission?.formData;
    if (formData && formData.get('cartAction') === actionName) {
      cartFetchers.push(fetcher);
    }
  }
  return cartFetchers;
}
```

Anywhere in the app, you can target these cart specific requests.

```jsx
// app/components/Layout.jsx

function Header({title, menu}) {
  const {
    isOpen: isCartOpen,
    openDrawer: openCart,
    closeDrawer: closeCart,
  } = useDrawer();

  // Detect any add to cart form request
  const addToCartFetchers = useCartFetchers('ADD_TO_CART');

  // toggle cart drawer when adding to cart
  useEffect(() => {
    if (isCartOpen || !addToCartFetchers.length) return;
    openCart();
  }, [addToCartFetchers, isCartOpen, openCart]);
```

## 5. Adding optimistic UI

Optimistic UI gives an immediate feedback to your visitors while the cart form request is in-flight.

```jsx
function AddToCartButton({lines}) {
  const fetcher = useFetcher();

  // Create an unique id for our form
  const eventId = useId();
  const eventIdFetchers = useEventIdFetchers(eventId);
  const isAdding = !!eventIdFetchers.length;

  return (
    <fetcher.Form action="/cart" method="post">
      <input type="hidden" name="cartAction" value="ADD_TO_CART" />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <button type="submit" disabled={isAdding}>
        {isAdding ? 'Adding ...' : 'Add to Bag'}
      </button>
    </fetcher.Form>
  );
}
```

Just like how we use `useFetchers` to know a cart operation has occurred.
We can do the same to search for the exact form that initiated the form request.

```jsx
export function useEventIdFetchers(eventId) {
  const fetchers = useFetchers();
  const cartFetchers = [];

  for (const fetcher of fetchers) {
    const formData = fetcher.submission?.formData;
    if (formData && formData.get('eventId') === eventId) {
      cartFetchers.push(fetcher);
    }
  }
  return cartFetchers;
}
```
