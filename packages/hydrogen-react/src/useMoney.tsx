import {useMemo} from 'react';
import {useShop} from './ShopifyProvider.js';
import {CurrencyCode, MoneyV2} from './storefront-api-types.js';

export type UseMoneyValue = {
  /**
   * The currency code from the `MoneyV2` object.
   */
  currencyCode: CurrencyCode;
  /**
   * The name for the currency code, returned by `Intl.NumberFormat`.
   */
  currencyName?: string;
  /**
   * The currency symbol returned by `Intl.NumberFormat`.
   */
  currencySymbol?: string;
  /**
   * The currency narrow symbol returned by `Intl.NumberFormat`.
   */
  currencyNarrowSymbol?: string;
  /**
   * The localized amount, without any currency symbols or non-number types from the `Intl.NumberFormat.formatToParts` parts.
   */
  amount: string;
  /**
   * All parts returned by `Intl.NumberFormat.formatToParts`.
   */
  parts: Intl.NumberFormatPart[];
  /**
   * A string returned by `new Intl.NumberFormat` for the amount and currency code,
   * using the `locale` value in the [`LocalizationProvider` component](https://shopify.dev/api/hydrogen/components/localization/localizationprovider).
   */
  localizedString: string;
  /**
   * The `MoneyV2` object provided as an argument to the hook.
   */
  original: MoneyV2;
  /**
   * A string with trailing zeros removed from the fractional part, if any exist. If there are no trailing zeros, then the fractional part remains.
   * For example, `$640.00` turns into `$640`.
   * `$640.42` remains `$640.42`.
   */
  withoutTrailingZeros: string;
  /**
   * A string without currency and without trailing zeros removed from the fractional part, if any exist. If there are no trailing zeros, then the fractional part remains.
   * For example, `$640.00` turns into `640`.
   * `$640.42` turns into `640.42`.
   */
  withoutTrailingZerosAndCurrency: string;
};

/**
 * The `useMoney` hook takes a [MoneyV2 object](https://shopify.dev/api/storefront/reference/common-objects/moneyv2) and returns a
 * default-formatted string of the amount with the correct currency indicator, along with some of the parts provided by
 * [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat).
 * Uses `locale` from `ShopifyProvider`
 * &nbsp;
 * @see {@link https://shopify.dev/api/hydrogen/hooks/usemoney}
 * @example initialize the money object
 * ```ts
 * const money = useMoney({
 *   amount: '100.00',
 *   currencyCode: 'USD'
 * })
 * ```
 * &nbsp;
 *
 * @example basic usage, outputs: $100.00
 * ```ts
 * money.localizedString
 * ```
 * &nbsp;
 *
 * @example without currency, outputs: 100.00
 * ```ts
 * money.amount
 * ```
 * &nbsp;
 *
 * @example without trailing zeros, outputs: $100
 * ```ts
 * money.withoutTrailingZeros
 * ```
 * &nbsp;
 *
 * @example currency name, outputs: US dollars
 * ```ts
 * money.currencyCode
 * ```
 * &nbsp;
 *
 * @example currency symbol, outputs: $
 * ```ts
 * money.currencySymbol
 * ```
 * &nbsp;
 *
 * @example without currency and without trailing zeros, outputs: 100
 * ```ts
 * money.withoutTrailingZerosAndCurrency
 * ```
 */
export function useMoney(money: MoneyV2): UseMoneyValue {
  const {countryIsoCode, languageIsoCode} = useShop();
  const locale = languageIsoCode.includes('_')
    ? languageIsoCode.replace('_', '-')
    : `${languageIsoCode}-${countryIsoCode}`;

  if (!locale) {
    throw new Error(
      `useMoney(): Unable to get 'locale' from 'useShop()', which means that 'locale' was not passed to '<ShopifyProvider/>'. 'locale' is required for 'useMoney()' to work`,
    );
  }

  const amount = parseFloat(money.amount);

  const {
    defaultFormatter,
    nameFormatter,
    narrowSymbolFormatter,
    withoutTrailingZerosFormatter,
    withoutCurrencyFormatter,
    withoutTrailingZerosOrCurrencyFormatter,
  } = useMemo(() => {
    const options = {
      style: 'currency' as const,
      currency: money.currencyCode,
    };

    return {
      defaultFormatter: getLazyFormatter(locale, options),
      nameFormatter: getLazyFormatter(locale, {
        ...options,
        currencyDisplay: 'name',
      }),
      narrowSymbolFormatter: getLazyFormatter(locale, {
        ...options,
        currencyDisplay: 'narrowSymbol',
      }),
      withoutTrailingZerosFormatter: getLazyFormatter(locale, {
        ...options,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
      withoutCurrencyFormatter: getLazyFormatter(locale),
      withoutTrailingZerosOrCurrencyFormatter: getLazyFormatter(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    };
  }, [money.currencyCode, locale]);

  const isPartCurrency = (part: Intl.NumberFormatPart): boolean =>
    part.type === 'currency';

  // By wrapping these properties in functions, we only
  // create formatters if they are going to be used.
  const lazyFormatters = useMemo(
    () => ({
      original: (): MoneyV2 => money,
      currencyCode: (): CurrencyCode => money.currencyCode,

      localizedString: (): string => defaultFormatter().format(amount),

      parts: (): Intl.NumberFormatPart[] =>
        defaultFormatter().formatToParts(amount),

      withoutTrailingZeros: (): string =>
        amount % 1 === 0
          ? withoutTrailingZerosFormatter().format(amount)
          : defaultFormatter().format(amount),

      withoutTrailingZerosAndCurrency: (): string =>
        amount % 1 === 0
          ? withoutTrailingZerosOrCurrencyFormatter().format(amount)
          : withoutCurrencyFormatter().format(amount),

      currencyName: (): string =>
        nameFormatter().formatToParts(amount).find(isPartCurrency)?.value ??
        money.currencyCode, // e.g. "US dollars"

      currencySymbol: (): string =>
        defaultFormatter().formatToParts(amount).find(isPartCurrency)?.value ??
        money.currencyCode, // e.g. "USD"

      currencyNarrowSymbol: (): string =>
        narrowSymbolFormatter().formatToParts(amount).find(isPartCurrency)
          ?.value ?? '', // e.g. "$"

      amount: (): string =>
        defaultFormatter()
          .formatToParts(amount)
          .filter((part) =>
            ['decimal', 'fraction', 'group', 'integer', 'literal'].includes(
              part.type,
            ),
          )
          .map((part) => part.value)
          .join(''),
    }),
    [
      money,
      amount,
      nameFormatter,
      defaultFormatter,
      narrowSymbolFormatter,
      withoutCurrencyFormatter,
      withoutTrailingZerosFormatter,
      withoutTrailingZerosOrCurrencyFormatter,
    ],
  );

  // Call functions automatically when the properties are accessed
  // to keep these functions as an implementation detail.
  return useMemo(
    () =>
      new Proxy(lazyFormatters as unknown as UseMoneyValue, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        get: (target, key) => Reflect.get(target, key)?.call(null),
      }),
    [lazyFormatters],
  );
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getLazyFormatter(
  locale: string,
  options?: Intl.NumberFormatOptions,
): () => Intl.NumberFormat {
  const key = JSON.stringify([locale, options]);

  return function (): Intl.NumberFormat {
    let formatter = formatterCache.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options);
      formatterCache.set(key, formatter);
    }
    return formatter;
  };
}
