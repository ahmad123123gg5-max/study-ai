import { createHash } from 'crypto';
import JSZip from 'jszip';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import { createOpenAIChatCompletionDetailed } from './openai/openai-client.js';
import {
  buildResultCacheKey,
  buildUnitCacheKey,
  ensureFileTranslatorStore,
  findRelevantGlossaryEntries,
  hashFileBuffer,
  loadExtractionCache,
  loadResultCache,
  loadUnitCache,
  markGlossaryUsage,
  saveExtractionCache,
  saveResultCache,
  saveUnitCache,
  upsertGlossaryEntries
} from './file-translator-store.js';

export type TranslatorFileType = 'pdf' | 'docx' | 'pptx';
export type TranslationMode = 'general' | 'academic' | 'medical';
export type ViewMode = 'line' | 'page' | 'slide';

export interface GlossaryEntry {
  source: string;
  target: string;
  notes?: string;
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
  glossaryEntries?: GlossaryEntry[];
  ocrPageImages?: Array<{
    pageNumber: number;
    dataUrl: string;
  }>;
  previewGroupLimit?: number;
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

export interface TranslationWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface TranslationResult {
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
  result?: TranslationResult;
  group?: TranslationGroup;
  units?: TranslationUnit[];
  warning?: TranslationWarning;
  error?: string;
}

interface ExtractionResult {
  fileType: TranslatorFileType;
  groups: TranslationGroup[];
  units: TranslationUnit[];
  warnings: TranslationWarning[];
}

interface StreamingHooks {
  onEvent?: (event: StreamingTranslationEvent) => void;
  isCancelled?: () => boolean;
}

interface TranslationContext {
  apiKey: string;
  model: string;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'"
};

class TranslationCancelledError extends Error {
  constructor() {
    super('Translation cancelled');
  }
}

const decodeXml = (value: string): string =>
  value
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] || entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeText = (value: string): string =>
  value
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const isCjkText = (value: string): boolean => /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
const isJoiningScriptText = (value: string): boolean => /[\u0590-\u08ff]/u.test(value);

const bucketPdfY = (value: number): number => Math.round(value / 2) * 2;

const shouldInsertSpaceBetweenPdfSegments = (
  previous: { text: string; x: number; width: number },
  current: { text: string; x: number; width: number }
): boolean => {
  if (!previous.text || !current.text) return false;
  if (/\s$/u.test(previous.text) || /^\s/u.test(current.text)) return false;
  if (/[-/([{'"`]\s*$/u.test(previous.text)) return false;
  if (/^[,.;:!?%)\]}،؛؟]/u.test(current.text)) return false;
  if (isCjkText(previous.text) || isCjkText(current.text)) return false;

  const previousRight = previous.x + Math.max(previous.width, 0);
  const gap = current.x - previousRight;

  if (gap > 3) return true;
  if (gap <= 0.75) return false;
  if (
    isJoiningScriptText(previous.text) &&
    isJoiningScriptText(current.text) &&
    previous.text.trim().length === 1 &&
    current.text.trim().length === 1
  ) {
    return false;
  }

  return previous.text.trim().length > 1 || current.text.trim().length > 1;
};

const joinPdfSegments = (segments: Array<{ text: string; x: number; width: number }>): string => {
  const sorted = [...segments].sort((a, b) => a.x - b.x);
  let combined = '';

  sorted.forEach((segment, index) => {
    const text = normalizeText(segment.text);
    if (!text) return;
    const previous = sorted[index - 1];
    if (combined && previous && shouldInsertSpaceBetweenPdfSegments(previous, segment)) {
      combined += ' ';
    }
    combined += text;
  });

  return normalizeText(combined);
};

interface PdfLineEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
}

interface PdfTextSegment {
  text: string;
  x: number;
  width: number;
  height: number;
}

interface PdfBlockEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  lineCount: number;
  fontSize: number;
  kind: TranslationUnit['kind'];
  textAlign: 'left' | 'center' | 'right';
}

interface PdfCellEntry {
  x: number;
  width: number;
  text: string;
}

interface PdfRowStructure {
  top: number;
  bottom: number;
  height: number;
  cells: PdfCellEntry[];
}

interface PdfTableStructure {
  rows: PdfRowStructure[];
  columnCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceText: string;
  tableData: TranslationTableData;
}

const isLikelyPdfListLine = (text: string): boolean =>
  /^\s*(?:[-*•▪◦‣]|\d+[\.\)]|[A-Za-z][\.\)])\s+/u.test(text);

const isLikelyPdfHeading = (text: string, fontSize: number, baselineFontSize: number): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length <= 80 && /^[A-Z0-9\s\-&,/:()]+$/u.test(trimmed) && trimmed.length > 4) return true;
  if (fontSize >= baselineFontSize * 1.18 && trimmed.length <= 140) return true;
  return false;
};

const classifyPdfBlock = (
  lines: PdfLineEntry[],
  baselineFontSize: number,
  pageWidth: number
): Pick<PdfBlockEntry, 'kind' | 'fontSize' | 'textAlign'> => {
  const text = normalizeText(lines.map((line) => line.text).join('\n'));
  const averageFontSize = lines.reduce((sum, line) => sum + line.fontSize, 0) / Math.max(lines.length, 1);
  const minX = Math.min(...lines.map((line) => line.x));
  const maxRight = Math.max(...lines.map((line) => line.x + line.width));
  const pageCenter = (minX + maxRight) / 2;

  if (isLikelyPdfHeading(text, averageFontSize, baselineFontSize)) {
    return {
      kind: 'heading',
      fontSize: averageFontSize,
      textAlign: Math.abs(pageCenter - pageWidth / 2) < Math.min(120, pageWidth * 0.15) ? 'center' : 'left'
    };
  }

  if (isLikelyPdfListLine(text)) {
    return {
      kind: 'bullet',
      fontSize: averageFontSize,
      textAlign: 'left'
    };
  }

  if (text.length <= 48 && lines.length === 1) {
    return {
      kind: 'label',
      fontSize: averageFontSize,
      textAlign: 'left'
    };
  }

  return {
    kind: 'paragraph',
    fontSize: averageFontSize,
    textAlign: 'left'
  };
};

