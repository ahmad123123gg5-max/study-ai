export type LanguageCode =
  | 'ar'
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'it'
  | 'pt'
  | 'tr'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'hi'
  | 'id'
  | 'ms'
  | 'ur'
  | 'nl'
  | 'pl'
  | 'sv'
  | 'he';

export type LanguageDirection = 'rtl' | 'ltr';

export interface SupportedLanguage {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  aiName: string;
  direction: LanguageDirection;
  speechLocale: string;
}

export const APP_LANGUAGE_STORAGE_KEY = 'app_language';
export const LEGACY_LANGUAGE_STORAGE_KEY = 'smartedge_user_lang';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', aiName: 'Arabic', direction: 'rtl', speechLocale: 'ar-SA' },
  { code: 'en', nativeName: 'English', englishName: 'English', aiName: 'English', direction: 'ltr', speechLocale: 'en-US' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', aiName: 'French', direction: 'ltr', speechLocale: 'fr-FR' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', aiName: 'Spanish', direction: 'ltr', speechLocale: 'es-ES' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', aiName: 'German', direction: 'ltr', speechLocale: 'de-DE' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', aiName: 'Italian', direction: 'ltr', speechLocale: 'it-IT' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', aiName: 'Portuguese', direction: 'ltr', speechLocale: 'pt-BR' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', aiName: 'Turkish', direction: 'ltr', speechLocale: 'tr-TR' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', aiName: 'Russian', direction: 'ltr', speechLocale: 'ru-RU' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese', aiName: 'Chinese', direction: 'ltr', speechLocale: 'zh-CN' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', aiName: 'Japanese', direction: 'ltr', speechLocale: 'ja-JP' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', aiName: 'Korean', direction: 'ltr', speechLocale: 'ko-KR' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', aiName: 'Hindi', direction: 'ltr', speechLocale: 'hi-IN' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', aiName: 'Indonesian', direction: 'ltr', speechLocale: 'id-ID' },
  { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', aiName: 'Malay', direction: 'ltr', speechLocale: 'ms-MY' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', aiName: 'Urdu', direction: 'rtl', speechLocale: 'ur-PK' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', aiName: 'Dutch', direction: 'ltr', speechLocale: 'nl-NL' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', aiName: 'Polish', direction: 'ltr', speechLocale: 'pl-PL' },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish', aiName: 'Swedish', direction: 'ltr', speechLocale: 'sv-SE' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', aiName: 'Hebrew', direction: 'rtl', speechLocale: 'he-IL' }
];

