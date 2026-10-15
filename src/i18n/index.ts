import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { sk } from './locales/sk';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { hu } from './locales/hu';
import { scannerTranslations } from './scanner';
import { authTranslations } from './auth';
import { profileTranslations } from './profile';
import { confirmationTranslations } from './email-confirmation';
import { avatarTranslations } from './avatar';
import { passwordTranslations } from './password';
import { syncTranslations } from './sync';
import { accountTranslations } from './account';

export const resources = { en: { translation: { ...en, ...scannerTranslations.en, ...authTranslations.en, ...profileTranslations.en, ...confirmationTranslations.en, ...avatarTranslations.en } }, sk: { translation: { ...sk, ...scannerTranslations.sk, ...authTranslations.sk, ...profileTranslations.sk, ...confirmationTranslations.sk, ...avatarTranslations.sk } }, ru: { translation: { ...ru, ...scannerTranslations.ru, ...authTranslations.ru, ...profileTranslations.ru, ...confirmationTranslations.ru, ...avatarTranslations.ru } },
  uk: { translation: { ...uk, ...scannerTranslations.uk, ...authTranslations.uk, ...profileTranslations.uk, ...confirmationTranslations.uk, ...avatarTranslations.uk } }, hu: { translation: { ...hu, ...scannerTranslations.hu, ...authTranslations.hu, ...profileTranslations.hu, ...confirmationTranslations.hu, ...avatarTranslations.hu } } };

export const i18n = createInstance();
for (const language of ['en', 'sk', 'ru', 'uk', 'hu'] as const) {
  Object.assign(resources[language].translation, passwordTranslations[language], syncTranslations[language], accountTranslations[language]);
}
void i18n.use(initReactI18next).init({
  resources, lng: 'en', fallbackLng: 'en', supportedLngs: ['en', 'sk', 'ru', 'uk', 'hu'],
  keySeparator: false, interpolation: { escapeValue: false }, initAsync: false,
});

export const languages = [
  { code: 'en', nativeName: 'English' }, { code: 'sk', nativeName: 'Slovenčina' },
  { code: 'ru', nativeName: 'Русский' }, { code: 'uk', nativeName: 'Українська' },
  { code: 'hu', nativeName: 'Magyar' },
] as const;
