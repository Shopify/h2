import localizations from '../../public/locales/all.json';

export type Localizations = typeof localizations;

export function AsyncLocalizations({
  children,
}: {
  children: (props: {localizations: Localizations}) => JSX.Element;
}) {
  return children({localizations});
}
