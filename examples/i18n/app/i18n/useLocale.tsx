import {useMatches} from '@remix-run/react';
import type {I18n} from './types';

export function useLocale(): I18n {
  const [root] = useMatches();

  if (!root?.data?.i18n) {
    throw new Error(
      'i18n was not returned from the root layout loader.\n Please make sure i18n is configured correctly in both server.ts and root.tsx.',
    );
  }

  return root?.data?.i18n as I18n;
}
