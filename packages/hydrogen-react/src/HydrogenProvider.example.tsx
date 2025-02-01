import {HydrogenProvider, useShop} from '@shopify/hydrogen-react';

export default function App() {
  return (
    <HydrogenProvider countryIsoCode="CA" languageIsoCode="EN">
      <UsingUseShop />
    </HydrogenProvider>
  );
}

export function UsingUseShop() {
  const shop = useShop();

  return (
    <>
      <div>{shop.languageIsoCode}</div>
      <div>{shop.countryIsoCode}</div>
    </>
  );
}
