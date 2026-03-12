import fs from 'node:fs/promises';
import path from 'node:path';
import type { KnowledgeChunk, KnowledgeDocument, KnowledgeDomain } from '../types.js';
import { DEFAULT_KNOWLEDGE_DOCUMENTS } from './default-documents.js';

const normalizeDomain = (value: unknown): KnowledgeDomain => {
  if (
    value === 'medical' ||
    value === 'engineering' ||
    value === 'law' ||
    value === 'general_science' ||
    value === 'general_academic'
  ) {
    return value;
  }

  return 'general_academic';
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'knowledge-doc';

export class LocalKnowledgeBase {
  private documentsPromise: Promise<KnowledgeDocument[]> | null = null;

  constructor(private readonly knowledgeDir: string) {}

  private normalizeDocument(input: Partial<KnowledgeDocument> & { content?: string; title?: string }): KnowledgeDocument | null {
    if (!input.title || !input.content) {
      return null;
    }

    return {
      id: input.id || slugify(input.title),
      domain: normalizeDomain(input.domain),
      title: input.title,
      sourceTitle: input.sourceTitle || input.title,
      sourceFamily: input.sourceFamily || 'Custom knowledge source',
      sourceType: input.sourceType || 'reference',
      sourceUrl: input.sourceUrl,
      summaryAr: input.summaryAr,
      summaryEn: input.summaryEn,
      quickFactsAr: Array.isArray(input.quickFactsAr) ? input.quickFactsAr.map(String) : [],
      quickFactsEn: Array.isArray(input.quickFactsEn) ? input.quickFactsEn.map(String) : [],
      content: input.content,
      tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
      keywords: Array.isArray(input.keywords) ? input.keywords.map(String) : [],
      updatedAt: input.updatedAt || new Date().toISOString()
    };
  }

  private async loadExternalDocuments(): Promise<KnowledgeDocument[]> {
    try {
      const entries = await fs.readdir(this.knowledgeDir, { withFileTypes: true });
      const documents: KnowledgeDocument[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const filePath = path.join(this.knowledgeDir, entry.name);
        const ext = path.extname(entry.name).toLowerCase();
        const raw = await fs.readFile(filePath, 'utf8');

        if (ext === '.json') {
          const parsed = JSON.parse(raw) as unknown;
          const candidates = Array.isArray(parsed) ? parsed : [parsed];
          candidates.forEach((candidate) => {
            if (!candidate || typeof candidate !== 'object') {
              return;
            }

            const normalized = this.normalizeDocument(candidate as Partial<KnowledgeDocument>);
            if (normalized) {
              documents.push(normalized);
            }
          });
          continue;
        }

        if (ext === '.md' || ext === '.txt') {
          const normalized = this.normalizeDocument({
            id: slugify(entry.name.replace(ext, '')),
            title: entry.name.replace(ext, ''),
            content: raw,
            sourceTitle: entry.name,
            sourceFamily: 'Local knowledge file',
            sourceType: 'reference',
            keywords: [entry.name.replace(ext, '')]
          });

          if (normalized) {
            documents.push(normalized);
          }
        }
      }

      return documents;
    } catch {
      return [];
    }
  }

  async loadDocuments(): Promise<KnowledgeDocument[]> {
    if (!this.documentsPromise) {
      this.documentsPromise = (async () => {
        const external = await this.loadExternalDocuments();
        const merged = [...DEFAULT_KNOWLEDGE_DOCUMENTS, ...external];
        const unique = new Map<string, KnowledgeDocument>();
        merged.forEach((document) => {
          unique.set(document.id, document);
        });
        return [...unique.values()];
      })();
    }

    return this.documentsPromise;
  }

  async getDocuments(): Promise<KnowledgeDocument[]> {
    return this.loadDocuments();
  }

  async buildChunks(maxChars = 1000): Promise<KnowledgeChunk[]> {
    const documents = await this.loadDocuments();
    const chunks: KnowledgeChunk[] = [];

    documents.forEach((document) => {
      const paragraphs = document.content
        .split(/\n\s*\n/g)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      let buffer = '';
      let ordinal = 0;

      const flush = () => {
        if (!buffer.trim()) {
          return;
        }

        chunks.push({
          id: `${document.id}::${ordinal}`,
          documentId: document.id,
          domain: document.domain,
          title: document.title,
          sourceTitle: document.sourceTitle,
          sourceFamily: document.sourceFamily,
          sourceType: document.sourceType,
          sourceUrl: document.sourceUrl,
          content: buffer.trim(),
          ordinal,
          tags: document.tags,
          keywords: document.keywords,
          updatedAt: document.updatedAt
        });

        ordinal += 1;
        buffer = '';
      };

      paragraphs.forEach((paragraph) => {
        if ((buffer + '\n\n' + paragraph).trim().length > maxChars) {
          flush();
        }
        buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      });

      flush();
    });

    return chunks;
  }
}
