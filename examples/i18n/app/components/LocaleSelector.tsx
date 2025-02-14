import {useRef} from 'react';
import type {Localizations} from '~/components/AsyncLocalizations';
import {CountrySelector} from '~/components/CountrySelector';
import {LanguageSelector} from '~/components/LanguageSelector';
import {useLocale, type I18n} from '~/i18n';

export type I18nSelector = {
  i18n: I18n;
  localizations: Localizations | null;
  selectedLocale: React.MutableRefObject<I18n>;
};

export function LocaleSelector({
  localizations,
}: {
  localizations: Localizations | null;
}) {
  const i18n = useLocale();
  const selectedLocale = useRef<I18n>(i18n);

  if (!localizations) return <p>Loading...</p>;

  const selectProps: I18nSelector = {
    i18n,
    localizations,
    selectedLocale,
  };

  return (
    <div style={{display: 'flex', gap: '.5rem'}}>
      <CountrySelector {...selectProps} />
      <LanguageSelector {...selectProps} />
    </div>
  );
}
