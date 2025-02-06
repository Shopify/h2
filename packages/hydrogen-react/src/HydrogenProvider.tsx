import {createContext, ReactNode, useContext} from 'react';
import {CountryCode, LanguageCode} from './storefront-api-types.js';

export type HydrogenContextValue = {
  /**
   * The code designating a country, which generally follows ISO 3166-1 alpha-2 guidelines. If a territory doesn't have a country code value in the `CountryCode` enum, it might be considered a subdivision of another country. For example, the territories associated with Spain are represented by the country code `ES`, and the territories associated with the United States of America are represented by the country code `US`.
   */
  countryIsoCode: CountryCode | null;
  /**
   * `ISO 369` language codes supported by Shopify.
   */
  languageIsoCode: LanguageCode | null;
};

const defaultHydrogenContext: HydrogenContextValue = {
  languageIsoCode: null,
  countryIsoCode: null,
};

const HydrogenContext = createContext<HydrogenContextValue>(
  defaultHydrogenContext,
);

export interface HydrogenProviderProps extends HydrogenContextValue {
  children: ReactNode;
}

/**
 * The `<HydrogenProvider/>` component enables use of the `useShop()` hook. The component should wrap your Hydrogen app.
 */
export function HydrogenProvider({
  children,
  ...hydrogenConfig
}: HydrogenProviderProps): JSX.Element {
  return (
    <HydrogenContext.Provider value={hydrogenConfig}>
      {children}
    </HydrogenContext.Provider>
  );
}

export function useHydrogenContext(): HydrogenContextValue {
  return useContext(HydrogenContext);
}