const buildPdfRowCells = (segments: PdfTextSegment[]): PdfCellEntry[] => {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => a.x - b.x);
  const cells: Array<{ segments: PdfTextSegment[] }> = [];

  for (const segment of sorted) {
    const previousCell = cells[cells.length - 1];
    const previousSegment = previousCell?.segments[previousCell.segments.length - 1];
    const previousRight = previousSegment ? previousSegment.x + previousSegment.width : segment.x;
    const gap = segment.x - previousRight;
    const gapThreshold = Math.max(16, Math.min(44, Math.max(segment.height, previousSegment?.height || segment.height) * 1.15));

    if (!previousCell || gap > gapThreshold) {
      cells.push({ segments: [segment] });
      continue;
    }

    previousCell.segments.push(segment);
  }

  return cells
    .map((cell) => {
      const x = Math.min(...cell.segments.map((segment) => segment.x));
      const maxRight = Math.max(...cell.segments.map((segment) => segment.x + segment.width));
      return {
        x,
        width: Math.max(24, maxRight - x),
        text: joinPdfSegments(cell.segments)
      };
    })
    .filter((cell) => cell.text);
};

const buildPdfStructuredRows = (
  rowsByY: Array<[number, PdfTextSegment[]]>,
  viewportHeight: number
): PdfRowStructure[] =>
  rowsByY
    .sort((a, b) => b[0] - a[0])
    .map(([rawY, segments]) => {
      const maxHeight = Math.max(...segments.map((segment) => Math.max(segment.height, 12)));
      const top = Math.max(0, viewportHeight - rawY - maxHeight - 4);
      return {
        top,
        bottom: top + Math.max(16, maxHeight + 4),
        height: Math.max(16, maxHeight + 4),
        cells: buildPdfRowCells(segments)
      };
    })
    .filter((row) => row.cells.length >= 2);

const rowsLookTableCompatible = (current: PdfRowStructure, next: PdfRowStructure): boolean => {
  const currentCount = current.cells.length;
  const nextCount = next.cells.length;
  if (currentCount < 2 || nextCount < 2) return false;
  if (Math.abs(currentCount - nextCount) > 1) return false;

  const comparableCount = Math.min(currentCount, nextCount);
  let alignedCells = 0;

  for (let index = 0; index < comparableCount; index += 1) {
    const currentCell = current.cells[index];
    const nextCell = next.cells[index];
    if (Math.abs(currentCell.x - nextCell.x) <= 26) {
      alignedCells += 1;
    }
  }

  const verticalGap = next.top - current.bottom;
  return alignedCells >= Math.max(2, comparableCount - 1) && verticalGap <= Math.max(28, current.height * 1.35);
};

const clusterPdfColumnAnchors = (rows: PdfRowStructure[]): number[] => {
  const anchors: Array<{ value: number; count: number }> = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      const anchor = anchors.find((entry) => Math.abs(entry.value - cell.x) <= 26);
      if (anchor) {
        anchor.value = (anchor.value * anchor.count + cell.x) / (anchor.count + 1);
        anchor.count += 1;
      } else {
        anchors.push({ value: cell.x, count: 1 });
      }
    }
  }

  return anchors
    .sort((a, b) => a.value - b.value)
    .map((entry) => entry.value);
};

const mapPdfRowToColumns = (row: PdfRowStructure, columnAnchors: number[], columnCount: number): TranslationTableCell[] => {
  const mapped = Array.from({ length: columnCount }, () => ({ sourceText: '', translatedText: '' }));
  for (const cell of row.cells) {
    let closestColumn = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    columnAnchors.forEach((anchor, index) => {
      const distance = Math.abs(anchor - cell.x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestColumn = index;
      }
    });
    const existing = mapped[closestColumn];
    mapped[closestColumn] = {
      sourceText: existing.sourceText ? `${existing.sourceText}\n${cell.text}` : cell.text,
      translatedText: ''
    };
  }
  return mapped;
};

const detectPdfTables = (rows: PdfRowStructure[]): PdfTableStructure[] => {
  if (rows.length < 2) return [];

  const tables: PdfTableStructure[] = [];
  let index = 0;

  while (index < rows.length - 1) {
    const start = index;
    if (!rowsLookTableCompatible(rows[index], rows[index + 1])) {
      index += 1;
      continue;
    }

    const tableRows = [rows[index], rows[index + 1]];
    index += 2;

    while (index < rows.length && rowsLookTableCompatible(tableRows[tableRows.length - 1], rows[index])) {
      tableRows.push(rows[index]);
      index += 1;
    }

    if (tableRows.length < 2) {
      index = start + 1;
      continue;
    }

    const columnAnchors = clusterPdfColumnAnchors(tableRows);
    const columnCount = Math.max(2, columnAnchors.length);
    const mappedRows = tableRows.map((row) => mapPdfRowToColumns(row, columnAnchors, columnCount));
    const firstRowLooksLikeHeader = mappedRows[0].every((cell) => cell.sourceText.length > 0 && cell.sourceText.length <= 64);
    const headers = firstRowLooksLikeHeader ? [mappedRows[0]] : [];
    const bodyRows = firstRowLooksLikeHeader ? mappedRows.slice(1) : mappedRows;

    const minX = Math.min(...tableRows.flatMap((row) => row.cells.map((cell) => cell.x)));
    const maxRight = Math.max(...tableRows.flatMap((row) => row.cells.map((cell) => cell.x + cell.width)));
    const top = Math.min(...tableRows.map((row) => row.top));
    const bottom = Math.max(...tableRows.map((row) => row.bottom));

    tables.push({
      rows: tableRows,
      columnCount,
      x: Math.max(0, minX - 4),
      y: Math.max(0, top - 4),
      width: Math.max(120, maxRight - minX + 8),
      height: Math.max(40, bottom - top + 8),
      sourceText: normalizeText(mappedRows.map((row) => row.map((cell) => cell.sourceText).join(' | ')).join('\n')),
      tableData: {
        headers,
        rows: bodyRows,
        columnCount
      }
    });
  }

  return tables;
};

