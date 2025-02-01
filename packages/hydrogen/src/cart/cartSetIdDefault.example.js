import {data} from '@remix-run/server-runtime';
import {cartGetIdDefault, cartSetIdDefault} from '@shopify/hydrogen';

// server.js
export default {
  async fetch(request) {
    const cart = createCartHandler({
      storefront,
      getCartId: cartGetIdDefault(request.headers),
      setCartId: cartSetIdDefault(), // defaults to session cookie
      // setCartId: cartSetIdDefault({maxage: 60 * 60 * 24 * 365}), // 1 year expiry
    });
  },
};

// Some route
export async function action({context}) {
  const {cart} = context;

  // Usage
  const result = await cart.updateNote('Some note');

  const headers = cart.setCartId(result.cart.id);

  return data(result, {headers});
}
