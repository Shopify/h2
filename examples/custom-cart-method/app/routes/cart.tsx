import {Await, type MetaFunction, useRouteLoaderData} from '@remix-run/react';
import {Suspense} from 'react';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';
import type {
  SelectedOptionInput,
  CartLineUpdateInput,
} from '@shopify/hydrogen/storefront-api-types';
import {CartMain} from '~/components/Cart';
import type {RootLoader} from '~/root';

export const meta: MetaFunction = () => {
  return [{title: `Hydrogen | Cart`}];
};

export async function action({request, context}: ActionFunctionArgs) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result: CartQueryDataReturn;

  switch (action) {
    /***********************************************/
    /**********  EXAMPLE UPDATE STARTS  ************/
    case 'CustomUpdateLineByOptions':
      const {productId, line, ...selectedOptionsPairs} = inputs;

      const selectedOptions = [];
      for (const [name, value] of Object.entries(selectedOptionsPairs)) {
        selectedOptions.push({name, value});
      }

      result = await cart.updateLineByOptions(
        productId as string,
        selectedOptions as SelectedOptionInput[],
        line as CartLineUpdateInput,
      );
      break;
    /**********   EXAMPLE UPDATE END   ************/
    /***********************************************/
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = (
        formDiscountCode ? [formDiscountCode] : []
      ) as string[];

      // Combine giftcard codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesUpdate: {
      const formGiftCardCode = inputs.giftCardCode;

      // User inputted gift card code
      const giftCardCodes = (
        formGiftCardCode ? [formGiftCardCode] : []
      ) as string[];

      // Combine giftcard codes already applied on cart
      giftCardCodes.push(...inputs.giftCardCodes);

      result = await cart.updateGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors} = result;

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return json(
    {
      cart: cartResult,
      errors,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

export default function Cart() {
  const rootData = useRouteLoaderData<RootLoader>('root');
  if (!rootData) return null;

  return (
    <div className="cart">
      <h1>Cart</h1>
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await
          resolve={rootData.cart}
          errorElement={<div>An error occurred</div>}
        >
          {(cart) => {
            return <CartMain layout="page" cart={cart} />;
          }}
        </Await>
      </Suspense>
    </div>
  );
}
