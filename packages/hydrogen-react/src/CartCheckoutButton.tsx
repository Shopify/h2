import {ReactNode, useEffect, useState} from 'react';
import {useCart} from './CartProvider.js';
import {
  BaseButton,
  type BaseButtonProps,
  type CustomBaseButtonProps,
} from './BaseButton.js';

type ChildrenProps = {
  /** A `ReactNode` element. */
  children: ReactNode;
};
type CartCheckoutButtonProps = Omit<BaseButtonProps<'button'>, 'onClick'> &
  ChildrenProps;

/**
 * The `CartCheckoutButton` component renders a button that redirects to the checkout URL for the cart.
 * It must be a descendent of a `CartProvider` component.
 */
export function CartCheckoutButton(
  props: CartCheckoutButtonProps,
): JSX.Element {
  const [requestedCheckout, setRequestedCheckout] = useState(false);
  const {status, checkoutUrl} = useCart();
  const {children, ...passthroughProps} = props;

  useEffect(() => {
    if (requestedCheckout && checkoutUrl && status === 'idle') {
      window.location.href = checkoutUrl;
    }
  }, [requestedCheckout, status, checkoutUrl]);

  return (
    <BaseButton
      {...passthroughProps}
      disabled={requestedCheckout || passthroughProps.disabled}
      onClick={(): void => setRequestedCheckout(true)}
    >
      {children}
    </BaseButton>
  );
}

// This is only for documentation purposes, and it is not used in the code.
// we ignore this issue because it makes the documentation look better than the equivalent `type` that it wants us to convert to
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CartCheckoutButtonPropsForDocs<
  AsType extends React.ElementType = 'button',
> extends Omit<CustomBaseButtonProps<AsType>, 'onClick'> {}
