import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fil from './locales/fil.json';
import { getLanguage, setLanguage, type AppLanguage } from '../store/language';

const resources = { en: { translation: en, ui: en.ui }, fil: { translation: fil, ui: fil.ui } };
const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

let selectionVersion = 0;

export async function selectLanguage(code: AppLanguage) {
  selectionVersion += 1;
  await setLanguage(code);
  await i18n.changeLanguage(code);
}

export async function restoreLanguage() {
  const version = selectionVersion;
  const language = await getLanguage();
  if (version === selectionVersion) await i18n.changeLanguage(language);
}

export default i18n;
