const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_WORD_FRAGMENT_PATTERN = /^[\u0621-\u064A\u066E-\u066F\u0671-\u06D3\u06FA-\u06FF]+$/;
const OPEN_PUNCTUATION_PATTERN = /[(\[{<"'`«]$/;
const CLOSE_PUNCTUATION_PATTERN = /^[)\]}>:;,.!?،؛؟»]/;

type PdfDirection = 'rtl' | 'ltr';

interface PdfTextFragmentInput {
  str: string;
  dir?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

interface PdfTextFragment {
  text: string;
  direction: PdfDirection;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  hasEOL: boolean;
}

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(text);
}

export function normalizeExtractedStudyText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => cleanupLine(line))
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function reconstructPdfPageText(items: ReadonlyArray<unknown>): string {
  const fragments = items
    .map((item) => toPdfTextFragment(item))
    .filter((item): item is PdfTextFragment => Boolean(item));

  const lines: string[] = [];
  let currentLine = '';
  let previous: PdfTextFragment | null = null;

  for (const fragment of fragments) {
    if (!previous) {
      currentLine = fragment.text;
    } else if (shouldBreakLine(previous, fragment)) {
      if (currentLine.trim()) {
        lines.push(cleanupLine(currentLine));
      }
      currentLine = fragment.text;
    } else {
      currentLine += needsSpace(previous, fragment) ? ' ' : '';
      currentLine += fragment.text;
    }

    if (fragment.hasEOL) {
      if (currentLine.trim()) {
        lines.push(cleanupLine(currentLine));
      }
      currentLine = '';
      previous = null;
      continue;
    }

    previous = fragment;
  }

  if (currentLine.trim()) {
    lines.push(cleanupLine(currentLine));
  }

  return normalizeExtractedStudyText(lines.join('\n'));
}

function toPdfTextFragment(item: unknown): PdfTextFragment | null {
  if (!item || typeof item !== 'object' || typeof (item as PdfTextFragmentInput).str !== 'string') {
    return null;
  }

  const raw = item as PdfTextFragmentInput;
  const text = raw.str.replace(/\r/g, '');
  if (!text.trim()) {
    return null;
  }

  const transform = Array.isArray(raw.transform) ? raw.transform : [];
  const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = transform;
  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  const measuredHeight = typeof raw.height === 'number' && Number.isFinite(raw.height) ? Math.abs(raw.height) : 0;
  const measuredWidth = typeof raw.width === 'number' && Number.isFinite(raw.width) ? Math.abs(raw.width) : 0;
  const fontSize = Math.max(scaleX, scaleY, measuredHeight, 1);
  const width = measuredWidth || Math.max(fontSize * Math.max(text.length, 1) * 0.42, 1);
  const height = Math.max(measuredHeight || fontSize, 1);

  return {
    text,
    direction: resolveDirection(raw.dir, text),
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width,
    height,
    fontSize,
    hasEOL: Boolean(raw.hasEOL)
  };
}

function resolveDirection(dir: string | undefined, text: string): PdfDirection {
  if (dir === 'rtl') {
    return 'rtl';
  }

  if (dir === 'ltr') {
    return 'ltr';
  }

  return containsArabicScript(text) ? 'rtl' : 'ltr';
}

function shouldBreakLine(previous: PdfTextFragment, current: PdfTextFragment): boolean {
  if (previous.hasEOL) {
    return true;
  }

  const verticalShift = Math.abs(previous.y - current.y);
  return verticalShift > Math.max(previous.height, current.height) * 0.8;
}

function needsSpace(previous: PdfTextFragment, current: PdfTextFragment): boolean {
  const previousText = previous.text.trimEnd();
  const currentText = current.text.trimStart();

  if (!previousText || !currentText) {
    return false;
  }

  if (OPEN_PUNCTUATION_PATTERN.test(lastCharacter(previousText)) || CLOSE_PUNCTUATION_PATTERN.test(currentText)) {
    return false;
  }

  const gap = measureGap(previous, current);
  if (!Number.isFinite(gap) || gap <= 0) {
    return false;
  }

  const previousIsArabic = isArabicWordFragment(previousText);
  const currentIsArabic = isArabicWordFragment(currentText);
  const shortArabicFragments = previousIsArabic && currentIsArabic && (fragmentLength(previousText) <= 2 || fragmentLength(currentText) <= 2);
  const threshold = shortArabicFragments
    ? Math.max(previous.fontSize, current.fontSize) * 0.55
    : Math.max(previous.fontSize, current.fontSize) * 0.18;

  return gap > Math.max(threshold, 1.5);
}

function measureGap(previous: PdfTextFragment, current: PdfTextFragment): number {
  if (previous.direction === 'rtl' || current.direction === 'rtl') {
    return previous.x - (current.x + current.width);
  }

  return current.x - (previous.x + previous.width);
}

function cleanupLine(value: string): string {
  return value
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?،؛؟)\]}>»])/g, '$1')
    .replace(/([(\[{<«])\s+/g, '$1')
    .trim();
}

function isArabicWordFragment(text: string): boolean {
  return ARABIC_WORD_FRAGMENT_PATTERN.test(text);
}

function fragmentLength(text: string): number {
  return text.replace(/\s+/g, '').length;
}

function lastCharacter(text: string): string {
  return text.slice(-1);
}
