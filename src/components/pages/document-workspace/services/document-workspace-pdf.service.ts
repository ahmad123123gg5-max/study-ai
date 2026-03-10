import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  GlobalWorkerOptions,
  Util,
  getDocument
} from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';
import { DEMO_DOCUMENT_PAGES, DemoDocumentSection } from '../document-workspace.data';
import {
  DocumentPageData,
  DocumentTextBlock,
  LoadedDocumentResource,
  WorkspaceSourceType
} from '../document-workspace.types';

const PDFJS_ASSET_BASE = 'assets/pdfjs';

GlobalWorkerOptions.workerSrc = `${PDFJS_ASSET_BASE}/build/pdf.worker.min.mjs`;

interface PositionedTextItem {
  id: string;
  text: string;
  direction: 'rtl' | 'ltr';
  language: 'ar' | 'en';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  rawY: number;
  rawX: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentWorkspacePdfService {
  async createDemoFile(): Promise<File> {
    return this.buildPdfFile('SmartEdge Clinical Primer.pdf', DEMO_DOCUMENT_PAGES);
  }

  async createSlidePlaceholder(file: File): Promise<File> {
    return this.buildPdfFile(`${file.name.replace(/\.[^/.]+$/, '')}.pdf`, [
      {
        eyebrow: 'Slide Import Placeholder',
        title: file.name,
        paragraphs: [
          'This workspace is prepared for slide-based study sessions, but real PowerPoint parsing is not connected yet.',
          'The current implementation generates a study-ready placeholder document so the student can still take notes, record audio, and preserve session state.',
          'Future integration can replace this generated page with converted slide images and extracted speaker text.'
        ],
        callout:
          'Next backend step: connect PPT or PPTX upload to a slide conversion pipeline, then feed the converted pages into the same workspace session model.'
      }
    ]);
  }

  async loadFile(file: File, sourceType: WorkspaceSourceType = 'pdf'): Promise<LoadedDocumentResource> {
    const buffer = await file.arrayBuffer();
    const task = getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: true,
      cMapUrl: `${PDFJS_ASSET_BASE}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_ASSET_BASE}/standard_fonts/`,
      useSystemFonts: true,
      disableFontFace: false,
      fontExtraProperties: true
    });
    const pdfDocument = await task.promise;
    const pages = await this.extractPages(pdfDocument);

