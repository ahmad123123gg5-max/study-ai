import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import type { TranslationMode, TranslationResult, ViewMode } from './file-translator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'file-translator-data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const EXTRACTION_CACHE_DIR = path.join(CACHE_DIR, 'extractions');
const RESULT_CACHE_DIR = path.join(CACHE_DIR, 'results');
const UNIT_CACHE_DIR = path.join(CACHE_DIR, 'units');
const GLOSSARY_FILE = path.join(DATA_DIR, 'glossary.json');
const CACHE_SCHEMA_VERSION = 4;

export interface PersistentGlossaryEntry {
  id: string;
  source: string;
  target: string;
  sourceLanguage: string;
  targetLanguage: string;
  domain: TranslationMode | 'all';
  notes: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt: string | null;
}

interface GlossaryStoreShape {
  version: number;
  updatedAt: string;
  entries: PersistentGlossaryEntry[];
}

interface CacheEnvelope<T> {
  schemaVersion: number;
  createdAt: string;
  value: T;
}

export interface ExtractionCacheValue {
  fileHash: string;
  fileType: 'pdf' | 'docx' | 'pptx';
  groups: TranslationResult['groups'];
  units: TranslationResult['units'];
  warnings: TranslationResult['warnings'];
}

export interface ResultCacheMeta {
  fileHash: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationMode: TranslationMode;
  keepEnglishTerms: boolean;
  viewMode: ViewMode;
  glossaryVersion: number;
}

export interface UnitCacheMeta {
  sourceLanguage: string;
  targetLanguage: string;
  translationMode: TranslationMode;
  keepEnglishTerms: boolean;
  glossaryVersion: number;
}

let ensured = false;

const nowIso = () => new Date().toISOString();

const sha1 = (value: string | Buffer): string =>
  createHash('sha1').update(value).digest('hex');

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
};

export const ensureFileTranslatorStore = async (): Promise<void> => {
  if (ensured) {
    return;
  }
  await fs.mkdir(EXTRACTION_CACHE_DIR, { recursive: true });
  await fs.mkdir(RESULT_CACHE_DIR, { recursive: true });
  await fs.mkdir(UNIT_CACHE_DIR, { recursive: true });
  const existingGlossary = await readJson<GlossaryStoreShape>(GLOSSARY_FILE);
  if (!existingGlossary) {
    await writeJson(GLOSSARY_FILE, {
      version: 1,
      updatedAt: nowIso(),
      entries: []
    } satisfies GlossaryStoreShape);
  }
  ensured = true;
};

export const hashFileBuffer = (buffer: Buffer): string => sha1(buffer);

export const buildResultCacheKey = (meta: ResultCacheMeta): string =>
  sha1(JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    ...meta
  }));

export const buildUnitCacheKey = (sourceText: string, meta: UnitCacheMeta): string =>
  sha1(JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    sourceHash: sha1(sourceText),
    ...meta
  }));

export const loadExtractionCache = async (fileHash: string): Promise<ExtractionCacheValue | null> => {
  await ensureFileTranslatorStore();
  const cached = await readJson<CacheEnvelope<ExtractionCacheValue>>(path.join(EXTRACTION_CACHE_DIR, `${fileHash}.json`));
  if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
    return null;
  }
  return cached.value;
};

export const saveExtractionCache = async (fileHash: string, value: ExtractionCacheValue): Promise<void> => {
  await ensureFileTranslatorStore();
  await writeJson(path.join(EXTRACTION_CACHE_DIR, `${fileHash}.json`), {
    schemaVersion: CACHE_SCHEMA_VERSION,
    createdAt: nowIso(),
    value
  } satisfies CacheEnvelope<ExtractionCacheValue>);
};

export const loadResultCache = async (cacheKey: string): Promise<TranslationResult | null> => {
  await ensureFileTranslatorStore();
  const cached = await readJson<CacheEnvelope<TranslationResult>>(path.join(RESULT_CACHE_DIR, `${cacheKey}.json`));
  if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
    return null;
  }
  return cached.value;
};

export const saveResultCache = async (cacheKey: string, value: TranslationResult): Promise<void> => {
  await ensureFileTranslatorStore();
  await writeJson(path.join(RESULT_CACHE_DIR, `${cacheKey}.json`), {
    schemaVersion: CACHE_SCHEMA_VERSION,
    createdAt: nowIso(),
    value
  } satisfies CacheEnvelope<TranslationResult>);
};

export const loadUnitCache = async (cacheKey: string): Promise<{ translatedText: string; notes?: string[] } | null> => {
  await ensureFileTranslatorStore();
  const cached = await readJson<CacheEnvelope<{ translatedText: string; notes?: string[] }>>(path.join(UNIT_CACHE_DIR, `${cacheKey}.json`));
  if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
    return null;
  }
  return cached.value;
};

