import { Injectable, inject } from '@angular/core';
import { AIService } from '../../../../services/ai.service';
import { STUDY_TRANSLATION_GLOSSARY } from '../document-workspace.data';
import {
  DocumentTextBlock,
  TargetLanguage,
  TranslationBlock,
  WorkspaceLanguage
} from '../document-workspace.types';

export interface TranslationBatchResult {
  sourceLanguage: Exclude<WorkspaceLanguage, 'auto'>;
  targetLanguage: TargetLanguage;
  blocks: TranslationBlock[];
}

@Injectable({ providedIn: 'root' })
export class DocumentWorkspaceTranslationService {
  private readonly ai = inject(AIService);
  private readonly textCache = new Map<string, string>();

  async translateSelection(
    text: string,
    pageNumber: number,
    sourceLanguage: WorkspaceLanguage,
    targetLanguage: TargetLanguage
  ): Promise<TranslationBlock> {
    const resolvedSource = this.resolveSourceLanguage(text, sourceLanguage);
    const resolvedTarget = this.resolveTargetLanguage(text, sourceLanguage, targetLanguage);
    return {
      id: crypto.randomUUID(),
      sourceText: text,
      translatedText: await this.translateText(text, resolvedSource, resolvedTarget),
      pageNumber,
      sourceLanguage: resolvedSource,
      targetLanguage: resolvedTarget,
      orderIndex: 0,
      mode: 'selection',
      createdAt: new Date().toISOString()
    };
  }

  async translatePageBlocks(
    pageNumber: number,
    blocks: DocumentTextBlock[],
    sourceLanguage: WorkspaceLanguage,
    targetLanguage: TargetLanguage,
    mode: TranslationBlock['mode'] = 'page'
  ): Promise<TranslationBatchResult> {
    const corpus = blocks.map((block) => block.text).join(' ');
    const resolvedSource = this.resolveSourceLanguage(corpus, sourceLanguage);
    const resolvedTarget = this.resolveTargetLanguage(corpus, sourceLanguage, targetLanguage);

    const translatedBlocks = await Promise.all(
      blocks.map(async (block) => ({
        id: `${pageNumber}-${block.id}-${resolvedTarget}`,
        sourceText: block.text,
        translatedText: await this.translateText(block.text, resolvedSource, resolvedTarget),
        pageNumber,
        sourceLanguage: block.language || resolvedSource,
        targetLanguage: resolvedTarget,
        blockId: block.id,
        orderIndex: block.readingOrder,
        bounds: {
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height
        },
        mode,
        createdAt: new Date().toISOString()
      }))
    );

    return {
      sourceLanguage: resolvedSource,
      targetLanguage: resolvedTarget,
      blocks: translatedBlocks
    };
  }

  private async translateText(
    text: string,
    source: Exclude<WorkspaceLanguage, 'auto'>,
    target: TargetLanguage
  ): Promise<string> {
    if (source === target) {
      return text;
    }

    const cacheKey = `${source}:${target}:${text.trim()}`;
    const cached = this.textCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this.ensureLatency();

    const prompt = `Translate the following study text from ${source === 'ar' ? 'Arabic' : 'English'} to ${
      target === 'ar' ? 'Arabic' : 'English'
    } while preserving meaning and keeping it student-friendly:\n${text}`;
    try {
      const response = await this.ai.chat(
        prompt,
        'You are a study translation assistant. Translate only the provided text. No extra commentary.'
      );
      if (response?.trim()) {
        const result = response.trim();
        this.textCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn('Document workspace translation fallback activated', error);
    }

    const fallback = this.mockTranslate(text, target);
    this.textCache.set(cacheKey, fallback);
    return fallback;
  }

  resolveSourceLanguage(text: string, configured: WorkspaceLanguage): Exclude<WorkspaceLanguage, 'auto'> {
    if (configured !== 'auto') {
      return configured;
    }
    return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
  }

  resolveTargetLanguage(text: string, sourceLanguage: WorkspaceLanguage, configuredTarget: TargetLanguage): TargetLanguage {
    const resolvedSource = this.resolveSourceLanguage(text, sourceLanguage);
    if (resolvedSource === configuredTarget) {
      return configuredTarget === 'ar' ? 'en' : 'ar';
    }
    return configuredTarget;
  }

  private mockTranslate(text: string, target: TargetLanguage): string {
    const tokens = text.split(/(\s+|[.,;:()/-])/g);
    const translated = tokens.map((token) => {
      const key = token.toLowerCase();
      if (STUDY_TRANSLATION_GLOSSARY[key]) {
        return target === 'ar' ? STUDY_TRANSLATION_GLOSSARY[key] : key;
      }

      const reversedEntry = Object.entries(STUDY_TRANSLATION_GLOSSARY).find(
        ([, value]) => value === token
      );
      if (target === 'en' && reversedEntry) {
        return reversedEntry[0];
      }

      return token;
    });

    const result = translated.join('');
    if (result !== text) {
      return result;
    }

    return target === 'ar'
      ? `ترجمة دراسية تقريبية: ${text}`
      : `Study translation preview: ${text}`;
  }

  private async ensureLatency() {
    await new Promise((resolve) => setTimeout(resolve, 360));
  }
}
