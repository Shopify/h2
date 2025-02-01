import {type ActionFunctionArgs, data} from '@remix-run/server-runtime';
import {
  type CartQueryDataReturn,
  type HydrogenCart,
  CartForm,
} from '@shopify/hydrogen';
import {type CartLineInput} from '@shopify/hydrogen-react/storefront-api-types';
import invariant from 'tiny-invariant';

export default function Cart() {
  return (
    <CartForm
      action="CustomEditInPlace"
      inputs={{
        addLines: [
          {
            merchandiseId: 'gid://shopify/Product/123456789',
            quantity: 1,
          },
        ],
        removeLines: ['gid://shopify/CartLine/123456789'],
      }}
    >
      <button>Green color swatch</button>
    </CartForm>
  );
}

export async function action({request, context}: ActionFunctionArgs) {
  const cart = context.cart as HydrogenCart;
  // cart is type HydrogenCart or HydrogenCartCustom
  // Declare cart type in remix.env.d.ts for interface AppLoadContext to avoid type casting
  // const {cart} = context;

  const formData = await request.formData();
  const {action, inputs} = CartForm.getFormInput(formData);

  let status = 200;
  let result: CartQueryDataReturn;

  if (action === 'CustomEditInPlace') {
    result = await cart.addLines(inputs.addLines as CartLineInput[]);
    result = await cart.removeLines(inputs.removeLines as string[]);
  } else {
    invariant(false, `${action} cart action is not defined`);
  }

  const headers = cart.setCartId(result.cart.id);

  return data(result, {status, headers});
}
