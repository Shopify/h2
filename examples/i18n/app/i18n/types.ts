import {getLocaleFromRequest} from './getLocaleFromRequest.server';
import {fetchI18nJson} from './fetchI18nJson.server';

import type {
  CountryCode as SfCountryCode,
  LanguageCode as SfLanguageCode,
} from '@shopify/hydrogen/storefront-api-types';

export type LocaleStrategy = 'subfolder' | 'subdomain' | 'top-level-domain';

export type CountryCode = SfCountryCode;
export type LanguageCode = SfLanguageCode;

export type Country = Lowercase<CountryCode> | CountryCode;
export type Language = Lowercase<LanguageCode> | LanguageCode;

export type Locale = ReturnType<typeof getLocaleFromRequest>;
export type I18n = Awaited<ReturnType<typeof fetchI18nJson>>;

/** =========================================================
 * createLocaleParser types
 * ========================================================= */
export type LocalePrefix = {
  countryLanguage: boolean;
  format: string;
  regex: RegExp;
  value: string;
};

export type PrefixFromLocaleProps = {
  country: string | Country;
  language: string | Language;
};

export type PrefixFromLocale = ({
  country,
  language,
}: PrefixFromLocaleProps) => LocalePrefix;

export type SubFolderPrefixParser = ({
  country,
  COUNTRY,
  LANGUAGE,
  language,
  delimiter,
}: {
  country: 'country';
  COUNTRY: 'COUNTRY';
  LANGUAGE: 'LANGUAGE';
  language: 'language';
  delimiter: {
    '-': '-';
    _: '_';
  };
}) => string;

/** =========================================================
 * getLocaleFromRequest types
 * ========================================================= */
type GetSubFolderLocaleFromRequest = {
  request: Request;
  defaultI18n: BaseI18n;
  strategy: 'subfolder';
};

export type GetLocaleParsers = GetSubFolderLocaleFromRequest;

export type BaseI18n = {
  country: {
    code: string;
    name?: string;
    isDefault?: boolean;
    languages?: string[];
  };
  language: {
    code: string;
    name?: string;
    isDefault?: boolean;
    translation?: Record<string, any>;
  };
  isDefault?: boolean;
  prefix?: LocalePrefix;
};