const groupPdfLinesIntoBlocks = (lines: PdfLineEntry[], pageWidth: number): PdfBlockEntry[] => {
  if (!lines.length) return [];

  const baselineFontSize = [...lines]
    .map((line) => line.fontSize)
    .sort((a, b) => a - b)[Math.floor(lines.length / 2)] || 14;

  const blocks: PdfBlockEntry[] = [];
  let currentLines: PdfLineEntry[] = [];

  const pushBlock = () => {
    if (!currentLines.length) return;
    const minX = Math.min(...currentLines.map((line) => line.x));
    const minY = Math.min(...currentLines.map((line) => line.y));
    const maxRight = Math.max(...currentLines.map((line) => line.x + line.width));
    const maxBottom = Math.max(...currentLines.map((line) => line.y + line.height));
    const blockText = normalizeText(currentLines.map((line) => line.text).join('\n'));
    const classification = classifyPdfBlock(currentLines, baselineFontSize, pageWidth);

    blocks.push({
      x: Math.max(0, minX - 4),
      y: Math.max(0, minY - 2),
      width: Math.min(pageWidth - Math.max(0, minX - 4), Math.max(80, maxRight - minX + 8)),
      height: Math.max(20, maxBottom - minY + 4),
      text: blockText,
      lineCount: currentLines.length,
      kind: classification.kind,
      fontSize: classification.fontSize,
      textAlign: classification.textAlign
    });

    currentLines = [];
  };

  for (const line of lines) {
    if (!currentLines.length) {
      currentLines.push(line);
      continue;
    }

    const previous = currentLines[currentLines.length - 1];
    const blockStartX = Math.min(...currentLines.map((entry) => entry.x));
    const verticalGap = line.y - (previous.y + previous.height);
    const indentShift = Math.abs(line.x - blockStartX);
    const similarHeight = Math.abs(line.fontSize - previous.fontSize) <= Math.max(2.4, previous.fontSize * 0.2);
    const compactGap = verticalGap <= Math.max(10, previous.height * 0.72);
    const isListBoundary = isLikelyPdfListLine(line.text) || isLikelyPdfListLine(previous.text);
    const shouldContinueParagraph =
      compactGap &&
      indentShift <= Math.max(30, pageWidth * 0.025) &&
      similarHeight &&
      !isListBoundary &&
      previous.text.trim().length > 0;

    if (!shouldContinueParagraph) {
      pushBlock();
    }

    currentLines.push(line);
  }

  pushBlock();
  return blocks;
};

const buildDocumentId = (buffer: Buffer, fileName: string): string =>
  createHash('sha1').update(fileName).update(buffer).digest('hex').slice(0, 16);

const inferFileType = (fileName: string, mimeType: string): TranslatorFileType | null => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mimeType.includes('wordprocessingml.document') || ext === 'docx') return 'docx';
  if (mimeType.includes('presentationml.presentation') || ext === 'pptx') return 'pptx';
  return null;
};

const parseJsonSafely = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    const block = value.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (!block?.[1]) return null;
    try {
      return JSON.parse(block[1]) as T;
    } catch {
      return null;
    }
  }
};

const isCompleteTranslationResult = (result: TranslationResult | null | undefined): result is TranslationResult => {
  if (!result) return false;
  const groupCount = Array.isArray(result.groups) ? result.groups.length : 0;
  const unitCount = Array.isArray(result.units) ? result.units.length : 0;
  if (!groupCount || !unitCount) return false;
  if ((result.isComplete ?? true) === false) return false;
  if ((result.totalGroups || groupCount) > groupCount) return false;
  if ((result.totalUnits || unitCount) > unitCount) return false;
  if ((result.completedGroups || groupCount) < (result.totalGroups || groupCount)) return false;
  return true;
};

const emitEvent = (hooks: StreamingHooks, event: StreamingTranslationEvent): void => {
  hooks.onEvent?.(event);
};

const assertNotCancelled = (hooks: StreamingHooks): void => {
  if (hooks.isCancelled?.()) {
    throw new TranslationCancelledError();
  }
};

const extractTexts = (xml: string, tagPattern: RegExp): string[] =>
  [...xml.matchAll(tagPattern)].map((match) => decodeXml(match[1] || '')).filter((value) => value.trim().length > 0);

const createTextParagraph = (
  text: string,
  rtl: boolean,
  headingLevel?: (typeof HeadingLevel)[keyof typeof HeadingLevel]
): Paragraph =>
  new Paragraph({
    bidirectional: rtl,
    heading: headingLevel,
    alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [new TextRun({ text, size: 24, font: 'Arial' })],
    spacing: { after: 180, line: 320 }
  });

const chunkUnits = (units: TranslationUnit[]): TranslationUnit[][] => {
  const chunks: TranslationUnit[][] = [];
  let current: TranslationUnit[] = [];
  let currentChars = 0;
  for (const unit of units) {
    const nextChars = unit.sourceText.length;
    if (current.length >= 6 || currentChars + nextChars > 2800) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(unit);
    currentChars += nextChars;
  }
  if (current.length) chunks.push(current);
  return chunks;
};

const buildTranslationPrompt = (
  request: FileTranslationRequest,
  priorContext: string,
  glossaryLines: string
): string => {
  const modeGuide =
    request.translationMode === 'medical'
      ? 'Translate with expert medical and academic accuracy. Preserve clinical meaning, terminology, abbreviations, dosages, units, diagnostic nuance, and document structure exactly.'
      : request.translationMode === 'academic'
        ? 'Translate with formal academic precision. Preserve terminology, hierarchy, line order, list structure, and document meaning exactly.'
        : 'Translate exactly for professional use. Preserve structure, order, formatting intent, and meaning without adding explanations.';

  return [
    modeGuide,
    'Translate exactly. Do not explain. Do not summarize. Preserve structure and meaning.',
    'Translate exactly. Preserve table structure. Translate each table cell independently.',
    'Do not simplify. Do not paraphrase beyond what is required for an accurate translation.',
    'Maintain consistency across pages, slides, sections, headings, lists, and short labels.',
    'Preserve line order, section order, headings, bullets, tables, and short standalone terms as the same type of content.',
    'If the source item is a heading, keep it a heading. If it is a bullet, keep it a bullet. If it is a short label, keep it a short label.',
    'Never convert labels, names, theories, or short technical terms into badges, commentary, or explanatory text.',
    request.keepEnglishTerms
      ? 'Retain important English terms in parentheses when that improves precision, especially for medical or technical terminology.'
      : 'Do not overuse English parentheses. Use them only when meaning would be weakened without them.',
    'Preserve numbers, units, abbreviations, drug names, lab values, and medical shorthand exactly when appropriate.',
    'If a source item is a short title, label, bullet, or caption, translate it as a short title, label, bullet, or caption. Never turn short terms into commentary.',
    'Use academically and medically accepted terminology when applicable, while staying faithful to the source.',
    'Do not add any information that is not present in the source.',
    `Source language: ${request.sourceLanguage}.`,
    `Target language: ${request.targetLanguage}.`,
    priorContext ? `Recent translated context:\n${priorContext}` : '',
    glossaryLines ? `Relevant glossary and translation memory:\n${glossaryLines}` : '',
    'Return strict JSON: {"items":[{"id":"...", "translatedText":"...", "notes":["..."]}]} with the same ids.'
  ].filter(Boolean).join('\n\n');
};

const summarizeContext = (translatedUnits: TranslationUnit[]): string =>
  translatedUnits.slice(-5).map((unit) => `${unit.label}: ${unit.translatedText.slice(0, 220)}`).join('\n');

const buildGlossaryLines = (entries: Array<{ source: string; target: string; notes?: string }>): string =>
  entries.slice(0, 30).map((entry) => `${entry.source} => ${entry.target}${entry.notes ? ` (${entry.notes})` : ''}`).join('\n');

