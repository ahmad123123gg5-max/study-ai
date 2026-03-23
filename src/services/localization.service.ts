import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { AIService } from './ai.service';
import {
  APP_LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEY,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  getCoreUiText,
  getLanguageDirection,
  getLanguageName,
  getSpeechRecognitionLocale,
  getSupportedLanguage,
  normalizeLanguageCode,
  resolveInitialLanguage
} from '../i18n/language-config';
import { loadUiLocaleBundle } from '../i18n/locale-loader';
import { normalizeUiLookupKey, UiLocaleBundle } from '../i18n/locales/shared-ui-catalog';
import arUiLocaleBundle from '../i18n/locales/ar';
import enUiLocaleBundle from '../i18n/locales/en';

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly documentRef = inject(DOCUMENT);
  private readonly ai = inject(AIService);
  private readonly auth = inject(AuthService);

  private readonly translatableAttributes = ['placeholder', 'title', 'aria-label', 'data-tooltip'];
  private readonly textNodeOriginals = new WeakMap<Text, string>();
  private readonly attributeOriginals = new WeakMap<Element, Map<string, string>>();
  private readonly localeBundleCache = new Map<LanguageCode, Promise<UiLocaleBundle>>([
    ['ar', Promise.resolve(arUiLocaleBundle)],
    ['en', Promise.resolve(enUiLocaleBundle)]
  ]);
  private readonly resolvedLocaleBundles = new Map<LanguageCode, UiLocaleBundle>([
    ['ar', arUiLocaleBundle],
    ['en', enUiLocaleBundle]
  ]);

  private observer: MutationObserver | null = null;
  private rootElement: HTMLElement | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private applyingTranslations = false;

  readonly supportedLanguages = SUPPORTED_LANGUAGES;
  readonly currentLanguage = computed(() => normalizeLanguageCode(this.ai.currentLanguage()));
  readonly direction = computed(() => getLanguageDirection(this.currentLanguage()));
  readonly currentLanguageMeta = computed(() => getSupportedLanguage(this.currentLanguage()));

  constructor() {
    const storedLanguage = resolveInitialLanguage();
    if (this.ai.currentLanguage() !== storedLanguage) {
      this.ai.currentLanguage.set(storedLanguage);
    }

    effect(() => {
      const language = this.currentLanguage();
      localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
      localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, language);
      this.applyDocumentLanguage(language);
      void this.ensureLocaleBundle(language).finally(() => this.scheduleScan());
    });
  }

  coreText(key: string, language: LanguageCode = this.currentLanguage()): string {
    return getCoreUiText(language, key);
  }

  phrase(text: string, language: LanguageCode = this.currentLanguage()): string {
    const key = normalizeUiLookupKey(text);
    if (!key) {
      return text;
    }

    const bundlePromise = this.localeBundleCache.get(language);
    const resolved = this.resolvedLocaleBundles.get(language);
    if (resolved) {
      return resolved.lookup.get(key) || text;
    }

    if (!bundlePromise) {
      void this.ensureLocaleBundle(language);
      return text;
    }

    return text;
  }

  getLanguageName(language: LanguageCode | string | null | undefined = this.currentLanguage()): string {
    return getLanguageName(language);
  }

  getSpeechRecognitionLocale(language: LanguageCode | string | null | undefined = this.currentLanguage()): string {
    return getSpeechRecognitionLocale(language);
  }

  getLanguageMeta(language: LanguageCode | string | null | undefined = this.currentLanguage()): SupportedLanguage {
    return getSupportedLanguage(language);
  }

  async setLanguage(language: LanguageCode | string): Promise<void> {
    const normalized = normalizeLanguageCode(language);
    if (normalized === this.currentLanguage()) {
      this.applyDocumentLanguage(normalized);
      await this.ensureLocaleBundle(normalized);
      this.scheduleScan();
      return;
    }

    this.ai.currentLanguage.set(normalized);

    const currentProfile = this.auth.userProfile();
    if (this.auth.currentUser() && currentProfile?.preferredLanguage !== normalized) {
      try {
        await this.auth.updateProfile({ preferredLanguage: normalized });
      } catch (error) {
        console.warn('Failed to persist preferred language to user profile', error);
      }
    }
  }

  observeDocument(root: HTMLElement | null | undefined): void {
    const nextRoot = root || this.documentRef?.body || null;
    if (!nextRoot) {
      return;
    }

    this.rootElement = nextRoot;

    if (!this.observer) {
      this.observer = new MutationObserver(() => {
        if (!this.applyingTranslations) {
          this.scheduleScan(80);
        }
      });
    } else {
      this.observer.disconnect();
    }

    this.observer.observe(nextRoot, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: this.translatableAttributes
    });

    this.scheduleScan();
  }

  async translateText(text: string, language: LanguageCode = this.currentLanguage()): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) {
      return text;
    }

    const bundle = await this.ensureLocaleBundle(language);
    return this.translateWithBundle(text, bundle);
  }

  private async ensureLocaleBundle(language: LanguageCode): Promise<UiLocaleBundle> {
    const existing = this.localeBundleCache.get(language);
    if (existing) {
      return existing;
    }

    const nextBundle = loadUiLocaleBundle(language)
      .then((bundle) => {
        this.resolvedLocaleBundles.set(language, bundle);
        return bundle;
      })
      .catch((error) => {
        console.warn(`Failed to load locale bundle for ${language}`, error);
        if (language !== 'en') {
          return this.ensureLocaleBundle('en');
        }

        return { lookup: new Map<string, string>() } as UiLocaleBundle;
      });

    this.localeBundleCache.set(language, nextBundle);
    return nextBundle;
  }

  private applyDocumentLanguage(language: LanguageCode): void {
    const html = this.documentRef?.documentElement;
    const body = this.documentRef?.body;
    if (!html || !body) {
      return;
    }

    const direction = getLanguageDirection(language);
    html.lang = language;
    html.dir = direction;
    body.dir = direction;
    body.classList.toggle('locale-rtl', direction === 'rtl');
    body.classList.toggle('locale-ltr', direction === 'ltr');
    this.applySeoMetadata(language);
  }

  private applySeoMetadata(language: LanguageCode): void {
    const documentRef = this.documentRef;
    if (!documentRef) {
      return;
    }

    const isArabic = language === 'ar';
    const title = isArabic
      ? 'StudyVex AI | Smart AI Study Platform'
      : 'StudyVex AI | Smart AI Study Platform';
    const description = isArabic
      ? 'StudyVex AI helps students worldwide learn faster with AI tools, quizzes, flashcards, summaries, and more.'
      : 'StudyVex AI helps students worldwide learn faster with AI tools, quizzes, flashcards, summaries, and more.';
    const socialDescription = isArabic
      ? 'AI study platform for students worldwide'
      : 'AI study platform for students worldwide';
    const imageUrl = 'https://studyvex.ai/assets/studyvex-preview.png';
    const siteUrl = 'https://studyvex.ai';

    documentRef.title = title;
    this.setMetaTag('name', 'description', description);
    this.setMetaTag('property', 'og:type', 'website');
    this.setMetaTag('property', 'og:title', 'StudyVex AI');
    this.setMetaTag('property', 'og:description', socialDescription);
    this.setMetaTag('property', 'og:site_name', 'StudyVex AI');
    this.setMetaTag('property', 'og:image', imageUrl);
    this.setMetaTag('property', 'og:url', siteUrl);
    this.setMetaTag('name', 'twitter:card', 'summary_large_image');
    this.setMetaTag('name', 'twitter:title', 'StudyVex AI');
    this.setMetaTag('name', 'twitter:description', socialDescription);
    this.setMetaTag('name', 'twitter:image', imageUrl);
  }

  private setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
    const selector = `meta[${attrName}="${attrValue}"]`;
    const meta = this.documentRef?.querySelector(selector);
    if (!meta) {
      return;
    }
    meta.setAttribute('content', content);
  }

  private scheduleScan(delay = 24): void {
    if (!this.rootElement) {
      return;
    }

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }

    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      void this.scanAndTranslateDocument();
    }, delay);
  }

  private async scanAndTranslateDocument(): Promise<void> {
    if (!this.rootElement) {
      return;
    }

    const language = this.currentLanguage();
    const bundle = await this.ensureLocaleBundle(language);
    if (language !== this.currentLanguage()) {
      return;
    }

    const textTargets: Array<{ node: Text; original: string }> = [];
    const attributeTargets: Array<{ element: Element; attr: string; original: string }> = [];

    const textWalker = this.documentRef.createTreeWalker(
      this.rootElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!(node instanceof Text)) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;
          if (!parent || this.shouldSkipElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          return this.isMeaningfulText(node.textContent || '')
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let currentTextNode = textWalker.nextNode();
    while (currentTextNode) {
      const textNode = currentTextNode as Text;
      const original = this.textNodeOriginals.get(textNode) ?? (textNode.textContent || '');
      if (!this.textNodeOriginals.has(textNode)) {
        this.textNodeOriginals.set(textNode, original);
      }

      if (this.isMeaningfulText(original)) {
        textTargets.push({ node: textNode, original });
      }

      currentTextNode = textWalker.nextNode();
    }

    const elementWalker = this.documentRef.createTreeWalker(
      this.rootElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) =>
          node instanceof Element && !this.shouldSkipElement(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT
      }
    );

    let currentElementNode = elementWalker.nextNode();
    while (currentElementNode) {
      const element = currentElementNode as Element;
      this.translatableAttributes.forEach((attr) => {
        const value = element.getAttribute(attr);
        if (!value || !this.isMeaningfulText(value)) {
          return;
        }

        let attrMap = this.attributeOriginals.get(element);
        if (!attrMap) {
          attrMap = new Map<string, string>();
          this.attributeOriginals.set(element, attrMap);
        }

        const original = attrMap.get(attr) || value;
        attrMap.set(attr, original);
        attributeTargets.push({ element, attr, original });
      });
      currentElementNode = elementWalker.nextNode();
    }

    this.applyingTranslations = true;

    try {
      textTargets.forEach(({ node, original }) => {
        const nextValue = this.translateWithBundle(original, bundle);
        if (node.textContent !== nextValue) {
          node.textContent = nextValue;
        }
      });

      attributeTargets.forEach(({ element, attr, original }) => {
        const nextValue = this.translateWithBundle(original, bundle);
        if (element.getAttribute(attr) !== nextValue) {
          element.setAttribute(attr, nextValue);
        }
      });
    } finally {
      this.applyingTranslations = false;
    }
  }

  private translateWithBundle(text: string, bundle: UiLocaleBundle): string {
    const key = normalizeUiLookupKey(text);
    if (!key) {
      return text;
    }

    return bundle.lookup.get(key) || text;
  }

  private shouldSkipElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    return tag === 'script'
      || tag === 'style'
      || tag === 'code'
      || tag === 'pre'
      || tag === 'svg'
      || tag === 'path'
      || element.hasAttribute('data-no-i18n');
  }

  private isMeaningfulText(value: string): boolean {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      return false;
    }

    if (trimmed.length === 1 && !/\p{L}|\p{N}/u.test(trimmed)) {
      return false;
    }

    if (/^(https?:\/\/|www\.|mailto:)/i.test(trimmed)) {
      return false;
    }

    return /[\p{L}]/u.test(trimmed);
  }
}
