# 📚 RAG Document Q&A Engine

> Upload PDFs. Ask questions. Get AI answers grounded in **your** documents.

A full-stack RAG (Retrieval-Augmented Generation) application with **NestJS backend**, **React + Vite frontend**, **PostgreSQL + pgvector** semantic search, and **Google Gemini** AI.

---

## 🗂️ Project Structure

```
rag-document-qa/
├── server/          ← NestJS backend  (cd server && npm run start:dev)
├── frontend/        ← React + Vite    (cd frontend && npm run dev)
└── docker-compose.yml  ← PostgreSQL + pgvector database
```

See **[EXPLAINED.md](./EXPLAINED.md)** for a complete beginner-friendly explanation of every concept.

---

## ✨ Features

| Feature | Details |
|---|---|
| **JWT Authentication** | Register / login, bcrypt-hashed passwords |
| **PDF Upload** | Drag-and-drop UI, up to 50 MB |
| **Sentence-aware chunking** | Splits on paragraphs → sentences, not mid-word |
| **Semantic search** | Gemini `gemini-embedding-001` (3072-dim vectors) |
| **Hybrid re-ranking** | Cosine similarity + keyword overlap boost |
| **Streaming answers** | Word-by-word SSE — no waiting for full response |
| **Conversation memory** | AI remembers last 5 Q&A turns per user |
| **Multi-user** | Each user sees only their own documents |
| **Document management** | List & delete uploaded PDFs |
| **Rate limiting** | 100 req/min per IP |
| **Swagger docs** | Auto-generated at `/api/docs` |
| **Unit tests** | Jest tests for all services |

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18  •  Docker Desktop  •  [Gemini API key](https://aistudio.google.com/app/apikey) (free)

### 1. Start the database
```bash
docker compose up -d
```

### 2. Start the backend
```bash
cd server
cp .env.example .env       # then fill in GEMINI_API_KEY and JWT_SECRET
npm install
npm run start:dev
# → http://localhost:3000
# → Swagger: http://localhost:3000/api/docs
```

### 3. Start the frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Original single-server docs (legacy)

---

## Stack

| Layer | Technology | Details |
|---|---|---|
| Framework | NestJS + TypeScript | v11, modular architecture |
| Embeddings | Google `gemini-embedding-001` | 3072-dimensional vectors, free tier |
| LLM | Google `gemini-2.5-flash` | Generative answers, free tier |
| Vector store | PostgreSQL + pgvector | Cosine similarity search, ivfflat index |
| PDF extraction | pdf-parse v1 | Text extraction from PDF buffers |
| File uploads | multer | In-memory storage, 50 MB limit |
| Infrastructure | Docker + docker-compose | pgvector/pgvector:pg16 image |
| Testing | Jest + NestJS Testing | 53 unit tests, all mocked |

---

## Project Structure

```
rag-document-qa/
├── src/
│   ├── ingest/
│   │   ├── ingest.module.ts
│   │   ├── ingest.controller.ts      ← POST /upload
│   │   ├── ingest.controller.spec.ts
│   │   ├── ingest.service.ts         ← PDF parse → chunk → embed → store
│   │   └── ingest.service.spec.ts
│   ├── query/
│   │   ├── query.module.ts
│   │   ├── query.controller.ts       ← POST /query
│   │   ├── query.controller.spec.ts
│   │   ├── query.service.ts          ← per-doc retrieval → Gemini answer
│   │   └── query.service.spec.ts
│   ├── database/
│   │   ├── database.module.ts        ← Global provider
│   │   ├── database.service.ts       ← pg Pool + schema auto-init
│   │   └── database.service.spec.ts
│   ├── health/
│   │   ├── health.controller.ts      ← GET /health
│   │   └── health.controller.spec.ts
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml
├── postman-collection.json           ← Import into Postman directly
├── .env.example
├── tsconfig.json
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Docker Desktop
- Google Gemini API key (free) → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your Gemini API key:

```env
GEMINI_API_KEY=AIzaSy...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb
PORT=3000
```

### 3. Start the database

```bash
docker-compose up -d
```

This starts a PostgreSQL 16 instance with the pgvector extension on port `5432`.

### 4. Start the API server

```bash
npm run start:dev
```

On first boot, `DatabaseService` automatically creates:
- `vector` extension
- `documents` table with `vector(3072)` column
- `ivfflat` index for fast cosine similarity search

### 5. Run tests

```bash
npm test
```

---

## API Reference

### `GET /health`

Check if the server is running.

**Response**
```json
{ "status": "ok" }
```

---

### `POST /upload`

Upload a PDF file for ingestion. The file is parsed, split into chunks, embedded, and stored in pgvector.

**Request**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Accepted type: `application/pdf`
- Max size: 50 MB

**cURL**
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@/path/to/document.pdf"
```

**Success Response `200`**
```json
{
  "message": "Document ingested successfully",
  "chunks": 23
}
```

**Error Responses**

| Status | Cause |
|---|---|
| `400` | No file attached |
| `400` | Non-PDF file uploaded |
| `500` | PDF has no extractable text |
| `500` | Embedding or database failure |

---

### `POST /query`

Ask a question across all uploaded documents. Returns an AI-generated answer with source references.

**Request**
- Content-Type: `application/json`

**Body**
```json
{
  "question": "your question here"
}
```

**cURL**
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the main topic of the document?"}'
```

**Success Response `200`**
```json
{
  "answer": "The document discusses ...",
  "sources": [
    "resume_john.pdf (chunk 0)",
    "form16_john.pdf (chunk 1)",
    "marksheet_priya.pdf (chunk 0)"
  ]
}
```

**Error Responses**

| Status | Cause |
|---|---|
| `400` | Missing or empty `question` field |
| `500` | Embedding or LLM failure |

**No documents uploaded**
```json
{
  "answer": "No relevant documents found. Please upload a PDF first.",
  "sources": []
}
```

---

## Postman Collection

A ready-to-import Postman collection is included at `postman-collection.json`.

### How to import

1. Open **Postman**
2. Click **Import** (top left)
3. Select `postman-collection.json` from the project root
4. Click **Import**

The collection includes:

| Request | Method | Description |
|---|---|---|
| Health Check | `GET /health` | Verify server is running |
| Upload PDF | `POST /upload` | File picker pre-configured with `form-data` and `file` key |
| Query Document | `POST /query` | JSON body with sample question pre-filled |

A `{{baseUrl}}` variable is set to `http://localhost:3000` — change it in one place under **Collection → Variables** if your port differs.

### Sample queries to try in Postman

```json
{ "question": "List all person names from all documents" }
{ "question": "What is the total salary of each person? Show as a table" }
{ "question": "Who has the highest qualification?" }
{ "question": "Summarize each document in one sentence" }
{ "question": "What are the key skills mentioned in the resumes?" }
```

---

## Architecture

### Ingestion Pipeline (`POST /upload`)

```
PDF file (multipart)
  → pdf-parse          extract raw text
  → RecursiveCharacterTextSplitter (chunkSize: 500, overlap: 50)
  → gemini-embedding-001  embed each chunk (3072 dims)
  → pgvector INSERT    store content + vector + metadata (filename, chunkIndex)
```

### Query Pipeline (`POST /query`)

```
Question (string)
  → gemini-embedding-001   embed the question

  ┌─ Parallel DB queries ─────────────────────────────────────────┐
  │  1. Per-document top-4 similarity search                       │
  │     (guarantees every uploaded document contributes)           │
  │  2. First chunk of every document                              │
  │     (always captures header/identity info regardless of type)  │
  └───────────────────────────────────────────────────────────────┘

  → Deduplicate + group chunks by document
  → Build context with document separators (=== Document: file.pdf ===)
  → gemini-2.5-flash   generate answer with source attribution
  → { answer, sources }
```

### Multi-document Retrieval Strategy

The retrieval is designed to work across **any document type** (resumes, CA docs, Form 16, marksheets, contracts, etc.):

| Query type | How it works |
|---|---|
| "List all names" | First chunk per doc (header) always included → names always in context |
| "What are the salaries?" | Similarity search finds salary chunks across all docs |
| "Compare qualifications" | Similarity finds education chunks from each document |
| "Summarize everything" | Per-doc top-4 gives broad coverage of each file |

---

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id         serial PRIMARY KEY,
  content    text NOT NULL,
  embedding  vector(3072) NOT NULL,
  metadata   jsonb,                    -- { filename, chunkIndex }
  created_at timestamp DEFAULT now()
);

CREATE INDEX ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key (free) | `AIzaSy...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/ragdb` |
| `PORT` | Server port | `3000` |

---

## Useful Commands

```bash
# Start database
docker-compose up -d

# Start dev server (hot reload)
npm run start:dev

# Run all unit tests
npm test

# Run tests with coverage
npm run test:cov

# Build for production
npm run build

# Start production server
npm run start:prod

# Stop and remove database container
docker-compose down

# Wipe all data and restart fresh
docker-compose down -v && docker-compose up -d
```
