import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fil from './locales/fil.json';
import { getLanguage } from '../store/language';

const resources = { en: { translation: en }, fil: { translation: fil } };
const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

if (typeof window !== 'undefined') {
  getLanguage().then((lang) => { if (i18n.language !== lang) i18n.changeLanguage(lang); });
}

export default i18n;
