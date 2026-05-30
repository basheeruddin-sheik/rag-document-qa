# 📚 RAG Document Q&A Engine — Complete Beginner's Guide

> **Who is this for?** Someone with zero knowledge of programming, AI, or databases.
> Every term is explained with a real-world analogy before the technical definition.

---

## 📌 Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [The Big Picture — How It All Works](#2-the-big-picture--how-it-all-works)
3. [Key Concepts Explained Simply](#3-key-concepts-explained-simply)
4. [NPM Packages — What & Why](#4-npm-packages--what--why)
5. [Database — What, Schema & Why](#5-database--what-schema--why)
6. [Project Structure & Files](#6-project-structure--files)
7. [Step-by-Step: How a PDF Gets Uploaded](#7-step-by-step-how-a-pdf-gets-uploaded)
8. [Step-by-Step: How a Question Gets Answered](#8-step-by-step-how-a-question-gets-answered)
9. [Process of Development](#9-process-of-development)
10. [What Could Be Added (Gaps)](#10-what-could-be-added-gaps)

---

## 1. What Is This Project?

### 🧠 In Plain English

Imagine you have a stack of 100 PDF documents — company reports, manuals, contracts. You want to ask:
> *"What is the salary of John in the HR report?"*
> *"What are the return policies across all vendor contracts?"*

Normally, you'd open each PDF manually and search. This project **automates that** — you upload the PDFs, ask questions in plain English, and get answers with sources.

### 🔧 Technical Definition

This is a **RAG (Retrieval-Augmented Generation)** system built with:
- **NestJS** (backend web server)
- **PostgreSQL + pgvector** (database that understands meaning, not just keywords)
- **Google Gemini AI** (reads the relevant parts and writes the answer)

> **RAG** = Search smartly first → then let AI generate the answer from what was found.

---

## 2. The Big Picture — How It All Works

```
╔══════════════════════════════════════════════════════════════════╗
║                    PHASE 1: UPLOAD (Ingest)                      ║
╚══════════════════════════════════════════════════════════════════╝

  📄 PDF File
      │
      ▼
  [pdf-parse]  ←── Extracts raw text from the PDF
      │
      ▼
  "The employee John earns $5000. He joined in 2021.
   Mary earns $6000. She is a senior engineer..."
      │
      ▼
  [RecursiveCharacterTextSplitter]  ←── Cuts text into small chunks (500 chars each)
      │
      ▼
  Chunk 1: "The employee John earns $5000. He joined in 2021."
  Chunk 2: "Mary earns $6000. She is a senior engineer..."
  Chunk 3: ...
      │
      ▼
  [Google Gemini Embeddings API]  ←── Converts each chunk into a "number fingerprint"
      │
      ▼
  Chunk 1 → [0.23, -0.88, 0.41, ... 3072 numbers]
  Chunk 2 → [0.11, 0.77, -0.33, ... 3072 numbers]
      │
      ▼
  [PostgreSQL + pgvector]  ←── Stores the text + number fingerprint in the database
      │
      ▼
  ✅ Done! Document is now searchable by MEANING.


╔══════════════════════════════════════════════════════════════════╗
║                    PHASE 2: QUERY (Question → Answer)            ║
╚══════════════════════════════════════════════════════════════════╝

  ❓ "What is John's salary?"
      │
      ▼
  [Google Gemini Embeddings API]  ←── Convert question to number fingerprint
      │
      ▼
  Question → [0.24, -0.85, 0.39, ... 3072 numbers]
      │
      ▼
  [PostgreSQL similarity search]  ←── Find chunks whose fingerprints are CLOSEST
      │
      ▼
  Found: "The employee John earns $5000. He joined in 2021."
  Found: "John's department is Engineering..."
      │
      ▼
  [Google Gemini Chat AI]  ←── "Here are the relevant parts. Now answer this question."
      │
      ▼
  💬 "John earns $5,000 per month. Source: hr_report.pdf (chunk 0)"
```

---

## 3. Key Concepts Explained Simply

### 3.1 What is an API?

> **Real World:** When you call a restaurant to order food, you're using their "interface" — you don't go into the kitchen yourself. An API is the same — a way for two programs to talk to each other.

Your app "calls" Google Gemini's API to ask it to convert text into numbers or write an answer.

---

### 3.2 What is an Embedding (Vector)?

> **Real World:** Imagine colours on a colour wheel. Red and orange are close together. Red and blue are far apart. Words work the same way — "dog" and "puppy" are close. "Dog" and "skyscraper" are far apart.

An **embedding** is a list of numbers (like coordinates on a map) that represents the *meaning* of a piece of text.

```
"I love dogs"   → [0.9, 0.2, -0.5, 0.8 ...]
"I adore dogs"  → [0.88, 0.21, -0.49, 0.79 ...]  ← VERY CLOSE (same meaning)
"Stock market"  → [-0.3, 0.9, 0.1, -0.6 ...]    ← FAR AWAY (different meaning)
```

This allows searching by **meaning**, not just exact keywords.

---

### 3.3 What is Cosine Similarity?

> **Real World:** Two arrows pointing in almost the same direction are "similar". Two arrows pointing in opposite directions are "dissimilar."

Cosine Similarity measures how similar two vectors (arrows) are.

```
    ↗ Question vector
   /
  /  ← small angle = HIGH similarity = relevant chunk
 /________________________
     ↘ Irrelevant chunk vector  ← big angle = LOW similarity
```

- Score = 1.0 → Identical meaning
- Score = 0.5 → Somewhat related
- Score = 0.0 → Completely unrelated

---

### 3.4 What is RAG?

> **Real World:** Imagine an exam. Instead of memorising the entire textbook, you're allowed to use reference books. You quickly find the relevant page, read it, and write your answer.

**RAG = Retrieval-Augmented Generation**

```
Without RAG:
  Question → AI (from memory) → Answer
  Problem: AI might hallucinate (make things up) or not know your private documents.

With RAG:
  Question → Search your documents → Find relevant parts → Feed to AI → Answer
  Benefit: AI only answers from YOUR real documents.
```

---

### 3.5 What is Chunking?

> **Real World:** A book has chapters. Each chapter has paragraphs. You don't memorise the whole book — you find the right paragraph.

Chunking = cutting a long document into smaller, manageable pieces.

```
Original PDF (10 pages, 5000 words)
         │
         ▼
Chunk 1 (500 chars): "Chapter 1: Introduction..."
Chunk 2 (500 chars): "The company was founded in..."
Chunk 3 (500 chars): "Revenue in 2023 was..."
...
Chunk 40 (500 chars): "...employee benefits policy."
```

**Why 500 characters?** Small enough to be specific, large enough to have context.
**Why 50 char overlap?** So meaning doesn't get cut off at chunk boundaries.

```
Chunk 3 ends:   "...John's salary is"
Chunk 4 starts: "salary is $5000 per month..."
                 ^^^^^^^^^^ overlap ensures the sentence stays connected
```

---

### 3.6 What is NestJS?

> **Real World:** A restaurant has different stations — one for orders, one for cooking, one for delivery. NestJS organizes your code the same way, into separate "modules."

NestJS is a **backend web framework** built with TypeScript. It organizes code into:
- **Controllers** — receive HTTP requests (like a waiter taking orders)
- **Services** — do the actual work (like the kitchen)
- **Modules** — group related Controllers + Services together

```
AppModule
  ├── DatabaseModule   ← manages database connection
  ├── IngestModule     ← handles PDF uploads
  │     ├── IngestController  (POST /upload)
  │     └── IngestService     (reads PDF, creates embeddings, saves to DB)
  └── QueryModule      ← handles questions
        ├── QueryController   (POST /query)
        └── QueryService      (searches DB, asks AI, returns answer)
```

---

### 3.7 What is TypeScript?

> **Real World:** When you fill a form, some fields are mandatory (Name, Date of Birth). TypeScript adds similar rules to code — "this function MUST receive a string, not a number."

TypeScript = JavaScript + **type safety** (catches bugs before running the code).

---

### 3.8 What is Docker?

> **Real World:** Shipping containers — the same container works on any ship, any port, anywhere in the world. Docker does the same for software.

Docker packages your database (PostgreSQL) into a container that runs the same on any computer.

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16   ← PostgreSQL + vector extension, pre-packaged
    ports:
      - '5432:5432'                 ← expose port 5432 to your computer
```

Run `docker compose up -d` → Database is running. No manual installation needed.

---

## 4. NPM Packages — What & Why

> **NPM** (Node Package Manager) = an app store for code. Instead of writing everything from scratch, you install pre-built tools.

### Core Framework

| Package | What it does | Why this, not alternatives |
|---|---|---|
| `@nestjs/core` | The NestJS framework engine | NestJS gives structure, dependency injection, decorators. Alternative: **Express** is simpler but messy at scale; **Fastify** is faster but less ecosystem. NestJS is best for organized, production-grade APIs. |
| `@nestjs/common` | Decorators like `@Controller`, `@Injectable`, `@Post` | Part of NestJS — provides the "building blocks" |
| `@nestjs/platform-express` | Connects NestJS to Express under the hood | Express is battle-tested for HTTP handling |
| `@nestjs/config` | Loads `.env` variables (API keys, DB URL) | Alternative: raw `dotenv` — but `@nestjs/config` integrates cleanly with NestJS DI system |
| `rxjs` | Handles async data streams | Required by NestJS internally |
| `reflect-metadata` | Enables decorators in TypeScript | Required for TypeScript decorators to work |

### AI / LangChain

| Package | What it does | Why this, not alternatives |
|---|---|---|
| `langchain` | Core LangChain library (text splitters) | LangChain is the industry standard for AI pipelines; provides `RecursiveCharacterTextSplitter` |
| `@langchain/core` | Messages (`HumanMessage`, `SystemMessage`) | Required for building structured AI prompts |
| `@langchain/google-genai` | Google Gemini embeddings + chat | Google Gemini `gemini-embedding-001` produces **3072-dimension** embeddings — very high quality. Alternative: OpenAI `text-embedding-3-large` is also 3072-dim but costs more. Gemini is chosen here. |
| `@langchain/openai` | OpenAI integration (installed, available) | Could swap to OpenAI GPT-4 as the LLM if needed |
| `@langchain/community` | Community integrations (extra loaders) | Extends LangChain with more document loaders |

### File Handling

| Package | What it does | Why this, not alternatives |
|---|---|---|
| `multer` | Handles file uploads (multipart/form-data) | The standard for file uploads in Node.js/Express. Alternative: **busboy** is lower-level and more complex. Multer is simple and NestJS has built-in `FileInterceptor` that wraps it. |
| `pdf-parse` | Extracts text from PDF files | Lightweight, pure JS. Alternative: **pdfjs-dist** (heavier, browser-focused), **pdf2json** (more complex). `pdf-parse` does one job simply. |

### Database

| Package | What it does | Why this, not alternatives |
|---|---|---|
| `pg` | PostgreSQL driver for Node.js | The official, most-used PostgreSQL client for Node. Alternative: **Prisma** (ORM, adds abstraction), **TypeORM** (ORM, more complex setup). Raw `pg` gives full SQL control — important for custom vector queries. |

### Validation

| Package | What it does | Why this, not alternatives |
|---|---|---|
| `class-validator` | Validates incoming request data (e.g., `question` must not be empty) | Works perfectly with NestJS pipes. Alternative: **Joi** or **Zod** — valid, but require more wiring with NestJS. |
| `class-transformer` | Converts plain JSON into TypeScript class instances | Required alongside `class-validator` in NestJS |

---

## 5. Database — What, Schema & Why

### 5.1 Why PostgreSQL?

> **Real World:** You need a filing cabinet. You ALSO need the cabinet to be able to sort folders by "how similar they are to this folder." Standard filing cabinets can't do that. PostgreSQL + pgvector can.

PostgreSQL is a powerful **relational database**. With the **pgvector** extension, it can also store and search vectors (number arrays = embeddings).

**Alternatives considered:**
- **Pinecone** — dedicated vector DB, SaaS, paid, external dependency
- **Weaviate / Qdrant** — dedicated vector DBs, need separate server setup
- **ChromaDB** — in-memory, good for prototypes, not production-grade
- **PostgreSQL + pgvector** ✅ — uses existing familiar DB, free, self-hosted, production-ready

### 5.2 The Schema (Table Structure)

```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- enable vector math in PostgreSQL

CREATE TABLE documents (
  id          serial PRIMARY KEY,        -- auto-increment unique ID: 1, 2, 3...
  content     text NOT NULL,             -- the actual text chunk
  embedding   vector(3072) NOT NULL,     -- 3072 numbers representing meaning
  metadata    jsonb,                     -- flexible JSON: filename, chunkIndex
  created_at  timestamp DEFAULT now()    -- when it was stored
);
```

**Visual row example:**

```
id | content                              | embedding           | metadata
---+--------------------------------------+---------------------+-----------------------------
 1 | "John earns $5000 per month..."      | [0.23,-0.88,...]    | {"filename":"hr.pdf","chunkIndex":0}
 2 | "Mary is a senior engineer..."       | [0.11, 0.77,...]    | {"filename":"hr.pdf","chunkIndex":1}
 3 | "Return policy is 30 days..."        | [-0.4, 0.55,...]    | {"filename":"contract.pdf","chunkIndex":0}
```

### 5.3 The Index

```sql
CREATE INDEX documents_embedding_idx
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

> **Real World:** A book's index (A→Z) lets you find words instantly instead of reading every page. A database index does the same — finds similar vectors fast instead of comparing every row.

- **ivfflat** = Inverted File Index. Splits vectors into 100 "buckets" (clusters). Searches only nearby buckets instead of all rows.
- **vector_cosine_ops** = uses cosine similarity as the distance measure.
- **lists = 100** = 100 clusters. Bigger = more accurate but slower; 100 is a good balance.

### 5.4 Database Concepts Used

| Concept | What it is | Where used |
|---|---|---|
| **Extension** | Adds new features to PostgreSQL | `CREATE EXTENSION vector` |
| **Serial / Primary Key** | Auto-numbering unique ID | `id serial PRIMARY KEY` |
| **Text** | Variable-length string storage | `content text` |
| **Vector(3072)** | Array of 3072 floats (from pgvector) | `embedding vector(3072)` |
| **JSONB** | Binary JSON — fast, queryable | `metadata jsonb` |
| **IVFFlat Index** | Approximate nearest-neighbour index | Fast similarity search |
| **Cosine Distance** | `<=>` operator — measures angle between vectors | `ORDER BY embedding <=> $1` |
| **ROW_NUMBER() OVER PARTITION BY** | Window function — rank chunks per document | Get top-N per file |
| **DISTINCT ON** | Get one row per unique value | Get first chunk of each file |
| **Connection Pool** | Reuse DB connections instead of creating new ones | `new Pool(...)` |

---

## 6. Project Structure & Files

```
rag-document-qa/
│
├── src/                          ← All source code lives here
│   ├── main.ts                   ← Entry point: starts the server
│   ├── app.module.ts             ← Root module: connects all pieces
│   │
│   ├── database/
│   │   ├── database.module.ts    ← Makes DatabaseService available app-wide
│   │   └── database.service.ts  ← Connects to PostgreSQL, creates tables
│   │
│   ├── ingest/
│   │   ├── ingest.module.ts      ← Groups ingest controller + service
│   │   ├── ingest.controller.ts  ← POST /upload endpoint
│   │   └── ingest.service.ts    ← Parses PDF → chunks → embeddings → DB
│   │
│   ├── query/
│   │   ├── query.module.ts       ← Groups query controller + service
│   │   ├── query.controller.ts   ← POST /query endpoint
│   │   └── query.service.ts     ← Embeds question → search DB → AI answer
│   │
│   └── health/
│       └── health.controller.ts  ← GET /health → {"status":"ok"}
│
├── docker-compose.yml            ← Starts PostgreSQL + pgvector in Docker
├── .env                          ← Secret keys (not in git)
├── .env.example                  ← Template showing what env vars are needed
├── package.json                  ← Project dependencies list
└── tsconfig.json                 ← TypeScript settings
```

---

## 7. Step-by-Step: How a PDF Gets Uploaded

**API call:** `POST /upload` with a PDF file

```
Step 1: User sends PDF
──────────────────────────────────────────────────────────────────
  HTTP POST /upload
  Content-Type: multipart/form-data
  [file: hr_report.pdf  (binary data)]
         │
         ▼
  IngestController receives it
  multer stores the file in MEMORY (not disk) — faster, safer
  Validates: Is it a PDF? Is it under 50MB?

Step 2: Extract text
──────────────────────────────────────────────────────────────────
  pdf-parse reads the binary PDF buffer
         │
         ▼
  Returns plain text:
  "HUMAN RESOURCES REPORT 2024
   Employee: John Smith
   Salary: $5,000/month
   Department: Engineering
   Employee: Mary Johnson
   Salary: $6,000/month
   ..."

Step 3: Split into chunks
──────────────────────────────────────────────────────────────────
  RecursiveCharacterTextSplitter
  chunkSize: 500 characters
  chunkOverlap: 50 characters
         │
         ▼
  Chunk 0: "HUMAN RESOURCES REPORT 2024\nEmployee: John Smith\nSalary: $5,000/month\nDepartment: Engineering\n"
  Chunk 1: "Department: Engineering\nEmployee: Mary Johnson\nSalary: $6,000/month\n..."
                ↑ overlap (50 chars) ↑

Step 4: Convert chunks to embeddings
──────────────────────────────────────────────────────────────────
  Google Gemini API (gemini-embedding-001)
  Input: [chunk0_text, chunk1_text, chunk2_text, ...]
         │
         ▼
  Output: [
    [0.23, -0.88, 0.41, ... 3072 numbers],   ← embedding for chunk 0
    [0.11,  0.77, -0.33, ... 3072 numbers],  ← embedding for chunk 1
    ...
  ]

Step 5: Save to PostgreSQL
──────────────────────────────────────────────────────────────────
  For each chunk:
  INSERT INTO documents (content, embedding, metadata)
  VALUES (
    'HUMAN RESOURCES REPORT 2024...',
    '[0.23,-0.88,0.41,...]',
    '{"filename":"hr_report.pdf","chunkIndex":0}'
  )
         │
         ▼
  ✅ Response: { "message": "Document ingested successfully", "chunks": 23 }
```

---

## 8. Step-by-Step: How a Question Gets Answered

**API call:** `POST /query` with `{ "question": "What is John's salary?" }`

```
Step 1: Receive question
──────────────────────────────────────────────────────────────────
  QueryController receives: { "question": "What is John's salary?" }
  Validates: is question non-empty?

Step 2: Embed the question
──────────────────────────────────────────────────────────────────
  Google Gemini Embeddings API
  Input: "What is John's salary?"
         │
         ▼
  Output: [0.24, -0.85, 0.39, ... 3072 numbers]
  ← This is the "meaning fingerprint" of the question

Step 3: Search the database (TWO parallel searches)
──────────────────────────────────────────────────────────────────

  Search A: SIMILARITY SEARCH (find most relevant chunks)
  ┌─────────────────────────────────────────────────────────┐
  │ SELECT content, metadata,                                │
  │   1 - (embedding <=> question_vector) AS similarity,    │
  │   ROW_NUMBER() OVER (                                    │
  │     PARTITION BY metadata->>'filename'                   │
  │     ORDER BY embedding <=> question_vector ASC           │
  │   ) AS rn                                               │
  │ FROM documents                                           │
  │ WHERE rn <= 4                        ← top 4 per file   │
  │ ORDER BY similarity DESC                                 │
  └─────────────────────────────────────────────────────────┘

  What this does:
  - Compare question vector against EVERY chunk's vector
  - Calculate similarity score (0 to 1)
  - Pick the TOP 4 most similar chunks PER document
  - This prevents one document dominating if you have multiple PDFs

  Search B: HEADER SEARCH (always get the first chunk of each file)
  ┌─────────────────────────────────────────────────────────┐
  │ SELECT DISTINCT ON (metadata->>'filename')               │
  │   content, metadata                                      │
  │ FROM documents                                           │
  │ ORDER BY metadata->>'filename',                          │
  │   (metadata->>'chunkIndex')::int ASC   ← chunk 0 first  │
  └─────────────────────────────────────────────────────────┘

  Why? The first chunk usually contains: document title, date, author.
  Without this, AI might not know WHICH document it's reading.

  Both searches run at the SAME TIME (Promise.all = parallel) → faster!

Step 4: Merge and deduplicate
──────────────────────────────────────────────────────────────────
  Header chunks + Similarity chunks combined
  Remove duplicates (a chunk might appear in both)
  Group by filename:

  hr_report.pdf:
    - Chunk 0: "HUMAN RESOURCES REPORT 2024..." (from header search)
    - Chunk 2: "Employee: John Smith, Salary: $5000..." (from similarity)
    - Chunk 5: "John's department is Engineering..." (from similarity)

  contract.pdf:
    - Chunk 0: "SERVICE CONTRACT 2024..." (from header search)

Step 5: Build the prompt for AI
──────────────────────────────────────────────────────────────────
  System message sent to Gemini:
  ┌─────────────────────────────────────────────────────────┐
  │ You are a helpful assistant that answers questions by    │
  │ analyzing multiple documents.                            │
  │ Context below contains excerpts from 2 document(s)...   │
  │                                                         │
  │ === Document: hr_report.pdf ===                         │
  │ HUMAN RESOURCES REPORT 2024                             │
  │ ---                                                     │
  │ Employee: John Smith, Salary: $5000/month               │
  │ ---                                                     │
  │ John's department is Engineering...                     │
  │                                                         │
  │ === Document: contract.pdf ===                          │
  │ SERVICE CONTRACT 2024...                                │
  └─────────────────────────────────────────────────────────┘

  Human message: "What is John's salary?"

Step 6: AI generates answer
──────────────────────────────────────────────────────────────────
  Google Gemini (gemini-2.5-flash)
  temperature: 0  ← means deterministic, no creativity, factual only
         │
         ▼
  "John Smith's salary is $5,000 per month, as stated in the
   Human Resources Report 2024."

Step 7: Return response
──────────────────────────────────────────────────────────────────
  {
    "answer": "John Smith's salary is $5,000 per month...",
    "sources": [
      "hr_report.pdf (chunk 0)",
      "hr_report.pdf (chunk 2)",
      "hr_report.pdf (chunk 5)"
    ]
  }
```

---

## 9. Process of Development

Here's the order in which this project was logically built:

```
Phase 1: Foundation
─────────────────────────────────────
1. Create NestJS project (nest new rag-document-qa)
2. Setup TypeScript configuration
3. Add ESLint + Prettier for code quality

Phase 2: Database
─────────────────────────────────────
4. Setup Docker with pgvector/pgvector:pg16 image
5. Create DatabaseService:
   - Connect to PostgreSQL using pg Pool
   - Create the documents table with vector(3072) column
   - Create IVFFlat index for fast similarity search
6. Create DatabaseModule to make service injectable

Phase 3: Document Ingestion
─────────────────────────────────────
7. Install: pdf-parse, multer, @langchain/google-genai, langchain
8. Create IngestService:
   - Parse PDF with pdf-parse
   - Split text with RecursiveCharacterTextSplitter
   - Get embeddings from Google Gemini API
   - Store chunks in PostgreSQL
9. Create IngestController:
   - POST /upload endpoint
   - File validation (PDF only, max 50MB)
   - Use multer with memoryStorage

Phase 4: Query Engine
─────────────────────────────────────
10. Create QueryService:
    - Embed the question
    - Run two parallel SQL queries (similarity + header)
    - Merge, deduplicate, group by document
    - Build structured prompt
    - Call Gemini chat model
    - Return answer + sources
11. Create QueryController:
    - POST /query endpoint
    - Validate question is not empty

Phase 5: Developer Experience
─────────────────────────────────────
12. Create HealthController (GET /health)
13. Add ValidationPipe globally in main.ts
14. Create .env.example template
15. Write Postman collection for API testing
16. Write README.md
```

---

## 10. What Could Be Added (Gaps)

Here are things the project doesn't have yet and why they matter:

| Missing Feature | Why It Matters | How to Add |
|---|---|---|
| **Authentication** | Anyone can upload PDFs or query right now | Add JWT auth with `@nestjs/passport` |
| **Delete documents** | No way to remove uploaded PDFs | Add `DELETE /documents/:filename` endpoint |
| **List documents** | No way to see what's been uploaded | Add `GET /documents` endpoint |
| **Rate limiting** | Someone could flood the API with requests | Add `@nestjs/throttler` |
| **Conversation history** | Each question is independent — no memory of past questions | Store chat history, pass it with each query |
| **Frontend UI** | You have to use Postman/curl — no browser interface | Build a React/Next.js frontend |
| **Streaming responses** | The answer waits until complete before returning | Use Server-Sent Events for word-by-word streaming |
| **Chunking strategy** | Splits by character count — could split mid-sentence | Use sentence-aware splitter |
| **Re-ranking** | Top-4 results might not always be the best 4 | Add a cross-encoder reranker after retrieval |
| **Multi-user support** | All documents are shared by everyone | Add user_id column in documents table |
| **Error logging** | Console logs only | Add Sentry or a proper logging service |
| **Unit tests** | `.spec.ts` files exist but tests are not implemented | Write Jest tests for each service |
| **Swagger docs** | No auto-generated API documentation | Add `@nestjs/swagger` |

---

## 🗺️ Final Visual Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOU (the user)                               │
└────────────────────┬──────────────────────────┬────────────────────┘
                     │                          │
              Upload PDF                   Ask Question
                     │                          │
                     ▼                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                      NestJS Backend (Port 3000)                    │
│                                                                    │
│   POST /upload              POST /query         GET /health        │
│   IngestController          QueryController     HealthController   │
│        │                        │                    │            │
│        ▼                        ▼                    ▼            │
│   IngestService            QueryService         { status: "ok" }  │
│        │                        │                                 │
│   1. pdf-parse             1. Embed question                      │
│   2. Split chunks          2. Search DB (2 queries)               │
│   3. Embed chunks          3. Build AI prompt                     │
│   4. Save to DB            4. Call Gemini Chat                    │
│        │                        │                                 │
└────────┼────────────────────────┼─────────────────────────────────┘
         │                        │
         ▼                        │
┌──────────────────┐              │
│   PostgreSQL DB  │◄─────────────┘
│   (pgvector)     │
│                  │
│  documents table │
│  ┌────────────┐  │
│  │ id         │  │
│  │ content    │  │
│  │ embedding  │  │   ← vector similarity search happens here
│  │ metadata   │  │
│  │ created_at │  │
│  └────────────┘  │
└──────────────────┘
         ▲                   ▲
         │                   │
         └────────┬──────────┘
                  │
     ┌────────────────────────┐
     │   Google Gemini API    │
     │  (via @langchain/      │
     │   google-genai)        │
     │                        │
     │  gemini-embedding-001  │ ← converts text → 3072-number vectors
     │  gemini-2.5-flash      │ ← reads context → writes answer
     └────────────────────────┘
```

---

## 📖 Quick Glossary

| Term | Simple Meaning |
|---|---|
| **RAG** | Search first, then generate answer using AI |
| **Embedding** | A list of numbers representing the meaning of text |
| **Vector** | A list of numbers (same as embedding here) |
| **Cosine Similarity** | How similar two vectors are (0 = different, 1 = identical) |
| **Chunk** | A small piece of a larger text |
| **pgvector** | A PostgreSQL extension that understands vectors |
| **IVFFlat** | A fast index for finding similar vectors |
| **NestJS** | A structured Node.js framework for building APIs |
| **Endpoint** | A URL the app responds to (like `/upload`, `/query`) |
| **Controller** | Code that receives HTTP requests |
| **Service** | Code that does the actual business logic |
| **Module** | A group of related Controllers + Services |
| **Decorator** | `@Something` syntax — adds behaviour to classes/methods |
| **DI (Dependency Injection)** | NestJS automatically gives a Service to whoever needs it |
| **Multer** | Handles file uploads in Node.js |
| **Temperature: 0** | AI setting — means factual, deterministic, no creativity |
| **System Prompt** | Instructions you give the AI before the conversation starts |
| **Connection Pool** | Reuse database connections instead of making new ones |
| **Docker** | Runs software in isolated containers |
| **JSONB** | A PostgreSQL column type that stores JSON with fast searching |
| **LangChain** | A library that makes it easy to build AI-powered apps |

---

*Generated for: BASHEERUDDIN SHEIK | Project: rag-document-qa | Date: 2026-05-24*
