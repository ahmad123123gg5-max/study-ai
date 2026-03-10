import { LanguageCode } from './language-config';
import { UiLocaleBundle } from './locales/shared-ui-catalog';

type LocaleModule = { default: UiLocaleBundle };

const LOCALE_IMPORTERS: Record<LanguageCode, () => Promise<LocaleModule>> = {
  ar: () => import('./locales/ar'),
  en: () => import('./locales/en'),
  fr: () => import('./locales/fr'),
  es: () => import('./locales/es'),
  de: () => import('./locales/de'),
  it: () => import('./locales/it'),
  pt: () => import('./locales/pt'),
  tr: () => import('./locales/tr'),
  ru: () => import('./locales/ru'),
  zh: () => import('./locales/zh'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  hi: () => import('./locales/hi'),
  id: () => import('./locales/id'),
  ms: () => import('./locales/ms'),
  ur: () => import('./locales/ur'),
  nl: () => import('./locales/nl'),
  pl: () => import('./locales/pl'),
  sv: () => import('./locales/sv'),
  he: () => import('./locales/he')
};

export const loadUiLocaleBundle = async (language: LanguageCode): Promise<UiLocaleBundle> => {
  const loader = LOCALE_IMPORTERS[language] || LOCALE_IMPORTERS.en;
  const module = await loader();
  return module.default;
};
