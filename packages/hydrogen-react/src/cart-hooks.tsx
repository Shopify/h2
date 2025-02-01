import {useState, useCallback} from 'react';
import {useShop} from './ShopifyProvider.js';
import {flattenConnection} from './flatten-connection.js';
import {CartInput, Cart as CartType} from './storefront-api-types.js';
import {CartCreate, defaultCartFragment} from './cart-queries.js';
import {Cart} from './cart-types.js';
import {
  SHOPIFY_STOREFRONT_ID_HEADER,
  SHOPIFY_STOREFRONT_Y_HEADER,
  SHOPIFY_STOREFRONT_S_HEADER,
  SHOPIFY_Y,
  SHOPIFY_S,
} from './cart-constants.js';
import type {StorefrontApiResponseOkPartial} from './storefront-api-response.types.js';
import {getShopifyCookies} from './cookies-utils.js';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useCartFetch() {
  const {storefrontId, getPublicTokenHeaders, getStorefrontApiUrl} = useShop();

  return useCallback(
    <ReturnDataGeneric,>({
      query,
      variables,
    }: {
      query: string;
      variables: Record<string, unknown>;
    }): Promise<StorefrontApiResponseOkPartial<ReturnDataGeneric>> => {
      const headers = getPublicTokenHeaders({contentType: 'json'});

      if (storefrontId) {
        headers[SHOPIFY_STOREFRONT_ID_HEADER] = storefrontId;
      }

      // Find Shopify cookies
      const cookieData = getShopifyCookies(document.cookie);
      headers[SHOPIFY_STOREFRONT_Y_HEADER] = cookieData[SHOPIFY_Y];
      headers[SHOPIFY_STOREFRONT_S_HEADER] = cookieData[SHOPIFY_S];

      return fetch(getStorefrontApiUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query.toString(),
          variables,
        }),
      })
        .then(
          (res) =>
            res.json() as StorefrontApiResponseOkPartial<ReturnDataGeneric>,
        )
        .catch((error) => {
          return {
            data: undefined,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            errors: error?.toString(),
          };
        });
    },
    [getPublicTokenHeaders, storefrontId, getStorefrontApiUrl],
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useInstantCheckout() {
  const [cart, updateCart] = useState<Cart | undefined>();
  const [checkoutUrl, updateCheckoutUrl] = useState<Cart['checkoutUrl']>();
  const [error, updateError] = useState<string | undefined>();

  const fetch = useCartFetch();

  const createInstantCheckout = useCallback(
    async (cartInput: CartInput) => {
      const {data, errors} = await fetch<{
        cartCreate: {cart: CartType};
      }>({
        query: CartCreate(defaultCartFragment),
        variables: {
          input: cartInput,
        },
      });

      if (errors) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        updateError(errors.toString());
        updateCart(undefined);
        updateCheckoutUrl(undefined);
      }

      if (data?.cartCreate?.cart) {
        const dataCart = data.cartCreate.cart;
        updateCart({
          ...dataCart,
          lines: flattenConnection(dataCart.lines),
          note: dataCart.note ?? undefined,
        });
        updateCheckoutUrl(dataCart.checkoutUrl);
      }
    },
    [fetch],
  );

  return {cart, checkoutUrl, error, createInstantCheckout};
}
