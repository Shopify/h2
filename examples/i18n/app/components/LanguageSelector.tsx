import type {I18nSelector} from '~/components/LocaleSelector';
import {subfolderLocaleParser} from '~/utils';
import {navigateToLocale, type I18n} from '~/i18n';

export function LanguageSelector({localizations, i18n}: I18nSelector) {
  const localization =
    localizations?.find((localization) => {
      return localization.code === i18n.country.code;
    }) || undefined;
  const languages = localization?.languages;

  if (
    !localization ||
    !localization?.code ||
    !languages ||
    languages?.length <= 1
  ) {
    return null;
  }

  function switchLanguage(event: React.ChangeEvent<HTMLSelectElement>) {
    const selectedLanguage = event.target.value as I18n['language']['code'];

    // build the prefix with the config passed to
    const prefix = subfolderLocaleParser({
      country: i18n.country.code,
      language: selectedLanguage,
    });

    const selectedLocale = {
      country: i18n.country,
      isDefault: i18n.isDefault,
      language: {
        code: selectedLanguage,
      },
      prefix,
    } as I18n;

    navigateToLocale(selectedLocale);
  }

  return (
    <select
      name="language"
      onChange={switchLanguage}
      style={{minWidth: 160}}
      value={i18n.language.code}
    >
      {languages.map((language) => {
        return (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        );
      })}
    </select>
  );
}