async function runVisionOcr(dataUrl: string, request: FileTranslationRequest, context: TranslationContext): Promise<string> {
  const imageUrl = dataUrl.startsWith('data:') ? dataUrl : `data:image/png;base64,${dataUrl}`;
  const result = await createOpenAIChatCompletionDetailed({
    apiKey: context.apiKey,
    model: context.model,
    temperature: 0,
    maxTokens: 2400,
    messages: [
      {
        role: 'system',
        content: 'Extract all readable text from this document image with OCR precision. Preserve line order, numbers, units, abbreviations, headings, and table-like structure. Return plain text only.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `The source language is ${request.sourceLanguage}. Extract the document text faithfully.` },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ]
  });
  return normalizeText(result.text);
}

async function extractPdfPage(
  pdf: any,
  pageNumber: number,
  request: FileTranslationRequest,
  context: TranslationContext
): Promise<{ group: TranslationGroup; units: TranslationUnit[]; warnings: TranslationWarning[] }> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const lines = new Map<number, PdfTextSegment[]>();
  for (const item of content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>) {
    const raw = typeof item?.str === 'string' ? item.str : '';
    const text = normalizeText(raw);
    if (!text) continue;
    const x = Array.isArray(item.transform) ? Number(item.transform[4] || 0) : 0;
    const y = Array.isArray(item.transform) ? bucketPdfY(Number(item.transform[5] || 0)) : 0;
    const width = typeof item.width === 'number' ? item.width : 0;
    const height = typeof item.height === 'number'
      ? item.height
      : Array.isArray(item.transform)
        ? Math.abs(Number(item.transform[3] || 0))
        : 14;
    const existing = lines.get(y) || [];
    existing.push({ text, x, width, height });
    lines.set(y, existing);
  }

  const structuredRows = buildPdfStructuredRows([...lines.entries()], viewport.height);
  const detectedTables = detectPdfTables(structuredRows);
  const tableRowTops = new Set(
    detectedTables.flatMap((table) => table.rows.map((row) => Math.round(row.top)))
  );

  const lineEntries = [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, segments]) => {
      const minX = Math.min(...segments.map((segment) => segment.x));
      const maxRight = Math.max(...segments.map((segment) => segment.x + Math.max(segment.width, 0)));
      const maxHeight = Math.max(...segments.map((segment) => Math.max(segment.height, 12)));
      const top = Math.max(0, viewport.height - y - maxHeight - 4);
      return {
        y: top,
        x: minX,
        width: Math.max(40, maxRight - minX),
        height: Math.max(16, maxHeight + 4),
        text: joinPdfSegments(segments),
        fontSize: maxHeight
      };
    })
    .filter((entry) => entry.text && !tableRowTops.has(Math.round(entry.y)));

  const blockEntries = groupPdfLinesIntoBlocks(
    lineEntries,
    viewport.width
  );

  let pageText = normalizeText([
    ...blockEntries.map((entry) => entry.text),
    ...detectedTables.map((table) => table.sourceText)
  ].join('\n\n'));

  const warnings: TranslationWarning[] = [];
  if (!pageText && request.ocrPageImages?.length) {
    const ocr = request.ocrPageImages.find((entry) => entry.pageNumber === pageNumber);
    if (ocr?.dataUrl) {
      pageText = await runVisionOcr(ocr.dataUrl, request, context);
      warnings.push({
        code: 'pdf-ocr',
        message: `OCR was used for page ${pageNumber}. Accuracy may be affected by scan quality.`,
        severity: 'warning'
      });
    }
  }

  if (!pageText) {
    warnings.push({
      code: 'pdf-page-empty',
      message: `No readable text was detected on page ${pageNumber}.`,
      severity: 'warning'
    });
    pageText = `[Page ${pageNumber} contained no directly extractable text.]`;
  }

  const pageItems = [
    ...blockEntries.map((entry) => ({
      y: entry.y,
      createUnit: (itemNumber: number): TranslationUnit => ({
        id: `page-${pageNumber}-block-${itemNumber}`,
        order: pageNumber * 1000 + itemNumber,
        groupIndex: pageNumber,
        kind: entry.kind,
        label: entry.kind === 'heading' ? `Page ${pageNumber} heading ${itemNumber}` : `Page ${pageNumber} block ${itemNumber}`,
        sourceText: entry.text,
        translatedText: '',
        layout: {
          x: entry.x,
          y: entry.y,
          width: Math.min(viewport.width, entry.width),
          height: entry.height,
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          lineCount: entry.lineCount,
          fontSize: entry.fontSize,
          textAlign: entry.textAlign
        }
      })
    })),
    ...detectedTables.map((table) => ({
      y: table.y,
      createUnit: (itemNumber: number): TranslationUnit => ({
        id: `page-${pageNumber}-table-${itemNumber}`,
        order: pageNumber * 1000 + itemNumber,
        groupIndex: pageNumber,
        kind: 'table' as const,
        label: `Page ${pageNumber} table ${itemNumber}`,
        sourceText: table.sourceText,
        translatedText: '',
        tableData: table.tableData,
        layout: {
          x: table.x,
          y: table.y,
          width: Math.min(viewport.width, table.width),
          height: table.height,
          pageWidth: viewport.width,
          pageHeight: viewport.height,
          lineCount: table.rows.length,
          fontSize: 0,
          textAlign: 'left'
        }
      })
    }))
  ].sort((a, b) => a.y - b.y);

  const lineUnits = pageItems.map((item, index) => item.createUnit(index + 1));

  const units = lineUnits.length > 0
    ? lineUnits
    : [{
        id: `page-${pageNumber}`,
        order: pageNumber * 1000,
        groupIndex: pageNumber,
        kind: 'page' as const,
        label: `Page ${pageNumber}`,
        sourceText: pageText,
        translatedText: ''
      }];

  return {
    group: {
      index: pageNumber,
      label: `Page ${pageNumber}`,
      kind: 'page',
      sourceText: pageText,
      translatedText: '',
      unitIds: units.map((unit) => unit.id)
    },
    units,
    warnings
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('DOCX parsing failed: missing word/document.xml');
  }

  const bodyXml = documentXml.match(/<w:body[\s\S]*?>([\s\S]*?)<\/w:body>/)?.[1] || documentXml;
  const blockMatches = [...bodyXml.matchAll(/(<w:tbl\b[\s\S]*?<\/w:tbl>)|(<w:p\b[\s\S]*?<\/w:p>)/g)];
  const groups: TranslationGroup[] = [];
  const units: TranslationUnit[] = [];
  let currentGroupIds: string[] = [];
  let currentGroupTexts: string[] = [];
  let currentSectionIndex = 1;
  let order = 0;

  const pushGroup = () => {
    if (!currentGroupIds.length) return;
    groups.push({
      index: currentSectionIndex,
      label: `Section ${currentSectionIndex}`,
      kind: 'section',
      sourceText: normalizeText(currentGroupTexts.join('\n\n')),
      translatedText: '',
      unitIds: [...currentGroupIds]
    });
    currentSectionIndex += 1;
    currentGroupIds = [];
    currentGroupTexts = [];
  };

  for (const block of blockMatches) {
    const xml = block[0];
    if (xml.startsWith('<w:tbl')) {
      const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
        .map((row) => [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)]
          .map((cell) => extractTexts(cell[0], /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g).join(' ').trim())
          .filter(Boolean))
        .filter((row) => row.length > 0);
      if (!rows.length) continue;
      const text = rows.map((row) => row.join(' | ')).join('\n');
      const id = `docx-table-${order + 1}`;
      const firstRowLooksLikeHeader = rows.length > 1 && rows[0].every((cell) => cell.length > 0 && cell.length <= 64);
      const headerRows = firstRowLooksLikeHeader ? [rows[0]] : [];
      const bodyRows = firstRowLooksLikeHeader ? rows.slice(1) : rows;
      units.push({
        id,
        order: order += 1,
        groupIndex: currentSectionIndex,
        kind: 'table',
        label: `Table ${order}`,
        sourceText: text,
        translatedText: '',
        tableData: {
          columnCount: Math.max(...rows.map((row) => row.length)),
          headers: headerRows.map((row) => row.map((cell) => ({ sourceText: cell, translatedText: '' }))),
          rows: bodyRows.map((row) => row.map((cell) => ({ sourceText: cell, translatedText: '' })))
        }
      });
      currentGroupIds.push(id);
      currentGroupTexts.push(text);
      continue;
    }

    const text = normalizeText(extractTexts(xml, /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g).join(' '));
    if (!text) continue;
    const style = (xml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] || '').toLowerCase();
    const isHeading = style.startsWith('heading');
    const id = `docx-${order + 1}`;
    units.push({
      id,
      order: order += 1,
      groupIndex: currentSectionIndex,
      kind: isHeading ? 'heading' : 'paragraph',
      label: isHeading ? `Heading ${order}` : `Paragraph ${order}`,
      sourceText: text,
      translatedText: ''
    });
    if (isHeading && currentGroupIds.length > 0) pushGroup();
    currentGroupIds.push(id);
    currentGroupTexts.push(text);
    if (currentGroupIds.length >= 8) pushGroup();
  }

  pushGroup();
  return { fileType: 'docx', groups, units, warnings: [] };
}

