import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { sk } from './locales/sk';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { hu } from './locales/hu';

export const resources = { en: { translation: en }, sk: { translation: sk }, ru: { translation: ru },
  uk: { translation: uk }, hu: { translation: hu } };

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources, lng: 'en', fallbackLng: 'en', supportedLngs: ['en', 'sk', 'ru', 'uk', 'hu'],
  keySeparator: false, interpolation: { escapeValue: false }, initImmediate: false,
});

export const languages = [
  { code: 'en', nativeName: 'English' }, { code: 'sk', nativeName: 'Slovenčina' },
  { code: 'ru', nativeName: 'Русский' }, { code: 'uk', nativeName: 'Українська' },
  { code: 'hu', nativeName: 'Magyar' },
] as const;
