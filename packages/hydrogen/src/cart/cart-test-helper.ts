import {CachingStrategy, CacheNone} from '../cache/strategies';
import type {ExecutionArgs} from 'graphql';
import {Storefront} from '../storefront';
import {CustomerAccount} from '../customer/types';

export const BUYER_ACCESS_TOKEN = 'sha123';
export const BUYER_LOCATION_ID = 'gid://shopify/CompanyLocation/1';
export const CART_ID = 'gid://shopify/Cart/c1-123';
export const NEW_CART_ID = 'c1-new-cart-id';
export const CHECKOUT_URL =
  'https://demostore.mock.shop/cart/c/Z2NwLXVzLWNlbnRyYWwxOjAxSE5aSFBWVjhKSEc5NDA5MTlWM0ZTUVJE?key=66f3266a23df83f84f2aee087ec244b2';

function storefrontQuery(
  query: string,
  payload?: {
    variables?: ExecutionArgs['variableValues'];
    cache?: CachingStrategy;
  },
) {
  return Promise.resolve({
    cart: {
      id: payload?.variables?.cartId,
      checkoutUrl: CHECKOUT_URL,
      query,
    },
  });
}

function storefrontMutate(
  query: string,
  payload?: {
    variables?: ExecutionArgs['variableValues'];
  },
) {
  let cartId = payload?.variables?.cartId as string;
  const keyWrapper: string =
    String(query.match(/mutation\s+([^\(\s]+)/i)?.[1]) || 'error';

  if (keyWrapper === 'cartCreate') {
    cartId = 'c1-new-cart-id';
  }

  if (
    keyWrapper === 'cartMetafieldsSet' ||
    keyWrapper === 'cartMetafieldDelete'
  ) {
    return Promise.resolve({
      [keyWrapper]: {
        userErrors: [query],
      },
    });
  } else {
    return Promise.resolve({
      [keyWrapper]: {
        cart: {
          id: cartId,
        },
        userErrors: [query],
      },
    });
  }
}

export function mockHeaders(cartId?: string) {
  return new Headers({
    Cookie: cartId ? `cart=${cartId}` : '',
  });
}

export function mockCreateStorefrontClient() {
  return {
    query: storefrontQuery,
    mutate: storefrontMutate,
    CacheNone,
  } as Storefront;
}

export function mockGetBuyer() {
  return Promise.resolve({
    customerAccessToken: BUYER_ACCESS_TOKEN,
    companyLocationId: BUYER_LOCATION_ID,
  });
}

export function mockCreateCustomerAccountClient() {
  return {
    UNSTABLE_getBuyer: mockGetBuyer,
    isLoggedIn: () => Promise.resolve(true),
  } as CustomerAccount;
}
