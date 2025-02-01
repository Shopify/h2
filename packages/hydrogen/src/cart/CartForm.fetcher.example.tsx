import {useFetcher} from '@remix-run/react';
import {type ActionFunctionArgs, data} from '@remix-run/server-runtime';
import {
  type CartQueryDataReturn,
  type HydrogenCart,
  CartForm,
  type CartActionInput,
} from '@shopify/hydrogen';
import invariant from 'tiny-invariant';
import type {Cart} from '@shopify/hydrogen/storefront-api-types';

export function ThisIsGift({metafield}: {metafield: Cart['metafield']}) {
  const fetcher = useFetcher();

  const buildFormInput: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => CartActionInput = (event) => ({
    action: CartForm.ACTIONS.MetafieldsSet,
    inputs: {
      metafields: [
        {
          key: 'custom.gift',
          type: 'boolean',
          value: event.target.checked.toString(),
        },
      ],
    },
  });

  return (
    <div>
      <input
        checked={metafield?.value === 'true'}
        type="checkbox"
        id="isGift"
        onChange={(event) => {
          fetcher.submit(
            {
              [CartForm.INPUT_NAME]: JSON.stringify(buildFormInput(event)),
            },
            {method: 'POST', action: '/cart'},
          );
        }}
      />
      <label htmlFor="isGift">This is a gift</label>
    </div>
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

  if (action === CartForm.ACTIONS.MetafieldsSet) {
    result = await cart.setMetafields(inputs.metafields);
  } else {
    invariant(false, `${action} cart action is not defined`);
  }

  const headers = cart.setCartId(result.cart.id);

  return data(result, {status, headers});
}
