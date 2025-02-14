import {useLocale} from './useLocale';
import type {I18n} from './types';

type TranslationSegment = string;
export type Translation = I18n['language']['translation'];
export type UseTranslation = {
  t: (key: string, interpolations?: object) => TranslationSegment;
  translation: Translation | null;
};

/**
 * Returns a translation function that can be used to translate
 * a key into a string.
 * NOTE: this is a rough implementation to get the idea across
 * and is not meant to be used in production.
 */
export function useTranslation(): UseTranslation {
  const {language} = useLocale();

  // we have to safeguard against a particular language translation
  // missing, as it's possible to have a language json without a
  // translation key if the user miss types it or removes it
  if (!language) {
    return {t: (key: string) => key, translation: null};
  }

  if (!language?.translation) {
    // translation not found for this key and language
    return {t: (key: string) => key, translation: null};
  }

  function t(key?: string, interpolations?: object): TranslationSegment {
    const keys = key?.split('.') ?? [];

    if (typeof language.translation === 'undefined') {
      return key ?? '';
    }

    if (keys.length === 1) {
      if (keys[0] in language.translation) {
        const _key = keys[0] as keyof Translation;
        const segmentIsString = typeof language.translation[_key] === 'string';
        if (segmentIsString) {
          return interpolate(language.translation[_key], interpolations ?? {});
        } else {
          return '';
        }
      } else {
        return key ?? '';
      }
    } else if (keys.length > 1) {
      const value = getValue(language.translation, key) ?? '';
      if (typeof value === 'string') {
        return interpolate(value, interpolations ?? {});
      }
      return key as string;
    } else {
      return key ?? '';
    }
  }

  return {t, translation: language.translation};
}

function interpolate(string: string, interpolations: object) {
  return string.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    // @ts-ignore
    return interpolations[key] ?? match;
  });
}

function getValue(obj: object, key: string | undefined) {
  if (!key) {
    return null;
  }
  const keys = key.split('.');
  let value = obj;
  for (let i = 0; i < keys.length; i++) {
    // @ts-ignore
    value = value[keys[i]];
    if (!value) {
      break;
    }
  }
  return value;
}
