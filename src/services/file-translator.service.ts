import { Injectable } from '@angular/core';

export type TranslatorFileType = 'pdf' | 'docx' | 'pptx';
export type TranslationMode = 'general' | 'academic' | 'medical';
export type ViewMode = 'line' | 'page' | 'slide';

export interface TranslationWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface TranslationUnit {
  id: string;
  order: number;
  groupIndex: number;
  kind: 'paragraph' | 'heading' | 'table' | 'textbox' | 'page' | 'bullet' | 'label';
  label: string;
  sourceText: string;
  translatedText: string;
  notes?: string[];
  tableData?: TranslationTableData;
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageWidth: number;
    pageHeight: number;
    lineCount?: number;
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface TranslationTableCell {
  sourceText: string;
  translatedText: string;
}

export interface TranslationTableData {
  headers: TranslationTableCell[][];
  rows: TranslationTableCell[][];
  columnCount: number;
}

export interface TranslationGroup {
  index: number;
  label: string;
  kind: 'page' | 'slide' | 'section';
  sourceText: string;
  translatedText: string;
  unitIds: string[];
}

export interface FileTranslationResult {
  documentId: string;
  fileName: string;
  fileType: TranslatorFileType;
  sourceLanguage: string;
  targetLanguage: string;
  translationMode: TranslationMode;
  viewMode: ViewMode;
  keepEnglishTerms: boolean;
  warnings: TranslationWarning[];
  units: TranslationUnit[];
  groups: TranslationGroup[];
  totalGroups: number;
  totalUnits: number;
  originalBufferBase64: string;
  sourceFingerprint?: string;
  glossaryVersion?: number;
  completedGroups?: number;
  isComplete?: boolean;
  cacheStatus?: 'miss' | 'partial' | 'full';
}

export interface FileTranslationRequest {
  fileName: string;
  mimeType: string;
  base64Data: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationMode: TranslationMode;
  keepEnglishTerms: boolean;
  viewMode: ViewMode;
  glossaryEntries: Array<{
    source: string;
    target: string;
  }>;
  ocrPageImages: Array<{
    pageNumber: number;
    dataUrl: string;
  }>;
  previewGroupLimit?: number;
}

export interface StreamingTranslationEvent {
  type: 'job_started' | 'progress' | 'warning' | 'group_ready' | 'complete' | 'cancelled' | 'error';
  stage?: string;
  stageLabel?: string;
  percent?: number;
  detail?: string;
  completedGroups?: number;
  totalGroups?: number;
  completedUnits?: number;
  totalUnits?: number;
  fromCache?: boolean;
  extractionCached?: boolean;
  translationCached?: boolean;
  result?: FileTranslationResult;
  group?: TranslationGroup;
  units?: TranslationUnit[];
  warning?: TranslationWarning;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class FileTranslatorService {
  async streamTranslate(
    request: FileTranslationRequest,
    handlers: {
      onEvent: (event: StreamingTranslationEvent) => void;
    },
    signal?: AbortSignal
  ): Promise<FileTranslationResult | null> {
    const response = await fetch('/api/file-translator/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      signal
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || 'Streaming translation failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Streaming response body is unavailable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: FileTranslationResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const event = JSON.parse(trimmed) as StreamingTranslationEvent;
        handlers.onEvent(event);
        if (event.type === 'complete' && event.result) {
          finalResult = event.result;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = JSON.parse(buffer.trim()) as StreamingTranslationEvent;
      handlers.onEvent(event);
      if (event.type === 'complete' && event.result) {
        finalResult = event.result;
      }
    }

    return finalResult;
  }

  async translate(request: FileTranslationRequest): Promise<FileTranslationResult> {
    const response = await fetch('/api/file-translator/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || 'File translation failed');
    }

    return response.json() as Promise<FileTranslationResult>;
  }

  async export(result: FileTranslationResult, format: 'translated' | 'bilingual'): Promise<{ fileName: string; mimeType: string; blob: Blob }> {
    const response = await fetch('/api/file-translator/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ result, format })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || 'Export failed');
    }

    const payload = await response.json() as {
      fileName: string;
      mimeType: string;
      base64Data: string;
    };

    return {
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      blob: this.base64ToBlob(payload.base64Data, payload.mimeType)
    };
  }

  async getGlossary(sourceLanguage: string, targetLanguage: string, domain: TranslationMode): Promise<{ version: number; entries: Array<{ source: string; target: string; notes?: string }> }> {
    const response = await fetch(`/api/file-translator/glossary?sourceLanguage=${encodeURIComponent(sourceLanguage)}&targetLanguage=${encodeURIComponent(targetLanguage)}&domain=${encodeURIComponent(domain)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || 'Failed to load glossary');
    }

    const payload = await response.json() as {
      version: number;
      entries: Array<{ source: string; target: string; notes?: string }>;
    };

    return payload;
  }

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = typeof reader.result === 'string' ? reader.result : '';
        resolve(value.split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async buildPdfOcrImages(file: File, maxPages: number = 12): Promise<Array<{ pageNumber: number; dataUrl: string }>> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/build/pdf.worker.min.mjs';
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: 'assets/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'assets/pdfjs/standard_fonts/'
    }).promise;

    const images: Array<{ pageNumber: number; dataUrl: string }> = [];

    try {
      const total = Math.min(document.numPages, maxPages);
      for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = documentCreateCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        if (!context) {
          continue;
        }
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        images.push({
          pageNumber,
          dataUrl: canvas.toDataURL('image/png', 0.92)
        });
      }
    } finally {
      await document.destroy();
    }

    return images;
  }

  downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private base64ToBlob(base64Data: string, mimeType: string): Blob {
    const raw = atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  }
}

function documentCreateCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
