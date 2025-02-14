import {Await, useMatches} from '@remix-run/react';
import {Suspense} from 'react';
import {type CartQueryData, CartForm} from '@shopify/hydrogen';
import {
  type ActionArgs,
  type V2_MetaFunction,
  json,
} from '@shopify/remix-oxygen';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {CartMain} from '~/components/Cart';
import {useTranslation} from '~/i18n';

export const meta: V2_MetaFunction = () => {
  return [{title: `Hydrogen | Cart`}];
};

export async function action({request, context}: ActionArgs) {
  const {session, cart} = context;

  const [formData, customerAccessToken] = await Promise.all([
    request.formData(),
    session.get('customerAccessToken'),
  ]);

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result: CartQueryData;

  switch (action) {
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

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      const accessToken = customerAccessToken?.accessToken ?? null;
      const input = inputs.buyerIdentity;

      if (accessToken) {
        input.customerAccessToken = accessToken;
      }

      result = await cart.updateBuyerIdentity(input);
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const {cart: cartResult, errors} = result;

  if (errors && errors?.length > 0) {
    return json({
      cart: cartResult,
      errors,
    });
  }
  const cartId = result.cart.id;
  const headers = cart.setCartId(result.cart.id);

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
  const {t} = useTranslation();
  const [root] = useMatches();
  const cart = root.data?.cart as Promise<CartApiQueryFragment | null>;

  return (
    <div className="cart">
      <h1>{t('layout.cart.title')}</h1>
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await errorElement={<div>An error occurred</div>} resolve={cart}>
          {(cart) => {
            return <CartMain layout="page" cart={cart} />;
          }}
        </Await>
      </Suspense>
    </div>
  );
}
