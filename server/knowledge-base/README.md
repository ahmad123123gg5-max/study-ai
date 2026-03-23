# StudyVex Knowledge Base

Drop local `.md`, `.txt`, or `.json` knowledge files into this directory to extend the Hybrid AI knowledge layer.

Supported JSON shape:

```json
{
  "id": "custom-doc-id",
  "domain": "medical",
  "title": "Custom knowledge title",
  "sourceTitle": "Trusted source name",
  "sourceFamily": "Medical guidelines",
  "sourceType": "guideline",
  "summaryAr": "ملخص عربي",
  "summaryEn": "English summary",
  "quickFactsAr": ["نقطة 1", "نقطة 2"],
  "quickFactsEn": ["Fact 1", "Fact 2"],
  "content": "Full source text",
  "tags": ["custom", "knowledge"],
  "keywords": ["keyword 1", "keyword 2"],
  "updatedAt": "2026-03-12T00:00:00.000Z"
}
```

When the server boots or `/api/knowledge/reindex` is called, these documents are chunked, embedded, and indexed into the vector layer.

