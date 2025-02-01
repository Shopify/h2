import {useFetcher} from '@remix-run/react';
import {data} from '@remix-run/server-runtime';
import {CartForm} from '@shopify/hydrogen';
import invariant from 'tiny-invariant';

export function ThisIsGift({metafield}) {
  const fetcher = useFetcher();

  const buildFormInput = (event) => ({
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

export async function action({request, context}) {
  const {cart} = context;

  const formData = await request.formData();
  const {action, inputs} = CartForm.getFormInput(formData);

  let status = 200;
  let result;

  if (action === CartForm.ACTIONS.MetafieldsSet) {
    result = await cart.setMetafields(inputs.metafields);
  } else {
    invariant(false, `${action} cart action is not defined`);
  }

  const headers = cart.setCartId(result.cart.id);

  return data(result, {status, headers});
}