async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0));

  const groups: TranslationGroup[] = [];
  const units: TranslationUnit[] = [];
  let order = 0;

  for (const slideName of slideNames) {
    const slideIndex = Number(slideName.match(/slide(\d+)\.xml/i)?.[1] || 0);
    const slideXml = await zip.file(slideName)?.async('string');
    if (!slideXml) continue;
    const shapes = [...slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)];
    const groupUnitIds: string[] = [];
    const sourceParts: string[] = [];
    let shapeIndex = 1;
    for (const shape of shapes) {
      const text = normalizeText(extractTexts(shape[0], /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g).join(' '));
      if (!text) {
        shapeIndex += 1;
        continue;
      }
      const id = `slide-${slideIndex}-shape-${shapeIndex}`;
      units.push({
        id,
        order: order += 1,
        groupIndex: slideIndex,
        kind: 'textbox',
        label: `Slide ${slideIndex} - Text ${shapeIndex}`,
        sourceText: text,
        translatedText: ''
      });
      groupUnitIds.push(id);
      sourceParts.push(text);
      shapeIndex += 1;
    }
    groups.push({
      index: slideIndex,
      label: `Slide ${slideIndex}`,
      kind: 'slide',
      sourceText: normalizeText(sourceParts.join('\n\n')),
      translatedText: '',
      unitIds: groupUnitIds
    });
  }

  return {
    fileType: 'pptx',
    groups,
    units,
    warnings: groups.length ? [] : [{
      code: 'pptx-empty',
      message: 'No translatable slide text boxes were found in this presentation.',
      severity: 'warning'
    }]
  };
}

async function translateChunk(
  chunk: TranslationUnit[],
  request: FileTranslationRequest,
  context: TranslationContext,
  completedUnits: TranslationUnit[],
  glossaryLines: string
): Promise<Map<string, { translatedText: string; notes?: string[] }>> {
  const result = await createOpenAIChatCompletionDetailed({
    apiKey: context.apiKey,
    model: context.model,
    temperature: request.translationMode === 'medical' ? 0.1 : 0.2,
    maxTokens: 3600,
    messages: [
      {
        role: 'system',
        content: buildTranslationPrompt(request, summarizeContext(completedUnits), glossaryLines)
      },
      {
        role: 'user',
        content: JSON.stringify({
          items: chunk.map((unit) => ({
            id: unit.id,
            label: unit.label,
            sourceText: unit.sourceText
          }))
        })
      }
    ]
  });

  const parsed = parseJsonSafely<{ items?: Array<{ id?: string; translatedText?: string; notes?: string[] }> }>(result.text);
  if (!parsed?.items?.length) {
    throw new Error('Translation parsing failed: no valid JSON response was returned.');
  }

  return new Map(
    parsed.items
      .filter((item) => typeof item.id === 'string' && typeof item.translatedText === 'string')
      .map((item) => [item.id as string, {
        translatedText: normalizeText(item.translatedText as string),
        notes: Array.isArray(item.notes) ? item.notes.filter((note): note is string => typeof note === 'string') : []
      }])
  );
}

const mergeGroupTranslation = (group: TranslationGroup, units: TranslationUnit[]): TranslationGroup => ({
  ...group,
  translatedText: normalizeText(
    group.unitIds
      .map((unitId) => units.find((unit) => unit.id === unitId)?.translatedText || '')
      .join('\n\n')
  )
});

async function streamDocxOrPptxExtraction(
  buffer: Buffer,
  fileType: Exclude<TranslatorFileType, 'pdf'>
): Promise<ExtractionResult> {
  return fileType === 'docx' ? extractDocx(buffer) : extractPptx(buffer);
}

