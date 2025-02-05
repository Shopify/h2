import {StorefrontApiErrors, formatAPIResult} from '../../storefront';
import {
  CART_WARNING_FRAGMENT,
  MINIMAL_CART_FRAGMENT,
  USER_ERROR_FRAGMENT,
} from './cart-fragments';
import type {
  CartOptionalInput,
  CartQueryData,
  CartQueryDataReturn,
  CartQueryOptions,
} from './cart-types';

export type CartGiftCardCodesRemoveFunction = (
  appliedGiftCardIds: string[],
  optionalParams?: CartOptionalInput,
) => Promise<CartQueryDataReturn>;

export function cartGiftCardCodesRemoveDefault(
  options: CartQueryOptions,
): CartGiftCardCodesRemoveFunction {
  return async (appliedGiftCardIds, optionalParams) => {
    const {cartGiftCardCodesRemove, errors} = await options.storefront.mutate<{
      cartGiftCardCodesRemove: CartQueryData;
      errors: StorefrontApiErrors;
    }>(CART_GIFT_CARD_CODE_REMOVE_MUTATION(options.cartFragment), {
      variables: {
        cartId: options.getCartId(),
        appliedGiftCardIds: appliedGiftCardIds,
        ...optionalParams,
      },
    });
    return formatAPIResult(cartGiftCardCodesRemove, errors);
  };
}

//! @see https://shopify.dev/docs/api/storefront/latest/mutations/cartGiftCardCodesRemove
export const CART_GIFT_CARD_CODE_REMOVE_MUTATION = (
  cartFragment = MINIMAL_CART_FRAGMENT,
) => `#graphql
  mutation cartGiftCardCodesRemove(
    $cartId: ID!
    $appliedGiftCardIds: [ID!]!
    $language: LanguageCode
    $country: CountryCode
  ) @inContext(country: $country, language: $language) {
    cartGiftCardCodesRemove(cartId: $cartId, appliedGiftCardIds: $appliedGiftCardIds) {
      cart {
        ...CartApiMutation
      }
      userErrors {
        ...CartApiError
      }
      warnings {
        ...CartApiWarning
      }
    }
  }
  ${cartFragment}
  ${USER_ERROR_FRAGMENT}
  ${CART_WARNING_FRAGMENT}
`;
