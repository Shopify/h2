import {CartForm} from '@shopify/hydrogen';
import {useEffect} from 'react';
import {useFetcher} from '@remix-run/react';
import getUnicodeFlagIcon from 'country-flag-icons/unicode';
import type {I18nSelector} from '~/components/LocaleSelector';
import {type I18n, localizePath, navigateToLocale} from '~/i18n';
import {subfolderLocaleParser} from '~/utils';

export function CountrySelector({
  i18n,
  localizations,
  selectedLocale,
}: I18nSelector) {
  const fetcher = useFetcher();
  const buyerIdentityCountry = fetcher.data?.cart?.buyerIdentity?.countryCode;

  /**
   * Update the cart's buyer identity with the new country code.
   */
  function updateCartBuyerIdentity() {
    const form = new FormData();
    const variables = {
      action: CartForm.ACTIONS.BuyerIdentityUpdate,
      inputs: {
        buyerIdentity: {
          countryCode: selectedLocale.current.country.code.toUpperCase(),
        },
        redirectTo: localizePath('/cart', selectedLocale.current),
      },
    };
    form.append('cartFormInput', JSON.stringify(variables));

    // update the country code in the cart's buyer identity
    fetcher.submit(form, {
      method: 'POST',
      action: localizePath('/cart', selectedLocale.current),
    });
  }

  // Navigate to the selected locale once the cart's buyer identity has been updated
  useEffect(() => {
    const updatedBuyerIdentity =
      buyerIdentityCountry ===
      selectedLocale.current.country.code.toUpperCase();

    if (!updatedBuyerIdentity) {
      return;
    }

    navigateToLocale(selectedLocale.current);
  }, [fetcher, selectedLocale, buyerIdentityCountry]);

  return (
    <div style={{marginLeft: '1rem', display: 'flex', gap: '.5rem'}}>
      <select
        name="localizations"
        onChange={(event) => {
          try {
            const selected = JSON.parse(event.target.value) as I18n;

            const prefix = subfolderLocaleParser({
              country: selected.country.code,
              language: selected.language.code,
            });

            selectedLocale.current = {...selected, prefix};

            // already on the selected locale
            if (selectedLocale.current.country === i18n.country) {
              return;
            }

            updateCartBuyerIdentity();
          } catch (error) {
            console.error(error);
          }
        }}
        style={{minWidth: 160}}
        value={JSON.stringify({
          isDefault: Boolean(i18n.isDefault),
          language: {
            code: i18n.language.code,
          },
          country: {
            code: i18n.country.code,
          },
        })}
      >
        {localizations &&
          localizations.map((country) => {
            const languageCode =
              country.languages.find((language) => {
                return language.code === i18n.language.code;
              })?.code ?? country.languages[0].code;

            return (
              <option
                key={country.code}
                value={JSON.stringify({
                  isDefault: Boolean(country?.isDefault),
                  language: {
                    code: languageCode,
                  },
                  country: {
                    code: country.code,
                  },
                })}
              >
                {getUnicodeFlagIcon(country.code)}
                &nbsp;
                {country.name}
              </option>
            );
          })}
      </select>
    </div>
  );
}
