import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'file-translator-data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const EXTRACTION_CACHE_DIR = path.join(CACHE_DIR, 'extractions');
const RESULT_CACHE_DIR = path.join(CACHE_DIR, 'results');
const UNIT_CACHE_DIR = path.join(CACHE_DIR, 'units');
const GLOSSARY_FILE = path.join(DATA_DIR, 'glossary.json');
const CACHE_SCHEMA_VERSION = 4;
let ensured = false;
const nowIso = () => new Date().toISOString();
const sha1 = (value) => createHash('sha1').update(value).digest('hex');
const readJson = async (filePath) => {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const writeJson = async (filePath, value) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
};
export const ensureFileTranslatorStore = async () => {
    if (ensured) {
        return;
    }
    await fs.mkdir(EXTRACTION_CACHE_DIR, { recursive: true });
    await fs.mkdir(RESULT_CACHE_DIR, { recursive: true });
    await fs.mkdir(UNIT_CACHE_DIR, { recursive: true });
    const existingGlossary = await readJson(GLOSSARY_FILE);
    if (!existingGlossary) {
        await writeJson(GLOSSARY_FILE, {
            version: 1,
            updatedAt: nowIso(),
            entries: []
        });
    }
    ensured = true;
};
export const hashFileBuffer = (buffer) => sha1(buffer);
export const buildResultCacheKey = (meta) => sha1(JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    ...meta
}));
export const buildUnitCacheKey = (sourceText, meta) => sha1(JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    sourceHash: sha1(sourceText),
    ...meta
}));
export const loadExtractionCache = async (fileHash) => {
    await ensureFileTranslatorStore();
    const cached = await readJson(path.join(EXTRACTION_CACHE_DIR, `${fileHash}.json`));
    if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
        return null;
    }
    return cached.value;
};
export const saveExtractionCache = async (fileHash, value) => {
    await ensureFileTranslatorStore();
    await writeJson(path.join(EXTRACTION_CACHE_DIR, `${fileHash}.json`), {
        schemaVersion: CACHE_SCHEMA_VERSION,
        createdAt: nowIso(),
        value
    });
};
export const loadResultCache = async (cacheKey) => {
    await ensureFileTranslatorStore();
    const cached = await readJson(path.join(RESULT_CACHE_DIR, `${cacheKey}.json`));
    if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
        return null;
    }
    return cached.value;
};
export const saveResultCache = async (cacheKey, value) => {
    await ensureFileTranslatorStore();
    await writeJson(path.join(RESULT_CACHE_DIR, `${cacheKey}.json`), {
        schemaVersion: CACHE_SCHEMA_VERSION,
        createdAt: nowIso(),
        value
    });
};
export const loadUnitCache = async (cacheKey) => {
    await ensureFileTranslatorStore();
    const cached = await readJson(path.join(UNIT_CACHE_DIR, `${cacheKey}.json`));
    if (!cached || cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
        return null;
    }
    return cached.value;
};
export const saveUnitCache = async (cacheKey, value) => {
    await ensureFileTranslatorStore();
    await writeJson(path.join(UNIT_CACHE_DIR, `${cacheKey}.json`), {
        schemaVersion: CACHE_SCHEMA_VERSION,
        createdAt: nowIso(),
        value
    });
};
export const loadGlossaryStore = async () => {
    await ensureFileTranslatorStore();
    const store = await readJson(GLOSSARY_FILE);
    return store || { version: 1, updatedAt: nowIso(), entries: [] };
};
export const listGlossaryEntries = async (sourceLanguage, targetLanguage, domain) => {
    const store = await loadGlossaryStore();
    const entries = store.entries.filter((entry) => {
        if (sourceLanguage && entry.sourceLanguage !== sourceLanguage)
            return false;
        if (targetLanguage && entry.targetLanguage !== targetLanguage)
            return false;
        if (domain && entry.domain !== domain && entry.domain !== 'all')
            return false;
        return true;
    });
    return { version: store.version, entries };
};
export const upsertGlossaryEntries = async (entries) => {
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
        const index = nextEntries.findIndex((entry) => entry.source.toLowerCase() === normalizedSource &&
            entry.targetLanguage === candidate.targetLanguage &&
            entry.sourceLanguage === candidate.sourceLanguage &&
            entry.domain === candidate.domain);
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
        }
        else {
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
    const nextStore = {
        version: store.version + 1,
        updatedAt: now,
        entries: nextEntries
    };
    await writeJson(GLOSSARY_FILE, nextStore);
    return { version: nextStore.version, entries: nextEntries };
};
export const findRelevantGlossaryEntries = async (sourceLanguage, targetLanguage, domain, text) => {
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
export const markGlossaryUsage = async (entryIds) => {
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
    });
};