const SUPPORTED_LANGUAGE_MAP = new Map<LanguageCode, SupportedLanguage>(
  SUPPORTED_LANGUAGES.map((language) => [language.code, language])
);

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const CORE_UI_TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  ar: {
    'language.switcher': 'اللغة',
    'language.choose': 'اختر لغة الموقع',
    'language.current': 'اللغة الحالية',
    'language.saved': 'تم حفظ اللغة',
    'language.settings': 'إعدادات اللغة'
  },
  en: {
    'language.switcher': 'Language',
    'language.choose': 'Choose site language',
    'language.current': 'Current language',
    'language.saved': 'Language saved',
    'language.settings': 'Language settings'
  },
  fr: {
    'language.switcher': 'Langue',
    'language.choose': 'Choisir la langue du site',
    'language.current': 'Langue actuelle',
    'language.saved': 'Langue enregistrée',
    'language.settings': 'Paramètres de langue'
  },
  es: {
    'language.switcher': 'Idioma',
    'language.choose': 'Elegir el idioma del sitio',
    'language.current': 'Idioma actual',
    'language.saved': 'Idioma guardado',
    'language.settings': 'Configuración de idioma'
  },
  de: {
    'language.switcher': 'Sprache',
    'language.choose': 'Seitensprache auswählen',
    'language.current': 'Aktuelle Sprache',
    'language.saved': 'Sprache gespeichert',
    'language.settings': 'Spracheinstellungen'
  },
  it: {
    'language.switcher': 'Lingua',
    'language.choose': 'Scegli la lingua del sito',
    'language.current': 'Lingua attuale',
    'language.saved': 'Lingua salvata',
    'language.settings': 'Impostazioni lingua'
  },
  pt: {
    'language.switcher': 'Idioma',
    'language.choose': 'Escolher idioma do site',
    'language.current': 'Idioma atual',
    'language.saved': 'Idioma salvo',
    'language.settings': 'Configurações de idioma'
  },
  tr: {
    'language.switcher': 'Dil',
    'language.choose': 'Site dilini seçin',
    'language.current': 'Geçerli dil',
    'language.saved': 'Dil kaydedildi',
    'language.settings': 'Dil ayarları'
  },
  ru: {
    'language.switcher': 'Язык',
    'language.choose': 'Выберите язык сайта',
    'language.current': 'Текущий язык',
    'language.saved': 'Язык сохранён',
    'language.settings': 'Настройки языка'
  },
  zh: {
    'language.switcher': '语言',
    'language.choose': '选择网站语言',
    'language.current': '当前语言',
    'language.saved': '语言已保存',
    'language.settings': '语言设置'
  },
  ja: {
    'language.switcher': '言語',
    'language.choose': 'サイトの言語を選択',
    'language.current': '現在の言語',
    'language.saved': '言語を保存しました',
    'language.settings': '言語設定'
  },
  ko: {
    'language.switcher': '언어',
    'language.choose': '사이트 언어 선택',
    'language.current': '현재 언어',
    'language.saved': '언어가 저장되었습니다',
    'language.settings': '언어 설정'
  },
  hi: {
    'language.switcher': 'भाषा',
    'language.choose': 'साइट की भाषा चुनें',
    'language.current': 'वर्तमान भाषा',
    'language.saved': 'भाषा सहेज ली गई',
    'language.settings': 'भाषा सेटिंग्स'
  },
  id: {
    'language.switcher': 'Bahasa',
    'language.choose': 'Pilih bahasa situs',
    'language.current': 'Bahasa saat ini',
    'language.saved': 'Bahasa disimpan',
    'language.settings': 'Pengaturan bahasa'
  },
  ms: {
    'language.switcher': 'Bahasa',
    'language.choose': 'Pilih bahasa laman',
    'language.current': 'Bahasa semasa',
    'language.saved': 'Bahasa disimpan',
    'language.settings': 'Tetapan bahasa'
  },
  ur: {
    'language.switcher': 'زبان',
    'language.choose': 'ویب سائٹ کی زبان منتخب کریں',
    'language.current': 'موجودہ زبان',
    'language.saved': 'زبان محفوظ ہو گئی',
    'language.settings': 'زبان کی ترتیبات'
  },
  nl: {
    'language.switcher': 'Taal',
    'language.choose': 'Kies de sitetaal',
    'language.current': 'Huidige taal',
    'language.saved': 'Taal opgeslagen',
    'language.settings': 'Taalinstellingen'
  },
  pl: {
    'language.switcher': 'Język',
    'language.choose': 'Wybierz język strony',
    'language.current': 'Aktualny język',
    'language.saved': 'Język zapisany',
    'language.settings': 'Ustawienia języka'
  },
  sv: {
    'language.switcher': 'Språk',
    'language.choose': 'Välj webbplatsens språk',
    'language.current': 'Aktuellt språk',
    'language.saved': 'Språket sparades',
    'language.settings': 'Språkinställningar'
  },
  he: {
    'language.switcher': 'שפה',
    'language.choose': 'בחר את שפת האתר',
    'language.current': 'השפה הנוכחית',
    'language.saved': 'השפה נשמרה',
    'language.settings': 'הגדרות שפה'
  }
};

export const normalizeLanguageCode = (value: unknown): LanguageCode => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORTED_LANGUAGE_MAP.has(normalized as LanguageCode)
    ? normalized as LanguageCode
    : DEFAULT_LANGUAGE;
};

export const detectFirstVisitLanguage = (): LanguageCode => {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const browserLanguage = navigator.languages?.[0] || navigator.language || '';
  return browserLanguage.trim().toLowerCase().startsWith('ar') ? 'ar' : 'en';
};

export const resolveInitialLanguage = (): LanguageCode => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)
    || localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);

  if (storedLanguage) {
    return normalizeLanguageCode(storedLanguage);
  }

  return detectFirstVisitLanguage();
};

export const getSupportedLanguage = (code: LanguageCode | string | null | undefined): SupportedLanguage => {
  const normalized = normalizeLanguageCode(code);
  return SUPPORTED_LANGUAGE_MAP.get(normalized) || SUPPORTED_LANGUAGE_MAP.get(DEFAULT_LANGUAGE)!;
};

export const getLanguageDirection = (code: LanguageCode | string | null | undefined): LanguageDirection =>
  getSupportedLanguage(code).direction;

export const getLanguageName = (code: LanguageCode | string | null | undefined): string =>
  getSupportedLanguage(code).aiName;

export const getSpeechRecognitionLocale = (code: LanguageCode | string | null | undefined): string =>
  getSupportedLanguage(code).speechLocale;

export const isRtlLanguage = (code: LanguageCode | string | null | undefined): boolean =>
  getLanguageDirection(code) === 'rtl';

export const getCoreUiText = (language: LanguageCode, key: string): string =>
  CORE_UI_TRANSLATIONS[language]?.[key]
  || CORE_UI_TRANSLATIONS[DEFAULT_LANGUAGE]?.[key]
  || CORE_UI_TRANSLATIONS.en[key]
  || key;