async function translateGroup(
  sourceUnits: TranslationUnit[],
  request: FileTranslationRequest,
  context: TranslationContext,
  glossaryVersion: number,
  completedUnits: TranslationUnit[]
): Promise<{ units: TranslationUnit[]; translationCached: boolean }> {
  const relevantGlossary = await findRelevantGlossaryEntries(
    request.sourceLanguage,
    request.targetLanguage,
    request.translationMode,
    sourceUnits.map((unit) => unit.sourceText).join('\n')
  );
  const combinedGlossaryEntries = [
    ...relevantGlossary.entries.map((entry) => ({ source: entry.source, target: entry.target, notes: entry.notes })),
    ...(request.glossaryEntries || [])
  ];
  const glossaryLines = buildGlossaryLines(combinedGlossaryEntries);
  const usedGlossaryIds = relevantGlossary.entries.map((entry) => entry.id);

  const translateLinearUnits = async (
    units: TranslationUnit[]
  ): Promise<{ units: TranslationUnit[]; allCached: boolean }> => {
    const translated: TranslationUnit[] = [];
    const uncached: TranslationUnit[] = [];
    let cacheHits = 0;

    for (const unit of units) {
      const cacheKey = buildUnitCacheKey(unit.sourceText, {
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        translationMode: request.translationMode,
        keepEnglishTerms: request.keepEnglishTerms,
        glossaryVersion
      });
      const cached = await loadUnitCache(cacheKey);
      if (cached?.translatedText) {
        const cachedUnit = { ...unit, translatedText: cached.translatedText, notes: cached.notes || [] };
        translated.push(cachedUnit);
        completedUnits.push(cachedUnit);
        cacheHits += 1;
      } else {
        uncached.push(unit);
      }
    }

    for (const chunk of chunkUnits(uncached)) {
      try {
        const translatedMap = await translateChunk(chunk, request, context, completedUnits, glossaryLines);
        for (const unit of chunk) {
          const mapped = translatedMap.get(unit.id);
          if (!mapped?.translatedText) {
            throw new Error(`Missing translated text for ${unit.label}`);
          }
          const translatedUnit: TranslationUnit = {
            ...unit,
            translatedText: mapped.translatedText,
            notes: mapped.notes || []
          };
          translated.push(translatedUnit);
          completedUnits.push(translatedUnit);
          const cacheKey = buildUnitCacheKey(unit.sourceText, {
            sourceLanguage: request.sourceLanguage,
            targetLanguage: request.targetLanguage,
            translationMode: request.translationMode,
            keepEnglishTerms: request.keepEnglishTerms,
            glossaryVersion
          });
          await saveUnitCache(cacheKey, {
            translatedText: translatedUnit.translatedText,
            notes: translatedUnit.notes
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Translation failed for this chunk.';
        for (const unit of chunk) {
          const fallback: TranslationUnit = {
            ...unit,
            translatedText: `[Translation incomplete]\n${unit.sourceText}`,
            notes: [message]
          };
          translated.push(fallback);
          completedUnits.push(fallback);
        }
      }
    }

    return {
      units: translated.sort((a, b) => a.order - b.order),
      allCached: cacheHits === units.length && units.length > 0
    };
  };

  const translateTableUnit = async (unit: TranslationUnit): Promise<{ unit: TranslationUnit; allCached: boolean }> => {
    if (!unit.tableData) {
      const translated = await translateLinearUnits([unit]);
      return { unit: translated.units[0], allCached: translated.allCached };
    }

    const cellUnits: TranslationUnit[] = [];
    unit.tableData.headers.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (!cell.sourceText.trim()) return;
        cellUnits.push({
          id: `${unit.id}-h-${rowIndex}-${columnIndex}`,
          order: unit.order * 100 + rowIndex * 10 + columnIndex,
          groupIndex: unit.groupIndex,
          kind: 'label',
          label: `${unit.label} header ${rowIndex + 1}:${columnIndex + 1}`,
          sourceText: cell.sourceText,
          translatedText: ''
        });
      });
    });
    unit.tableData.rows.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (!cell.sourceText.trim()) return;
        cellUnits.push({
          id: `${unit.id}-r-${rowIndex}-${columnIndex}`,
          order: unit.order * 1000 + rowIndex * 10 + columnIndex,
          groupIndex: unit.groupIndex,
          kind: 'paragraph',
          label: `${unit.label} row ${rowIndex + 1}:${columnIndex + 1}`,
          sourceText: cell.sourceText,
          translatedText: ''
        });
      });
    });

    const translatedCells = await translateLinearUnits(cellUnits);
    const translatedMap = new Map(translatedCells.units.map((cell) => [cell.id, cell.translatedText]));

    const translatedTableData: TranslationTableData = {
      columnCount: unit.tableData.columnCount,
      headers: unit.tableData.headers.map((row, rowIndex) =>
        row.map((cell, columnIndex) => ({
          sourceText: cell.sourceText,
          translatedText: translatedMap.get(`${unit.id}-h-${rowIndex}-${columnIndex}`) || cell.translatedText || ''
        }))
      ),
      rows: unit.tableData.rows.map((row, rowIndex) =>
        row.map((cell, columnIndex) => ({
          sourceText: cell.sourceText,
          translatedText: translatedMap.get(`${unit.id}-r-${rowIndex}-${columnIndex}`) || cell.translatedText || ''
        }))
      )
    };

    const translatedUnit: TranslationUnit = {
      ...unit,
      translatedText: normalizeText(
        [...translatedTableData.headers, ...translatedTableData.rows]
          .map((row) => row.map((cell) => cell.translatedText).join(' | '))
          .join('\n')
      ),
      tableData: translatedTableData
    };

    completedUnits.push(translatedUnit);
    return { unit: translatedUnit, allCached: translatedCells.allCached };
  };

  const translated: TranslationUnit[] = [];
  let normalBuffer: TranslationUnit[] = [];
  let allCached = sourceUnits.length > 0;

  const flushNormalBuffer = async (): Promise<void> => {
    if (!normalBuffer.length) return;
    const translatedBuffer = await translateLinearUnits(normalBuffer);
    translated.push(...translatedBuffer.units);
    allCached = allCached && translatedBuffer.allCached;
    normalBuffer = [];
  };

  for (const unit of sourceUnits.sort((a, b) => a.order - b.order)) {
    if (unit.kind === 'table' && unit.tableData) {
      await flushNormalBuffer();
      const translatedTable = await translateTableUnit(unit);
      translated.push(translatedTable.unit);
      allCached = allCached && translatedTable.allCached;
      continue;
    }

    normalBuffer.push(unit);
  }

  await flushNormalBuffer();
  await markGlossaryUsage(usedGlossaryIds);

  return {
    units: translated.sort((a, b) => a.order - b.order),
    translationCached: allCached
  };
}

