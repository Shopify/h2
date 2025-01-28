import {useTranslation} from '~/i18n';

export function Welcome() {
  const {t} = useTranslation();

  return (
    <div>
      <h1>{t('home.welcome.title')}</h1>
      <h4>{t('home.welcome.subtitle')}</h4>
      <br />
      <p style={{maxWidth: 470}}>{t('home.welcome.description')}</p>
    </div>
  );
}
