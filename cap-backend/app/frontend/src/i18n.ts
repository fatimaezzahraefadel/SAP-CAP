import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslation from './locales/en/translation.json';
import frTranslation from './locales/fr/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],
    debug: false,
    lng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: { translation: enTranslation },
      fr: { translation: frTranslation },
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: (lng) => lng.toLowerCase().split('-')[0],
      caches: ['localStorage'],
    },
  });

export default i18n;
