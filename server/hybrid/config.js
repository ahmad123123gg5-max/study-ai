import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const parseNumber = (value, fallback) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const parseBoolean = (value, fallback) => {
    if (typeof value !== 'string' || !value.trim()) {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};
const parseClusterWorkers = (value) => {
    if (!value || value === 'auto') {
        return 0;
    }
    return parseNumber(value, 1);
};
export const getHybridRuntimeConfig = () => ({
    ai: {
        defaultModel: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
        fastModel: process.env['HYBRID_FAST_MODEL'] || process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
        embeddingModel: process.env['OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-small',
        enableFullAuditOnLowRisk: parseBoolean(process.env['HYBRID_FULL_AUDIT_LOW_RISK'], false)
    },
    cache: {
        defaultTtlMs: parseNumber(process.env['HYBRID_CACHE_TTL_SECONDS'], 3600) * 1000,
        dbFilePath: process.env['HYBRID_CACHE_DB_FILE']
            ? path.resolve(workspaceRoot, process.env['HYBRID_CACHE_DB_FILE'])
            : path.resolve(workspaceRoot, '.tmp', 'hybrid-cache-db.json'),
        namespace: process.env['HYBRID_CACHE_NAMESPACE'] || 'smartedge:hybrid',
        redisUrl: process.env['REDIS_URL']
    },
    vector: {
        qdrantUrl: process.env['QDRANT_URL'],
        qdrantApiKey: process.env['QDRANT_API_KEY'],
        collectionName: process.env['QDRANT_COLLECTION'] || 'smartedge_knowledge',
        dimensions: parseNumber(process.env['HYBRID_VECTOR_DIMENSIONS'], 256),
        topK: parseNumber(process.env['HYBRID_RAG_TOP_K'], 3)
    },
    knowledge: {
        knowledgeDir: process.env['HYBRID_KNOWLEDGE_DIR']
            ? path.resolve(workspaceRoot, process.env['HYBRID_KNOWLEDGE_DIR'])
            : path.resolve(workspaceRoot, 'server', 'knowledge-base')
    },
    workers: {
        concurrency: parseNumber(process.env['HYBRID_WORKER_CONCURRENCY'], 2)
    },
    scaling: {
        clusterWorkers: parseClusterWorkers(process.env['HYBRID_CLUSTER_WORKERS']),
        allowFileStoreClustering: parseBoolean(process.env['HYBRID_ALLOW_FILE_STORE_CLUSTERING'], false)
    },
    monitoring: {
        recentSamples: parseNumber(process.env['HYBRID_MONITORING_SAMPLES'], 240)
    },
    runtime: {
        instanceId: process.env['INSTANCE_ID'] || `smartedge-${process.pid}`
    }
});
