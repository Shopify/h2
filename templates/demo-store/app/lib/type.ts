import {
  CountryCode,
  LanguageCode,
} from '@shopify/hydrogen-react/storefront-api-types';

export type Locale = {
  label?: string;
  language: LanguageCode;
  country: CountryCode;
};

export type Localizations = Record<string, Locale>;

export enum CartAction {
  ADD_TO_CART = 'ADD_TO_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  UPDATE_CART = 'UPDATE_CART',
  UPDATE_DISCOUNT = 'UPDATE_DISCOUNT',
  UPDATE_BUYER_IDENTITY = 'UPDATE_BUYER_IDENTITY',
  ENSURE_NOT_EVICTED = 'ENSURE_NOT_EVICTED',
}
export type CartActions = keyof typeof CartAction;