async function streamTranslationPipeline(
  request: FileTranslationRequest,
  context: TranslationContext,
  hooks: StreamingHooks = {}
): Promise<TranslationResult> {
  await ensureFileTranslatorStore();
  assertNotCancelled(hooks);

  const cleaned = request.base64Data.includes(',') ? request.base64Data.split(',').pop() || '' : request.base64Data;
  const buffer = Buffer.from(cleaned, 'base64');
  const fileType = inferFileType(request.fileName, request.mimeType);
  if (!fileType) throw new Error('Unsupported file type. Only PDF, DOCX, and PPTX are supported.');
  if (!buffer.length) throw new Error('Uploaded file is empty.');

  const documentId = buildDocumentId(buffer, request.fileName);
  const fileHash = hashFileBuffer(buffer);
  const previewGroupLimit = typeof request.previewGroupLimit === 'number' && request.previewGroupLimit > 0
    ? Math.floor(request.previewGroupLimit)
    : null;
  const persistedGlossary = await upsertGlossaryEntries(
    (request.glossaryEntries || []).map((entry) => ({
      source: entry.source,
      target: entry.target,
      notes: entry.notes,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      domain: request.translationMode
    }))
  );
  const glossaryVersion = persistedGlossary.version;
  const resultCacheKey = buildResultCacheKey({
    fileHash,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    translationMode: request.translationMode,
    keepEnglishTerms: request.keepEnglishTerms,
    viewMode: request.viewMode,
    glossaryVersion
  });

  emitEvent(hooks, {
    type: 'job_started',
    stage: 'received',
    stageLabel: 'Upload received',
    percent: 1
  });

  const cachedResult = previewGroupLimit ? null : await loadResultCache(resultCacheKey);
  if (isCompleteTranslationResult(cachedResult)) {
    emitEvent(hooks, {
      type: 'progress',
      stage: 'cache',
      stageLabel: 'Loaded from cache',
      percent: 100,
      detail: 'Using cached translated preview.',
      totalGroups: cachedResult.totalGroups,
      completedGroups: cachedResult.totalGroups,
      totalUnits: cachedResult.totalUnits,
      completedUnits: cachedResult.totalUnits,
      fromCache: true
    });
    for (const group of cachedResult.groups) {
      assertNotCancelled(hooks);
      const units = cachedResult.units.filter((unit) => unit.groupIndex === group.index).sort((a, b) => a.order - b.order);
      emitEvent(hooks, {
        type: 'group_ready',
        group,
        units,
        totalGroups: cachedResult.totalGroups,
        completedGroups: group.index,
        totalUnits: cachedResult.totalUnits,
        completedUnits: units.length,
        fromCache: true,
        translationCached: true,
        extractionCached: true
      });
    }
    const finalResult: TranslationResult = {
      ...cachedResult,
      isComplete: true,
      cacheStatus: 'full'
    };
    emitEvent(hooks, { type: 'complete', result: finalResult, percent: 100, fromCache: true });
    return finalResult;
  }

  const allGroups: TranslationGroup[] = [];
  const allUnits: TranslationUnit[] = [];
  const allWarnings: TranslationWarning[] = [];
  const completedUnitsForContext: TranslationUnit[] = [];
  const cachedExtraction = await loadExtractionCache(fileHash);
  let completedGroupCount = 0;

  const emitGroupReady = (
    group: TranslationGroup,
    units: TranslationUnit[],
    translationCached: boolean,
    extractionCached: boolean,
    knownTotalGroups: number,
    knownTotalUnits: number
  ) => {
    completedGroupCount += 1;
    emitEvent(hooks, {
      type: 'group_ready',
      group,
      units,
      translationCached,
      extractionCached,
      totalGroups: knownTotalGroups || completedGroupCount,
      completedGroups: completedGroupCount,
      totalUnits: knownTotalUnits || allUnits.length,
      completedUnits: allUnits.length
    });
    const percent = Math.min(98, Math.round(30 + (completedGroupCount / Math.max(knownTotalGroups || completedGroupCount, 1)) * 60));
    emitEvent(hooks, {
      type: 'progress',
      stage: 'translating',
      stageLabel: 'Translating',
      percent,
      detail: `Translating ${group.label} (${completedGroupCount} of ${knownTotalGroups || completedGroupCount})`,
      totalGroups: knownTotalGroups || completedGroupCount,
      completedGroups: completedGroupCount,
      totalUnits: knownTotalUnits || allUnits.length,
      completedUnits: allUnits.length,
      translationCached,
      extractionCached
    });
  };

  if (fileType === 'pdf' && !cachedExtraction) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    const extractionGroups: TranslationGroup[] = [];
    const extractionUnits: TranslationUnit[] = [];
    try {
      emitEvent(hooks, {
        type: 'progress',
        stage: 'extracting',
        stageLabel: 'Extracting text',
        percent: 8,
        detail: `Preparing PDF pages (0 of ${pdf.numPages})`,
        totalGroups: pdf.numPages
      });

      const targetPageCount = previewGroupLimit ? Math.min(pdf.numPages, previewGroupLimit) : pdf.numPages;
      for (let pageNumber = 1; pageNumber <= targetPageCount; pageNumber += 1) {
        assertNotCancelled(hooks);
        emitEvent(hooks, {
          type: 'progress',
          stage: 'extracting',
          stageLabel: 'Extracting text',
          percent: Math.min(25, Math.round((pageNumber / pdf.numPages) * 25)),
          detail: `Extracting text from page ${pageNumber} of ${pdf.numPages}`,
          totalGroups: pdf.numPages,
          completedGroups: pageNumber - 1
        });
        const extracted = await extractPdfPage(pdf, pageNumber, request, context);
        extractionGroups.push(extracted.group);
        extractionUnits.push(...extracted.units);
        allWarnings.push(...extracted.warnings);
        for (const warning of extracted.warnings) emitEvent(hooks, { type: 'warning', warning });
        const translated = await translateGroup(extracted.units, request, context, glossaryVersion, completedUnitsForContext);
        const translatedGroup = mergeGroupTranslation(extracted.group, translated.units);
        allGroups.push(translatedGroup);
        allUnits.push(...translated.units);
        emitGroupReady(translatedGroup, translated.units, translated.translationCached, false, targetPageCount, extractionUnits.length);
      }

      if (!previewGroupLimit) {
        await saveExtractionCache(fileHash, {
          fileHash,
          fileType,
          groups: extractionGroups,
          units: extractionUnits,
          warnings: allWarnings
        });
      }
    } finally {
      await pdf.destroy();
    }
  } else {
    let extraction: ExtractionResult;
    let extractionCached = false;
    if (cachedExtraction) {
      extraction = {
        fileType: cachedExtraction.fileType,
        groups: cachedExtraction.groups,
        units: cachedExtraction.units,
        warnings: cachedExtraction.warnings
      };
      extractionCached = true;
    } else {
      emitEvent(hooks, {
        type: 'progress',
        stage: 'extracting',
        stageLabel: 'Extracting text',
        percent: 10,
        detail: fileType === 'docx' ? 'Parsing document structure' : 'Parsing slide structure'
      });
      extraction = await streamDocxOrPptxExtraction(buffer, fileType === 'docx' ? 'docx' : 'pptx');
      await saveExtractionCache(fileHash, {
        fileHash,
        fileType,
        groups: extraction.groups,
        units: extraction.units,
        warnings: extraction.warnings
      });
    }

    allWarnings.push(...extraction.warnings);
    extraction.warnings.forEach((warning) => emitEvent(hooks, { type: 'warning', warning }));

    const limitedGroups = previewGroupLimit ? extraction.groups.slice(0, previewGroupLimit) : extraction.groups;
    for (const group of limitedGroups) {
      assertNotCancelled(hooks);
      const sourceUnits = extraction.units.filter((unit) => unit.groupIndex === group.index).sort((a, b) => a.order - b.order);
      const translated = await translateGroup(sourceUnits, request, context, glossaryVersion, completedUnitsForContext);
      const translatedGroup = mergeGroupTranslation(group, translated.units);
      allGroups.push(translatedGroup);
      allUnits.push(...translated.units);
      emitGroupReady(translatedGroup, translated.units, translated.translationCached, extractionCached, limitedGroups.length, extraction.units.length);
    }
  }

  const result: TranslationResult = {
    documentId,
    fileName: request.fileName,
    fileType,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    translationMode: request.translationMode,
    viewMode: request.viewMode,
    keepEnglishTerms: request.keepEnglishTerms,
    warnings: allWarnings,
    units: allUnits.sort((a, b) => a.order - b.order),
    groups: allGroups.sort((a, b) => a.index - b.index),
    totalGroups: allGroups.length,
    totalUnits: allUnits.length,
    originalBufferBase64: buffer.toString('base64'),
    sourceFingerprint: fileHash,
    glossaryVersion,
    completedGroups: allGroups.length,
    isComplete: !previewGroupLimit,
    cacheStatus: completedGroupCount > 0 ? 'partial' : 'miss'
  };

  if (!previewGroupLimit) {
    await saveResultCache(resultCacheKey, result);
  }
  emitEvent(hooks, {
    type: 'progress',
    stage: 'preview',
    stageLabel: 'Building bilingual preview',
    percent: 100,
    detail: 'Finalizing preview and exports',
    totalGroups: result.totalGroups,
    completedGroups: result.totalGroups,
    totalUnits: result.totalUnits,
    completedUnits: result.totalUnits
  });
  emitEvent(hooks, { type: 'complete', result, percent: 100 });
  return result;
}