export const saveUnitCache = async (
  cacheKey: string,
  value: { translatedText: string; notes?: string[] }
): Promise<void> => {
  await ensureFileTranslatorStore();
  await writeJson(path.join(UNIT_CACHE_DIR, `${cacheKey}.json`), {
    schemaVersion: CACHE_SCHEMA_VERSION,
    createdAt: nowIso(),
    value
  } satisfies CacheEnvelope<{ translatedText: string; notes?: string[] }>);
};

export const loadGlossaryStore = async (): Promise<GlossaryStoreShape> => {
  await ensureFileTranslatorStore();
  const store = await readJson<GlossaryStoreShape>(GLOSSARY_FILE);
  return store || { version: 1, updatedAt: nowIso(), entries: [] };
};

export const listGlossaryEntries = async (
  sourceLanguage?: string,
  targetLanguage?: string,
  domain?: TranslationMode | 'all'
): Promise<{ version: number; entries: PersistentGlossaryEntry[] }> => {
  const store = await loadGlossaryStore();
  const entries = store.entries.filter((entry) => {
    if (sourceLanguage && entry.sourceLanguage !== sourceLanguage) return false;
    if (targetLanguage && entry.targetLanguage !== targetLanguage) return false;
    if (domain && entry.domain !== domain && entry.domain !== 'all') return false;
    return true;
  });
  return { version: store.version, entries };
};

export const upsertGlossaryEntries = async (
  entries: Array<{
    source: string;
    target: string;
    sourceLanguage: string;
    targetLanguage: string;
    domain: TranslationMode | 'all';
    notes?: string;
  }>
): Promise<{ version: number; entries: PersistentGlossaryEntry[] }> => {
  if (!entries.length) {
    return listGlossaryEntries();
  }

  const store = await loadGlossaryStore();
  const now = nowIso();
  const nextEntries = [...store.entries];
  let changed = false;

  for (const candidate of entries) {
    const source = candidate.source.trim();
    const target = candidate.target.trim();
    if (!source || !target) {
      continue;
    }

    const normalizedSource = source.toLowerCase();
    const index = nextEntries.findIndex((entry) =>
      entry.source.toLowerCase() === normalizedSource &&
      entry.targetLanguage === candidate.targetLanguage &&
      entry.sourceLanguage === candidate.sourceLanguage &&
      entry.domain === candidate.domain
    );

    if (index >= 0) {
      const nextTarget = target;
      const nextNotes = candidate.notes?.trim() || nextEntries[index].notes;
      if (nextEntries[index].target !== nextTarget || nextEntries[index].notes !== nextNotes) {
        nextEntries[index] = {
          ...nextEntries[index],
          target: nextTarget,
          notes: nextNotes,
          updatedAt: now
        };
        changed = true;
      }
    } else {
      nextEntries.push({
        id: sha1(`${candidate.sourceLanguage}:${candidate.targetLanguage}:${candidate.domain}:${normalizedSource}`).slice(0, 16),
        source,
        target,
        sourceLanguage: candidate.sourceLanguage,
        targetLanguage: candidate.targetLanguage,
        domain: candidate.domain,
        notes: candidate.notes?.trim() || '',
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        lastUsedAt: null
      });
      changed = true;
    }
  }

  if (!changed) {
    return { version: store.version, entries: nextEntries };
  }

  const nextStore: GlossaryStoreShape = {
    version: store.version + 1,
    updatedAt: now,
    entries: nextEntries
  };
  await writeJson(GLOSSARY_FILE, nextStore);
  return { version: nextStore.version, entries: nextEntries };
};

export const findRelevantGlossaryEntries = async (
  sourceLanguage: string,
  targetLanguage: string,
  domain: TranslationMode,
  text: string
): Promise<{ version: number; entries: PersistentGlossaryEntry[] }> => {
  const store = await loadGlossaryStore();
  const normalizedText = text.toLowerCase();
  const entries = store.entries.filter((entry) => {
    if (entry.sourceLanguage !== sourceLanguage || entry.targetLanguage !== targetLanguage) {
      return false;
    }
    if (entry.domain !== domain && entry.domain !== 'all') {
      return false;
    }
    return normalizedText.includes(entry.source.toLowerCase());
  }).slice(0, 40);
  return { version: store.version, entries };
};

export const markGlossaryUsage = async (entryIds: string[]): Promise<void> => {
  if (!entryIds.length) {
    return;
  }
  const store = await loadGlossaryStore();
  const now = nowIso();
  let changed = false;
  const nextEntries = store.entries.map((entry) => {
    if (!entryIds.includes(entry.id)) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      usageCount: entry.usageCount + 1,
      lastUsedAt: now
    };
  });
  if (!changed) {
    return;
  }
  await writeJson(GLOSSARY_FILE, {
    ...store,
    updatedAt: now,
    entries: nextEntries
  } satisfies GlossaryStoreShape);
};