    return {
      fileId: crypto.randomUUID(),
      fileName: file.name,
      sourceType,
      file,
      objectUrl: URL.createObjectURL(file),
      pdfDocument,
      pages,
      totalPages: pages.length
    };
  }

  async disposeResource(resource: LoadedDocumentResource | null) {
    if (!resource) {
      return;
    }
    try {
      await resource.pdfDocument.destroy();
    } catch (error) {
      console.warn('Failed to destroy PDF document cleanly', error);
    }
    if (resource.objectUrl) {
      URL.revokeObjectURL(resource.objectUrl);
    }
  }

  private async buildPdfFile(name: string, sections: DemoDocumentSection[]): Promise<File> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    sections.forEach((section, index) => {
      if (index > 0) {
        pdf.addPage();
      }

      pdf.setFillColor(245, 247, 251);
      pdf.rect(0, 0, 595, 842, 'F');
      pdf.setFillColor(30, 41, 59);
      pdf.roundedRect(40, 36, 515, 90, 18, 18, 'F');
      pdf.setTextColor(129, 140, 248);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(section.eyebrow.toUpperCase(), 64, 70);
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text(section.title, 64, 106);

      pdf.setTextColor(31, 41, 55);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(13.5);
      pdf.setLineHeightFactor(1.45);

      let cursorY = 180;
      for (const paragraph of section.paragraphs) {
        const lines = pdf.splitTextToSize(paragraph, 470);
        pdf.text(lines, 64, cursorY, { maxWidth: 470 });
        cursorY += lines.length * 18 + 22;
      }

      if (section.callout) {
        pdf.setFillColor(236, 253, 245);
        pdf.roundedRect(64, cursorY + 12, 470, 90, 20, 20, 'F');
        pdf.setTextColor(5, 150, 105);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('APPLIED EXAMPLE', 84, cursorY + 38);
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12.5);
        const calloutLines = pdf.splitTextToSize(section.callout, 420);
        pdf.text(calloutLines, 84, cursorY + 56);
      }
    });

    const blob = pdf.output('blob');
    return new File([blob], name, { type: 'application/pdf' });
  }

  private async extractPages(pdfDocument: LoadedDocumentResource['pdfDocument']): Promise<DocumentPageData[]> {
    const pages: DocumentPageData[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const blocks = this.extractBlocks(textContent, viewport, pageNumber);
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        summary: blocks.slice(0, 3).map((block) => block.text).join(' '),
        text: blocks.map((block) => block.text).join('\n'),
        blocks,
        viewport,
        textContent
      });
    }

    return pages;
  }

  private extractBlocks(
    textContent: TextContent,
    viewport: NonNullable<DocumentPageData['viewport']>,
    pageNumber: number
  ): DocumentTextBlock[] {
    const items = textContent.items
      .filter((item): item is TextItem => 'str' in item && item.str.trim().length > 0)
      .map((item, index) => this.positionTextItem(item, viewport, pageNumber, index))
      .sort((left, right) =>
        Math.abs(left.rawY - right.rawY) <= 4 ? left.rawX - right.rawX : left.rawY - right.rawY
      );

    const groups: PositionedTextItem[][] = [];
    items.forEach((item) => {
      let group: PositionedTextItem[] | undefined;
      for (let index = groups.length - 1; index >= 0; index -= 1) {
        const candidate = groups[index];
        if (Math.abs(candidate[0].rawY - item.rawY) <= Math.max(4, item.fontSize * 0.35)) {
          group = candidate;
          break;
        }
      }
      if (group) {
        group.push(item);
      } else {
        groups.push([item]);
      }
    });

    return groups.map((group, lineIndex) => {
      const direction = this.detectDirection(group.map((item) => item.text).join(' '));
      const ordered = [...group].sort((left, right) => (direction === 'rtl' ? right.rawX - left.rawX : left.rawX - right.rawX));
      const x = Math.min(...ordered.map((item) => item.x));
      const y = Math.min(...ordered.map((item) => item.y));
      const right = Math.max(...ordered.map((item) => item.x + item.width));
      const bottom = Math.max(...ordered.map((item) => item.y + item.height));
      return {
        id: `page-${pageNumber}-line-${lineIndex}`,
        text: this.joinTextFragments(ordered.map((item) => item.text), direction),
        language: direction === 'rtl' ? 'ar' : 'en',
        direction,
        x,
        y,
        width: right - x,
        height: bottom - y,
        fontSize: Math.max(...ordered.map((item) => item.fontSize)),
        lineIndex,
        readingOrder: lineIndex
      };
    });
  }

  private positionTextItem(
    item: TextItem,
    viewport: NonNullable<DocumentPageData['viewport']>,
    pageNumber: number,
    index: number
  ): PositionedTextItem {
    const transform = Util.transform(viewport.transform, item.transform);
    const fontSize = Math.max(10, Math.abs(transform[3]) || item.height || 12);
    const x = transform[4];
    const y = transform[5] - fontSize;
    const width = Math.max(item.width, item.str.length * fontSize * 0.35);

    return {
      id: `page-${pageNumber}-item-${index}`,
      text: item.str.replace(/\s+/g, ' ').trim(),
      language: this.detectDirection(item.str) === 'rtl' ? 'ar' : 'en',
      direction: this.detectDirection(item.str),
      x,
      y,
      width,
      height: fontSize * 1.15,
      fontSize,
      rawY: transform[5],
      rawX: transform[4]
    };
  }

  private joinTextFragments(parts: string[], direction: 'rtl' | 'ltr'): string {
    return parts.reduce((result, part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return result;
      }
      if (!result) {
        return trimmed;
      }
      if (/^[,.;:!?،؛؟)\]}]/.test(trimmed)) {
        return `${result}${trimmed}`;
      }
      if (/[([{/-]$/.test(result)) {
        return `${result}${trimmed}`;
      }
      if (direction === 'rtl' && /^[\u0660-\u0669\d%]/.test(trimmed) && /[\u0600-\u06FF]$/.test(result)) {
        return `${result} ${trimmed}`;
      }
      if (direction === 'ltr' && /^[A-Za-z]/.test(trimmed) && /[(/-]$/.test(result)) {
        return `${result}${trimmed}`;
      }
      return `${result} ${trimmed}`;
    }, '');
  }

  private detectDirection(text: string): 'rtl' | 'ltr' {
    return /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr';
  }
}
