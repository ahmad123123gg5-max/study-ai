# Hybrid AI Architecture

The StudyVex AI runtime now routes requests through:

1. `logic-engine`
2. `cache-system`
3. `rag-engine`
4. `ai-engine`
5. `workers`
6. `monitoring`

## Request Flow

- `POST /api/ai/chat`
  - deterministic cache/logic fast path
  - semantic retrieval through the knowledge layer when needed
  - AI generation only when explanation or generation is required

- `POST /api/ai/chat/stream`
  - NDJSON streaming response
  - emits `chunk` events followed by a `meta` event

- `POST /api/ai/jobs`
  - background queue for heavy AI work

- `GET /api/monitoring/metrics`
  - request latency
  - cache hits
  - AI usage
  - vector indexing/search metrics

## Cache Layers

- `L1` in-process memory
- `L2` Redis via `REDIS_URL`
- `L3` file-backed persistent cache as the default database-cache adapter

## Vector Search

- Default: local in-memory vector store
- Production: Qdrant via `QDRANT_URL`
- Embeddings: OpenAI when configured, otherwise deterministic local embeddings

## Scaling Notes

- Horizontal scaling is supported at the AI layer through external Redis/Qdrant plus multiple backend instances.
- Optional cluster mode exists, but file-backed state should not be clustered unless `HYBRID_ALLOW_FILE_STORE_CLUSTERING=true`.
