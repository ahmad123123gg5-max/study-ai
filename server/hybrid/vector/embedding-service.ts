import { createHash } from 'node:crypto';
import { createOpenAIEmbeddings } from '../../openai/openai-client.js';
import type { MultiLevelCacheSystem } from '../cache/cache-system.js';

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const normalizeVector = (vector: number[]): number[] => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector.map((_, index) => (index === 0 ? 1 : 0));
  }

  return vector.map((value) => value / norm);
};

const hashToIndex = (token: string, dimensions: number): number => {
  const digest = createHash('sha256').update(token).digest();
  return digest.readUInt16BE(0) % dimensions;
};

export class EmbeddingService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly dimensions: number,
    private readonly cache: MultiLevelCacheSystem
  ) {}

  private cacheKey(text: string): string {
    const normalized = text.trim().replace(/\s+/g, ' ');
    return `embedding:${this.model}:${createHash('sha1').update(normalized).digest('hex')}`;
  }

  private buildLocalEmbedding(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);

    tokens.forEach((token, tokenIndex) => {
      const bucket = hashToIndex(token, this.dimensions);
      const nextBucket = (bucket + 37) % this.dimensions;
      const weight = 1 + Math.min(2, token.length / 12);
      vector[bucket] += weight;
      vector[nextBucket] += tokenIndex % 2 === 0 ? 0.4 : -0.4;
    });

    return normalizeVector(vector);
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = new Array(texts.length);
    const uncached: Array<{ index: number; text: string; key: string }> = [];

    for (let index = 0; index < texts.length; index += 1) {
      const key = this.cacheKey(texts[index]);
      const cached = await this.cache.get<number[]>(key);
      if (cached.value) {
        vectors[index] = cached.value;
        continue;
      }
      uncached.push({ index, text: texts[index], key });
    }

    if (uncached.length > 0) {
      if (this.apiKey) {
        try {
          const remoteVectors = await createOpenAIEmbeddings({
            apiKey: this.apiKey,
            model: this.model,
            input: uncached.map((entry) => entry.text)
          });

          for (let index = 0; index < uncached.length; index += 1) {
            const vector = normalizeVector(remoteVectors[index] || this.buildLocalEmbedding(uncached[index].text));
            vectors[uncached[index].index] = vector;
            await this.cache.set(uncached[index].key, vector);
          }
        } catch {
          for (const entry of uncached) {
            const vector = this.buildLocalEmbedding(entry.text);
            vectors[entry.index] = vector;
            await this.cache.set(entry.key, vector);
          }
        }
      } else {
        for (const entry of uncached) {
          const vector = this.buildLocalEmbedding(entry.text);
          vectors[entry.index] = vector;
          await this.cache.set(entry.key, vector);
        }
      }
    }

    return vectors;
  }
}
