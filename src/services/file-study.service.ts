import { Injectable, inject } from '@angular/core';
import { AIService } from './ai.service';

export type FileStudyLanguage = 'ar' | 'en';
export type FileStudyExplainStyle = 'simple' | 'medium' | 'deep';
export type FileStudyExplainMode = 'basic' | 'simple' | 'detailed' | 'questions' | 'ask';

export interface FileStudyPage {
  pageNumber: number;
  rawText: string;
  cleanedText: string;
  bullets: string[];
  heading?: string;
  hasUsableText: boolean;
  extractedFrom: 'pdf-text' | 'mixed';
}

export interface FileStudyDocument {
  documentId: string;
  fileName: string;
  totalPages: number;
  pages: FileStudyPage[];
  createdAt: string;
}

export interface FileStudyExplanation {
  pageNumber: number;
  title: string;
  summary: string;
  keyPoints: string[];
  lineItems?: Array<{
    source: string;
    explanation: string;
    translation?: string;
  }>;
  note?: string;
  grounded: boolean;
  status: 'grounded' | 'limited';
  mode: FileStudyExplainMode;
  question?: string;
}

interface ExplainPayload {
  title?: unknown;
  summary?: unknown;
  keyPoints?: unknown;
  lineItems?: unknown;
  note?: unknown;
}

@Injectable({ providedIn: 'root' })
export class FileStudyService {
  private readonly ai = inject(AIService);
  private readonly documentCache = new Map<string, FileStudyDocument>();
  private readonly pdfCache = new Map<string, any>();
  private readonly explanationCache = new Map<string, FileStudyExplanation>();
  private readonly inflightExplanations = new Map<string, Promise<FileStudyExplanation>>();
  private pdfjsPromise?: Promise<any>;

  async parsePdf(
    file: File,
    handlers?: {
      onProgress?: (value: { currentPage: number; totalPages: number; label: string }) => void;
    }
  ): Promise<FileStudyDocument> {
    const pdfjs = await this.loadPdfJs();

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(this.buildPdfDocumentOptions(buffer)).promise;

    const totalPages = pdf.numPages;
    const pages: FileStudyPage[] = [];
    const documentId = this.createDocumentId(file);

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      handlers?.onProgress?.({
        currentPage: pageNumber,
        totalPages,
        label: `Reading page ${pageNumber} of ${totalPages}`
      });

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const rawText = this.extractReadableText(textContent);

      const cleaned = this.cleanSlideText(rawText);
      pages.push({
        pageNumber,
        rawText,
        cleanedText: cleaned.cleanedText,
        bullets: cleaned.bullets,
        heading: cleaned.heading,
        hasUsableText: cleaned.cleanedText.length >= 40 || cleaned.bullets.length > 1,
        extractedFrom: 'pdf-text'
      });
    }

    const parsed: FileStudyDocument = {
      documentId,
      fileName: file.name,
      totalPages,
      pages,
      createdAt: new Date().toISOString()
    };

    this.documentCache.set(documentId, parsed);
    this.pdfCache.set(documentId, pdf);

