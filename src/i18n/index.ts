import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { sk } from './locales/sk';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { hu } from './locales/hu';
import { scannerTranslations } from './scanner';
import { authTranslations } from './auth';

export const resources = { en: { translation: { ...en, ...scannerTranslations.en, ...authTranslations.en } }, sk: { translation: { ...sk, ...scannerTranslations.sk, ...authTranslations.sk } }, ru: { translation: { ...ru, ...scannerTranslations.ru, ...authTranslations.ru } },
  uk: { translation: { ...uk, ...scannerTranslations.uk, ...authTranslations.uk } }, hu: { translation: { ...hu, ...scannerTranslations.hu, ...authTranslations.hu } } };

export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources, lng: 'en', fallbackLng: 'en', supportedLngs: ['en', 'sk', 'ru', 'uk', 'hu'],
  keySeparator: false, interpolation: { escapeValue: false }, initAsync: false,
});

export const languages = [
  { code: 'en', nativeName: 'English' }, { code: 'sk', nativeName: 'Slovenčina' },
  { code: 'ru', nativeName: 'Русский' }, { code: 'uk', nativeName: 'Українська' },
  { code: 'hu', nativeName: 'Magyar' },
] as const;