const buildDocxExport = async (result: TranslationResult, bilingual: boolean): Promise<Buffer> => {
  const rtl = /^ar\b|^he\b|^ur\b/i.test(result.targetLanguage);
  const children: Array<Paragraph | Table> = [];
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: bilingual ? 'Bilingual Translation Export' : 'Translated File Export',
      bold: true,
      size: 34,
      color: '1d4ed8'
    })],
    spacing: { after: 260 }
  }));

  for (const group of result.groups) {
    children.push(createTextParagraph(group.label, rtl, HeadingLevel.HEADING_2));
    const groupUnits = group.unitIds
      .map((unitId) => result.units.find((unit) => unit.id === unitId))
      .filter((unit): unit is TranslationUnit => !!unit);

    if (bilingual) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: groupUnits.map((unit) => new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [createTextParagraph(unit.sourceText, false)]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [createTextParagraph(unit.translatedText, rtl)]
            })
          ]
        }))
      }));
    } else {
      groupUnits.forEach((unit) => {
        children.push(unit.kind === 'heading'
          ? createTextParagraph(unit.translatedText, rtl, HeadingLevel.HEADING_3)
          : createTextParagraph(unit.translatedText, rtl));
      });
    }
  }

  const document = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(document));
};

const replacePptxShapeTexts = (slideXml: string, replacements: string[]): string => {
  let replacementIndex = 0;
  return slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (shapeXml) => {
    const replacement = replacements[replacementIndex];
    if (!replacement) return shapeXml;
    replacementIndex += 1;
    let inserted = false;
    return shapeXml.replace(/<a:t\b[^>]*>[\s\S]*?<\/a:t>/g, (textNode) => {
      if (inserted) {
        return textNode.replace(/<a:t\b[^>]*>[\s\S]*?<\/a:t>/g, '<a:t></a:t>');
      }
      inserted = true;
      return textNode.replace(/<a:t\b[^>]*>[\s\S]*?<\/a:t>/g, `<a:t>${escapeXml(replacement)}</a:t>`);
    });
  });
};

const buildPptxExport = async (result: TranslationResult, bilingual: boolean): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(Buffer.from(result.originalBufferBase64, 'base64'));
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0));
  for (const slideName of slideNames) {
    const slideIndex = Number(slideName.match(/slide(\d+)\.xml/i)?.[1] || 0);
    const slideXml = await zip.file(slideName)?.async('string');
    if (!slideXml) continue;
    const slideUnits = result.units.filter((unit) => unit.groupIndex === slideIndex).sort((a, b) => a.order - b.order);
    const replacements = slideUnits.map((unit) => bilingual ? `${unit.sourceText}\n${unit.translatedText}` : unit.translatedText);
    zip.file(slideName, replacePptxShapeTexts(slideXml, replacements));
  }
  return zip.generateAsync({ type: 'nodebuffer' });
};

export async function translateFile(request: FileTranslationRequest, context: TranslationContext): Promise<TranslationResult> {
  return streamTranslationPipeline(request, context);
}

export async function streamTranslateFile(
  request: FileTranslationRequest,
  context: TranslationContext,
  hooks: StreamingHooks
): Promise<TranslationResult> {
  try {
    return await streamTranslationPipeline(request, context, hooks);
  } catch (error) {
    if (error instanceof TranslationCancelledError) {
      emitEvent(hooks, { type: 'cancelled', stage: 'cancelled', stageLabel: 'Cancelled by user' });
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Translation failed';
    emitEvent(hooks, { type: 'error', error: message });
    throw error;
  }
}

export async function exportTranslatedFile(
  result: TranslationResult,
  format: 'translated' | 'bilingual'
): Promise<{ fileName: string; mimeType: string; buffer: Buffer }> {
  const baseName = result.fileName.replace(/\.[^.]+$/, '');
  const bilingual = format === 'bilingual';
  if (result.fileType === 'pptx') {
    return {
      fileName: `${baseName}-${bilingual ? 'bilingual' : 'translated'}.pptx`,
      mimeType: PPTX_MIME,
      buffer: await buildPptxExport(result, bilingual)
    };
  }
  return {
    fileName: `${baseName}-${bilingual ? 'bilingual' : 'translated'}.docx`,
    mimeType: DOCX_MIME,
    buffer: await buildDocxExport(result, bilingual)
  };
}