    return parsed;
  }

  async renderPageToCanvas(
    documentId: string,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    textLayerDiv: HTMLDivElement,
    scale: number = 1.15
  ): Promise<void> {
    const pdf = this.pdfCache.get(documentId);
    if (!pdf) {
      throw new Error('PDF document is not ready');
    }

    const pdfjs = await this.loadPdfJs();
    const page = await pdf.getPage(pageNumber);
    const outputScale = typeof window === 'undefined' ? 1 : Math.max(window.devicePixelRatio || 1, 1);
    const viewport = page.getViewport({ scale: scale * outputScale });
    const cssViewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${Math.ceil(viewport.width / outputScale)}px`;
    canvas.style.height = `${Math.ceil(viewport.height / outputScale)}px`;

    context.clearRect(0, 0, canvas.width, canvas.height);
    textLayerDiv.replaceChildren();
    textLayerDiv.style.width = `${Math.ceil(cssViewport.width)}px`;
    textLayerDiv.style.height = `${Math.ceil(cssViewport.height)}px`;
    textLayerDiv.style.setProperty('--total-scale-factor', `${cssViewport.scale}`);
    textLayerDiv.setAttribute('aria-hidden', 'true');

    const renderTask = page.render({
      canvasContext: context,
      viewport,
      canvas
    });

    await renderTask.promise;
  }

  getDocument(documentId: string): FileStudyDocument | null {
    return this.documentCache.get(documentId) || null;
  }

  getPageByNumber(documentId: string, pageNumber: number): FileStudyPage | null {
    const document = this.documentCache.get(documentId);
    if (!document) {
      return null;
    }

    return document.pages.find(page => page.pageNumber === pageNumber) || null;
  }

  async explainPage(options: {
    documentId: string;
    pageNumber: number;
    language: FileStudyLanguage;
    explainStyle: FileStudyExplainStyle;
    mode: FileStudyExplainMode;
    userQuestion?: string;
  }): Promise<FileStudyExplanation> {
    const page = this.getPageByNumber(options.documentId, options.pageNumber);
    if (!page) {
      throw new Error('Requested page was not found');
    }

    const cacheKey = this.buildExplanationCacheKey(options);
    const cached = this.explanationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const inflight = this.inflightExplanations.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const task = this.generatePageExplanation(page, options)
      .then(result => {
        this.explanationCache.set(cacheKey, result);
        this.inflightExplanations.delete(cacheKey);
        return result;
      })
      .catch(error => {
        this.inflightExplanations.delete(cacheKey);
        throw error;
      });

    this.inflightExplanations.set(cacheKey, task);
    return task;
  }

  clearDocument(documentId: string): void {
    this.documentCache.delete(documentId);
    this.pdfCache.delete(documentId);
    for (const key of Array.from(this.explanationCache.keys())) {
      if (key.startsWith(`${documentId}::`)) {
        this.explanationCache.delete(key);
      }
    }
  }

  cleanSlideText(raw: string): { cleanedText: string; bullets: string[]; heading?: string } {
    const normalized = raw
      .replace(/\u0000/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/[•▪■◆●◦]/g, '• ')
      .replace(/\t+/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const heading = lines.find(line => line.length >= 4 && line.length <= 90);
    const bullets = lines
      .filter(line => /^([-*•]|\d+[.)])\s*/.test(line) || (line.length > 12 && line.length <= 140))
      .slice(0, 6)
      .map(line => line.replace(/^([-*•]|\d+[.)])\s*/, '').trim());

    return {
      cleanedText: lines.join('\n'),
      bullets,
      heading
    };
  }

  private async generatePageExplanation(
    page: FileStudyPage,
    options: {
      documentId: string;
      pageNumber: number;
      language: FileStudyLanguage;
      explainStyle: FileStudyExplainStyle;
      mode: FileStudyExplainMode;
      userQuestion?: string;
    }
  ): Promise<FileStudyExplanation> {
    if (!page.hasUsableText) {
      return this.buildLimitedTextFallback(page, options.mode, options.language, options.userQuestion);
    }

    const systemInstruction = this.buildAcademicSlideSystemInstruction(options.language);
    const message = this.buildAcademicSlidePrompt(page, options);

    try {
      const payload = await this.ai.jsonSilently<ExplainPayload>(
        message,
        systemInstruction,
        'gpt-4o-mini',
        [],
        {
          maxTokens: 700,
          temperature: 0.15,
          featureHint: 'aiTeacherQuestions'
        },
        options.language
      );

      const result: FileStudyExplanation = {
        pageNumber: page.pageNumber,
        title: this.asNonEmptyString(payload.title) || this.buildFallbackTitle(page, options.mode),
        summary: this.asNonEmptyString(payload.summary) || this.buildFallbackSummary(page),
        keyPoints: this.asStringArray(payload.keyPoints).slice(0, 5),
        lineItems: this.asLineItemArray(payload.lineItems, options.language),
        note: this.asNonEmptyString(payload.note) || undefined,
        grounded: true,
        status: 'grounded',
        mode: options.mode,
        question: options.userQuestion?.trim() || undefined
      };

      if (result.keyPoints.length === 0) {
        result.keyPoints = this.fallbackKeyPoints(page);
      }
      if ((!result.lineItems || result.lineItems.length === 0) && options.mode !== 'questions' && options.mode !== 'ask') {
        result.lineItems = this.buildFallbackLineItems(page, options.language, result.keyPoints);
      }

      return result;
    } catch (error) {
      console.error('File study explanation fallback used', error);
      return {
        pageNumber: page.pageNumber,
        title: this.buildFallbackTitle(page, options.mode),
        summary: this.buildFallbackSummary(page),
        keyPoints: this.fallbackKeyPoints(page),
        lineItems: options.mode === 'questions' || options.mode === 'ask' ? [] : this.buildFallbackLineItems(page, options.language),
        note: options.language === 'ar'
          ? 'تم استخدام شرح مبسط لأن توليد الشرح التفصيلي لم يكتمل لهذه الصفحة.'
          : 'A compact fallback explanation was used because the detailed explanation could not be generated for this page.',
        grounded: true,
        status: 'limited',
        mode: options.mode,
        question: options.userQuestion?.trim() || undefined
      };
    }
  }

  private buildLimitedTextFallback(page: FileStudyPage, mode: FileStudyExplainMode, language: FileStudyLanguage, question?: string): FileStudyExplanation {
    const summary = page.cleanedText.trim()
      ? page.cleanedText.trim().slice(0, 260)
      : language === 'ar'
        ? 'هذه الصفحة تحتوي نصًا مقروءًا محدودًا جدًا.'
        : 'This page has very limited readable text.';

    return {
      pageNumber: page.pageNumber,
      title: page.heading || `Page ${page.pageNumber}`,
      summary,
      keyPoints: page.bullets.length > 0 ? page.bullets.slice(0, 4) : [summary],
      lineItems: mode === 'questions' || mode === 'ask' ? [] : this.buildFallbackLineItems(page, language),
      note: language === 'ar'
        ? 'الصفحة الحالية لا تحتوي نصًا كافيًا لاستخراج شرح أوسع بشكل موثوق.'
        : 'The current page does not contain enough extracted text for a fuller explanation.',
      grounded: false,
      status: 'limited',
      mode,
      question: question?.trim() || undefined
    };
  }

  private buildFallbackTitle(page: FileStudyPage, mode: FileStudyExplainMode): string {
    if (mode === 'questions') {
      return page.heading ? `Questions from ${page.heading}` : `Questions from page ${page.pageNumber}`;
    }
    return page.heading || `Page ${page.pageNumber}`;
  }

  private buildFallbackSummary(page: FileStudyPage): string {
    if (!page.cleanedText.trim()) {
      return 'This page contains very limited readable text, so only a brief grounded summary is available.';
    }

    return page.cleanedText
      .split('\n')
      .slice(0, 3)
      .join(' ')
      .slice(0, 420);
  }

  private fallbackKeyPoints(page: FileStudyPage): string[] {
    if (page.bullets.length > 0) {
      return page.bullets.slice(0, 4);
    }

    return page.cleanedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 8)
      .slice(0, 4);
  }

  private resolveRequestLabel(mode: FileStudyExplainMode, userQuestion?: string): string {
    switch (mode) {
      case 'simple':
        return 'تبسيط';
      case 'detailed':
        return 'تفصيل أكثر';
      case 'questions':
        return 'أسئلة';
      case 'ask':
        return userQuestion?.trim() || 'سؤال حر متعلق بالصفحة';
      default:
        return 'شرح أساسي';
    }
  }

  private buildAcademicSlideSystemInstruction(language: FileStudyLanguage): string {
    if (language === 'ar') {
      return [
        'أنت الآن "Academic Slide Explainer" داخل منصة تعليمية احترافية.',
        'وظيفتك شرح محتوى صفحة واحدة فقط من ملف دراسي أو أكاديمي أو تدريبي أو تقني أو مهني بجودة عالية جدًا.',
        'أنت لا تعمل كمترجم، ولا كملخّص عام، ولا ككاتب إنشائي، بل كشارح أكاديمي دقيق.',
        'التزم التزامًا صارمًا بما يظهر في الصفحة الحالية فقط.',
        'ممنوع استخدام معلومات من صفحات أخرى أو من المعرفة العامة إلا إذا كانت إضافة قصيرة جدًا وضرورية فقط لتوضيح معنى مباشر.',
        'اشرح كل سطر أو bullet أو عنصر ظاهر في الصفحة بشرح مقابل واضح ومباشر.',
        'لا تدمج النقاط ولا تسقط أي نقطة.',
        'لا تكتب شرحًا عامًا للموضوع، ولا تكتفِ بإعادة الصياغة أو الترجمة.',
        'إذا كان النص ناقصًا أو غامضًا، قل ذلك بوضوح وباختصار داخل note.',
        'حافظ على الترتيب الأصلي للنقاط كما ظهرت في الصفحة.',
        'اضبط الأسلوب حسب المستوى المطلوب: مبسط أو متوسط أو عميق.',
        'في نمط "شرح أساسي": اشرح الصفحة كاملة نقطة بنقطة بفهم واضح ومباشر.',
        'في نمط "تبسيط": أعد شرح نفس النقاط بلغة أسهل دون إضافة أفكار جديدة.',
        'في نمط "تفصيل أكثر": وسّع شرح نفس النقاط فقط داخل حدود الصفحة.',
        'في نمط "أسئلة": أنشئ أسئلة ناتجة من نفس الصفحة فقط.',
        'في نمط "سؤال حر": أجب فقط على سؤال المستخدم بما يرتبط بالصفحة الحالية.',
        'أخرج JSON صالحًا فقط بالمفاتيح: title, summary, keyPoints, note.',
        'اجعل title عنوانًا قصيرًا جدًا يعبّر عن فكرة السلايد.',
        'اجعل summary تمهيدًا قصيرًا جدًا يوضح الفكرة المركزية للصفحة.',
        'اجعل keyPoints مصفوفة من 2 إلى 6 عناصر، وكل عنصر يمثل شرح نقطة واحدة أو سؤالًا واحدًا بحسب النمط.',
        'اجعل كل عنصر في keyPoints بصياغة تعليمية مباشرة ومريحة بصريًا.',
        'اشرح الفكرة والمعنى التعليمي لكل نقطة، ولا تترجم الجمل كلمة بكلمة.',
        'استخدم note فقط إذا كان النص محدودًا أو غامضًا أو إذا كان سؤال المستخدم يتجاوز ما تسمح به الصفحة.'
      ].join(' ');
    }

    return [
      'You are now "Academic Slide Explainer" inside a professional learning platform.',
      'Your job is to explain exactly one current page from an academic, technical, training, or professional document with high teaching quality.',
      'You are not a translator, not a generic summarizer, and not an essay writer.',
      'You are a precise academic explainer strictly grounded in the current page only.',
      'Do not use other pages or outside knowledge except for a very short clarification when absolutely necessary.',
      'Every visible line, bullet, or item on the page must have a clear matching explanation.',
      'Do not merge points and do not skip any point.',
      'Do not turn the slide into a broad article or generic topic explanation.',
      'If the page text is incomplete or ambiguous, say that briefly and clearly in note.',
      'Keep the original order of the page content.',
      'Adapt the tone to the requested level: simple, medium, or deep.',
      'For "Basic explanation", explain the full page point by point.',
      'For "Simplify", explain the same points in easier language without adding new ideas.',
      'For "More detail", expand the same points only, still within the page.',
      'For "Questions", create questions derived only from the current page.',
      'For "Free question", answer only the user question using the current page.',
      'Return valid JSON only with keys: title, summary, keyPoints, note.',
      'Make title a very short slide idea.',
      'Make summary a very short overview of the page focus.',
      'Make keyPoints an array of 2 to 6 items, where each item explains one page point or provides one question depending on the mode.',
      'Explain meaning and teaching value, not line-by-line literal translation.',
      'Use note only when the text is limited, ambiguous, or the user request goes beyond what the page supports.'
    ].join(' ');
  }

  private buildAcademicSlidePrompt(
    page: FileStudyPage,
    options: {
      documentId: string;
      pageNumber: number;
      language: FileStudyLanguage;
      explainStyle: FileStudyExplainStyle;
      mode: FileStudyExplainMode;
      userQuestion?: string;
    }
  ): string {
    const modeLabel = this.resolveRequestLabel(options.mode, options.userQuestion);
    const levelLabel = this.resolveExplanationLevelLabel(options.explainStyle, options.language);
    const languageLabel = options.language === 'ar' ? 'العربية' : 'English';
    const question = options.userQuestion?.trim() || null;
    const heading = page.heading || (options.language === 'ar' ? 'بدون عنوان واضح' : 'Untitled page');
    const contentLines = page.cleanedText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 24);

    const structuredInput = {
      pageNumber: page.pageNumber,
      explanationLanguage: languageLabel,
      explanationLevel: levelLabel,
      mode: modeLabel,
      userQuestion: question,
      heading,
      bullets: page.bullets,
      contentLines,
      cleanedText: contentLines.join(' ')
    };

    if (options.language === 'ar') {
      return [
        'استخدم بيانات الصفحة المنظمة التالية فقط، وفسّر المحتوى تعليميًا بدل ترجمته حرفيًا:',
        JSON.stringify(structuredInput, null, 2),
        '',
        'تعليمات الإخراج:',
        '- summary يجب أن يكون قصيرًا جدًا ويمهّد فقط لفكرة الصفحة.',
        '- keyPoints يجب أن تحافظ على ترتيب الصفحة الأصلي.',
        '- إذا كانت الصفحة تحتوي bullets، فليكن لكل bullet شرح مقابل وواضح.',
        '- إذا لم توجد bullets، استخدم contentLines كوحدات الشرح الأساسية.',
        '- إذا كان النمط "أسئلة"، اجعل keyPoints أسئلة قصيرة وواضحة من نفس الصفحة فقط.',
        '- إذا كان النمط "سؤال حر"، اجعل summary جوابًا مركزيًا قصيرًا واجعل keyPoints نقاط الجواب المباشرة المرتبطة بالصفحة.',
        '- لا تترجم الجمل حرفيًا ولا تعِد صياغتها كترجمة.',
        '- لا تخرج عن الصفحة الحالية.'
      ].join('\n');
    }

    return [
      'Use only the following structured page data, and explain the content pedagogically rather than translating it literally:',
      JSON.stringify(structuredInput, null, 2),
      '',
      'Output rules:',
      '- summary must stay very short and only introduce the page focus.',
      '- keyPoints must preserve the original page order.',
      '- If bullets exist, each bullet needs a matching explanation.',
      '- If no bullets exist, use contentLines as the explanation units.',
      '- If the mode is "Questions", make keyPoints short clear questions from this page only.',
      '- If the mode is "Free question", make summary the central answer and keyPoints the direct supporting points from this page.',
      '- Do not produce a literal translation.',
      '- Do not go beyond the current page.'
    ].join('\n');
  }

  private resolveExplanationLevelLabel(style: FileStudyExplainStyle, language: FileStudyLanguage): string {
    if (language === 'ar') {
      switch (style) {
        case 'simple':
          return 'مبسط';
        case 'deep':
          return 'عميق';
        default:
          return 'متوسط';
      }
    }

    switch (style) {
      case 'simple':
        return 'Simple';
      case 'deep':
        return 'Deep';
      default:
        return 'Medium';
    }
  }

  private buildExplanationCacheKey(options: {
    documentId: string;
    pageNumber: number;
    language: FileStudyLanguage;
    explainStyle: FileStudyExplainStyle;
    mode: FileStudyExplainMode;
    userQuestion?: string;
  }): string {
    const baseKey = [
      options.documentId,
      options.pageNumber,
      options.mode,
      options.language,
      options.explainStyle
    ].join('::');

    if (options.mode !== 'ask') {
      return baseKey;
    }

    return [baseKey, (options.userQuestion || '').trim().toLowerCase()].join('::');
  }

  private createDocumentId(file: File): string {
    const safeName = file.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'document';
    return `${safeName}-${file.size}-${file.lastModified}`;
  }

  private asNonEmptyString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private asLineItemArray(
    value: unknown,
    language: FileStudyLanguage
  ): Array<{ source: string; explanation: string; translation?: string }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const source = this.asNonEmptyString(record['source']);
        const explanation = this.asNonEmptyString(record['explanation']);
        const translation = this.asNonEmptyString(record['translation']) || undefined;
        if (!source || !explanation) {
          return null;
        }
        return { source, explanation, translation };
      })
      .filter(Boolean)
      .map(item => item as { source: string; explanation: string; translation?: string })
      .slice(0, language === 'ar' ? 12 : 10);
  }

  private buildFallbackLineItems(
    page: FileStudyPage,
    language: FileStudyLanguage,
    explanations: string[] = []
  ): Array<{ source: string; explanation: string; translation?: string }> {
    const sourceUnits = (page.bullets.length > 0 ? page.bullets : page.cleanedText.split('\n'))
      .map(line => line.trim())
      .filter(line => line.length > 3)
      .slice(0, 8);

    return sourceUnits.map((source, index) => ({
      source,
      explanation: explanations[index]
        || (language === 'ar'
          ? `شرح هذه النقطة: ${source}`
          : `Explanation of this point: ${source}`)
    }));
  }

  private extractReadableText(textContent: any): string {
    const items = Array.isArray(textContent?.items) ? textContent.items : [];
    const lines: string[] = [];
    let currentLine = '';
    let previousItem: { x: number; y: number; width: number; height: number; text: string; hasEOL: boolean } | null = null;

    for (const rawItem of items) {
      const text = typeof rawItem?.str === 'string' ? rawItem.str.replace(/\s+/g, ' ').trim() : '';
      if (!text) {
        if (rawItem?.hasEOL && currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = '';
          previousItem = null;
        }
        continue;
      }

      const item = this.toTextPosition(rawItem, text);
      const startsNewLine = !previousItem
        || item.y < previousItem.y - Math.max(previousItem.height * 0.8, 6)
        || Math.abs(item.y - previousItem.y) > Math.max(item.height * 0.6, 5)
        || item.x + 1 < previousItem.x;

      if (startsNewLine) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = text;
      } else {
        const gap = item.x - (previousItem.x + previousItem.width);
        currentLine += this.shouldInsertSpace(previousItem.text, text, gap, item.height) ? ` ${text}` : text;
      }

      previousItem = item;

      if (rawItem?.hasEOL) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = '';
        previousItem = null;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    return lines
      .map(line => line.replace(/\s+([,.;:!?])/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'))
      .join('\n');
  }

  private toTextPosition(rawItem: any, text: string): { x: number; y: number; width: number; height: number; text: string; hasEOL: boolean } {
    const transform = Array.isArray(rawItem?.transform) ? rawItem.transform : [1, 0, 0, 1, 0, 0];
    const x = Number(transform[4] || 0);
    const y = Number(transform[5] || 0);
    const width = Math.max(Number(rawItem?.width || 0), text.length * 2);
    const height = Math.max(Math.abs(Number(rawItem?.height || transform[3] || 0)), 8);

    return {
      x,
      y,
      width,
      height,
      text,
      hasEOL: Boolean(rawItem?.hasEOL)
    };
  }

  private shouldInsertSpace(previousText: string, currentText: string, gap: number, height: number): boolean {
    if (!previousText || !currentText) {
      return false;
    }

    if (/\s$/.test(previousText) || /^\s/.test(currentText)) {
      return false;
    }

    if (/[\-\/(]$/.test(previousText) || /^[,.;:!?%)\]]/.test(currentText)) {
      return false;
    }

    return gap > Math.max(height * 0.12, 1.5);
  }

  private async loadPdfJs(): Promise<any> {
    if (!this.pdfjsPromise) {
      this.pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then(pdfjs => {
        pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/build/pdf.worker.min.mjs';
        return pdfjs;
      });
    }

    return this.pdfjsPromise;
  }

  private buildPdfDocumentOptions(buffer: ArrayBuffer): Record<string, unknown> {
    return {
      data: new Uint8Array(buffer),
      cMapUrl: 'assets/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'assets/pdfjs/standard_fonts/',
      useSystemFonts: false,
      disableFontFace: true,
      useWorkerFetch: false
    };
  }
}
