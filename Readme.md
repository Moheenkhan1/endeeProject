# 📄 Endee PDF RAG — Intelligent Document Q&A System

A full-stack **Retrieval-Augmented Generation (RAG)** application that lets users upload PDF documents and ask natural language questions about their content. The system uses **Endee** as a high-performance vector database, **Mistral AI** for embeddings and chat, and a **React + Node.js** stack for the web interface.

![Tech Stack](https://img.shields.io/badge/React-Frontend-blue) ![Node.js](https://img.shields.io/badge/Node.js-Backend-green) ![Endee](https://img.shields.io/badge/Endee-Vector_DB-purple) ![Mistral](https://img.shields.io/badge/Mistral_AI-LLM-orange)

---

## 🧠 What is RAG?

Retrieval-Augmented Generation (RAG) is a technique that enhances LLM responses by first retrieving relevant information from a knowledge base, then using that context to generate accurate, grounded answers. Instead of relying solely on the LLM's training data, RAG ensures answers come directly from your uploaded documents.

---

## 🏗️ Architecture Overview
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                              │
│                    React.js Frontend (:3001)                        │
└──────────────┬──────────────────────────────────┬───────────────────┘
│ Upload PDF                       │ Ask Question
▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js Backend (:5000)                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Upload Route  │  │ Query Route  │  │ Documents Route         │   │
│  │ POST /upload  │  │ POST /query  │  │ GET/DELETE /documents   │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────────────┘   │
│         │                 │                                         │
│  ┌──────▼───────┐  ┌──────▼───────┐                                │
│  │ PDF Service  │  │ RAG Service  │                                │
│  │ (Extract &   │  │ (Orchestrate │                                │
│  │  Chunk Text) │  │  Pipeline)   │                                │
│  └──────┬───────┘  └──────┬───────┘                                │
│         │                 │                                         │
│  ┌──────▼─────────────────▼──────┐                                 │
│  │     Embedding Service         │                                 │
│  │  (Mistral AI Embeddings API)  │                                 │
│  └──────┬─────────────────┬──────┘                                 │
│         │                 │                                         │
│  ┌──────▼─────────────────▼──────┐                                 │
│  │       Endee Service           │                                 │
│  │  (Vector Insert & Search)     │                                 │
│  └──────────────┬────────────────┘                                 │
└─────────────────┼──────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────┐
│              Endee Vector Database (:8080)                           │
│                    (WSL / Linux)                                     │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ HNSW Index  │  │ Vector Store │  │ Cosine Similarity Search │   │
│  └─────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

---

## 📦 Tech Stack

| Component        | Technology                          | Purpose                              |
|-----------------|--------------------------------------|--------------------------------------|
| **Frontend**     | React.js, Tailwind CSS, Axios       | User interface for upload and Q&A    |
| **Backend**      | Node.js, Express.js                 | REST API, orchestration layer        |
| **Vector DB**    | Endee (HNSW-based)                  | Store and search document embeddings |
| **Embeddings**   | Mistral AI (`mistral-embed`)        | Convert text to 1024-dim vectors     |
| **LLM**          | Mistral AI (`mistral-small-latest`) | Generate answers from context        |
| **Metadata DB**  | MongoDB                             | Store document metadata              |
| **PDF Parsing**  | pdf-parse                           | Extract text from PDF files          |
| **Serialization**| MessagePack (@msgpack/msgpack)      | Decode Endee search responses        |

---

## 🔄 Request Flow

### Flow 1: PDF Upload Pipeline


User selects PDF → React Frontend
│
▼ POST /api/upload (multipart/form-data)
│
Node.js Backend
│
├── 1. Multer saves PDF to /uploads directory
│
├── 2. PDF Service extracts raw text using pdf-parse
│
├── 3. PDF Service splits text into ~500 char chunks
│       with 50 char overlap between chunks
│
├── 4. Embedding Service sends chunks to Mistral AI
│       POST https://api.mistral.ai/v1/embeddings
│       Model: mistral-embed → Returns 1024-dim vectors
│
├── 5. Endee Service creates a new HNSW index
│       POST http://127.0.0.1:8080/api/v1/index/create
│       { index_name, dim: 1024, space_type: "cosine" }
│
├── 6. Endee Service inserts vectors with stringified metadata
│       POST http://127.0.0.1:8080/api/v1/index/{name}/vector/insert
│       [{ id: "1", vector: [...], meta: "{"text":"..."}" }]
│
├── 7. MongoDB stores document metadata
│       (name, collectionName, chunkCount, status)
│
└── 8. Returns success response with stats
→ React Frontend displays confirmation

### Flow 2: Question Answering Pipeline


User types question → React Frontend
│
▼ POST /api/query
│ { question: "...", collectionName: "..." }
│
Node.js Backend → RAG Service
│
├── 1. Embedding Service converts question to vector
│       POST https://api.mistral.ai/v1/embeddings
│       → Returns 1024-dim query vector
│
├── 2. Endee Service performs similarity search
│       POST http://127.0.0.1:8080/api/v1/index/{name}/search
│       { vector: [...], k: 5 }
│       ← Returns top 5 matching chunks (msgpack format)
│
├── 3. Decode msgpack response → parse meta JSON
│       Extract text, score, chunkIndex from each result
│
├── 4. RAG Service builds context from top chunks
│       "[Source 1] (Relevance: 92.3%) chunk text..."
│
├── 5. RAG Service sends context + question to Mistral LLM
│       POST https://api.mistral.ai/v1/chat/completions
│       System: "Answer based ONLY on provided context"
│       User: context + question
│
└── 6. Returns answer + sources with scores
→ React Frontend displays answer with citations

### Flow 3: Document Management


GET  /api/documents       → List all uploaded documents from MongoDB
DELETE /api/documents/:id → Delete document from MongoDB
+ Delete Endee index
+ Delete PDF file from disk

---

## 🚀 Installation & Setup

### Prerequisites

| Requirement    | Version  | Notes                                        |
|---------------|----------|----------------------------------------------|
| Node.js        | ≥ 18.x   | JavaScript runtime                           |
| npm            | ≥ 9.x    | Package manager (comes with Node.js)         |
| MongoDB        | ≥ 6.x    | Running on localhost:27017                    |
| WSL 2          | Ubuntu   | Required to run Endee on Windows             |
| Mistral AI Key | —        | Get from https://console.mistral.ai/api-keys |

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/endee-pdf-rag.git
cd endee-pdf-rag
```

### Step 2: Set Up Endee Vector Database (WSL)

Open a WSL terminal:

```bash
# Navigate to the endee directory
cd /mnt/c/Users/YourUsername/OneDrive/Desktop/endee-pdf-rag/endee

# Make the binary executable (first time only)
chmod +x endee

# Start Endee server
./endee --port 8080 --data-dir ./endee_data

# You should see:
# Crow/master server is running at http://0.0.0.0:8080
```

Keep this terminal open. Endee must be running before starting the backend.

### Step 3: Start MongoDB

Open a new terminal:

```bash
# If MongoDB is installed as a service (Windows)
# It should already be running. Verify:
mongosh --eval "db.runCommand({ping:1})"

# If using WSL:
sudo systemctl start mongod
```

### Step 4: Set Up Backend

Open a new PowerShell terminal:

```powershell
cd endee-pdf-rag\backend

# Install dependencies
npm install

# Create environment file
notepad .env
```

Add the following to `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/endee_pdf_rag
MISTRAL_API_KEY=your_mistral_api_key_here
ENDEE_URL=http://127.0.0.1:8080
```

Start the backend:

```powershell
npm run dev

# You should see:
# ✅ Server running on port 5000
# ✅ MongoDB connected
# ✅ Endee vector database is healthy
```

### Step 5: Set Up Frontend

Open another PowerShell terminal:

```powershell
cd endee-pdf-rag\frontend

# Install dependencies
npm install

# Start the development server
npm start

# Opens browser at http://localhost:3001
```

### Step 6: Verify Everything is Running

| Service   | URL                         | Status Check                  |
|----------|-----------------------------|-------------------------------|
| Frontend  | http://localhost:3001        | Browser opens automatically   |
| Backend   | http://localhost:5000        | Check terminal for ✅ logs    |
| Endee     | http://127.0.0.1:8080       | `curl http://127.0.0.1:8080/api/v1/health` |
| MongoDB   | mongodb://localhost:27017   | `mongosh --eval "db.ping()"` |

---

## 📁 Project Structure


endee-pdf-rag/
├── backend/
│   ├── routes/
│   │   ├── uploadRoutes.js       # PDF upload & processing endpoints
│   │   └── queryRoutes.js        # Question answering endpoint
│   ├── services/
│   │   ├── pdfService.js         # PDF text extraction & chunking
│   │   ├── embeddingService.js   # Mistral AI embedding generation
│   │   ├── endeeService.js       # Endee vector DB client (CRUD + search)
│   │   └── ragService.js         # RAG pipeline orchestration
│   ├── uploads/                  # Uploaded PDF files (auto-created)
│   ├── server.js                 # Express app entry point
│   ├── package.json
│   └── .env                      # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.jsx    # PDF upload component
│   │   │   ├── QueryInterface.jsx # Q&A chat component
│   │   │   └── DocumentList.jsx  # Document management component
│   │   ├── App.js                # Main app layout
│   │   └── index.js              # React entry point
│   ├── package.json
│   └── tailwind.config.js
│
├── endee/
│   ├── endee                     # Endee binary (Linux/WSL)
│   └── endee_data/               # Endee persistent data directory
│
└── README.md

---

## 🔌 API Reference

### Upload PDF

```http
POST /api/upload
Content-Type: multipart/form-data
Body: pdf (file)
```

**Response:**
```json
{
  "message": "PDF processed and stored in Endee successfully",
  "document": {
    "id": "65f...",
    "name": "document.pdf",
    "collectionName": "pdf_rag_document_1773817785096",
    "chunkCount": 12,
    "pageCount": 3,
    "status": "ready"
  },
  "endeeStats": {
    "collection": "pdf_rag_document_1773817785096",
    "vectorsStored": 12,
    "embeddingDimension": 1024,
    "distanceMetric": "Cosine"
  }
}
```

### Ask Question

```http
POST /api/query
Content-Type: application/json

{
  "question": "What skills does the candidate have?",
  "collectionName": "pdf_rag_document_1773817785096"
}
```

**Response:**
```json
{
  "answer": "Based on the document, the candidate has skills in...",
  "sources": [
    {
      "text": "Skills: Java, Spring Boot...",
      "score": 0.923,
      "chunkIndex": 3,
      "page": 1
    }
  ],
  "endeeSearchResults": 5,
  "collectionUsed": "pdf_rag_document_1773817785096"
}
```

### List Documents

```http
GET /api/documents
```

**Response:**
```json
{
  "documents": [
    {
      "_id": "65f...",
      "name": "document.pdf",
      "collectionName": "pdf_rag_document_1773817785096",
      "chunkCount": 12,
      "pageCount": 3,
      "status": "ready",
      "createdAt": "2026-03-18T07:00:00.000Z"
    }
  ]
}
```

### Delete Document

```http
DELETE /api/documents/:id
```

**Response:**
```json
{
  "message": "Document and Endee collection deleted"
}
```

---

## ⚙️ Endee API Endpoints Used

| Method | Endpoint                                  | Purpose                    |
|--------|------------------------------------------|----------------------------|
| GET    | `/api/v1/health`                         | Health check               |
| POST   | `/api/v1/index/create`                   | Create HNSW index          |
| POST   | `/api/v1/index/{name}/vector/insert`     | Insert vectors (JSON)      |
| POST   | `/api/v1/index/{name}/search`            | Similarity search (msgpack response) |
| GET    | `/api/v1/index/{name}/info`              | Get index info             |
| GET    | `/api/v1/index/list`                     | List all indexes           |
| DELETE | `/api/v1/index/{name}`                   | Delete index               |

### Endee-Specific Details

Endee has some unique requirements that this project handles:

- **Meta must be a string**: When inserting vectors, the `meta` field must be a `JSON.stringify()`'d string, not a raw JSON object. Endee's C++ parser calls `.s()` (string accessor) on the meta field.

- **Search returns MessagePack**: Search responses use `application/msgpack` content type. The backend uses `@msgpack/msgpack` to decode the binary response into JavaScript objects.

- **Index creation parameters**: Endee uses HNSW algorithm parameters like `m` (max connections per node, default 16) and `ef_construction` (build-time search width, default 200).

---

## 📊 How Chunking Works

The PDF text is split into overlapping chunks for optimal retrieval:


Parameter          Value    Reason
─────────────────────────────────────────────────
Chunk size         500      Small enough for precise retrieval
Chunk overlap      50       Preserves context across boundaries
Min chunk size     50       Filters out tiny/useless fragments

Example with a 1200-character document:


Chunk 0: characters    0 → 500   "The candidate has experience..."
Chunk 1: characters  450 → 950   "...experience in Java and Spring..."
Chunk 2: characters  900 → 1200  "...Spring Boot projects. Awards..."
↑
50-char overlap ensures no information is lost
at chunk boundaries

---

## 🔧 Configuration

### Environment Variables

| Variable         | Required | Default                              | Description                   |
|-----------------|----------|--------------------------------------|-------------------------------|
| `PORT`           | No       | `5000`                               | Backend server port           |
| `MONGODB_URI`    | Yes      | `mongodb://localhost:27017/endee_pdf_rag` | MongoDB connection string |
| `MISTRAL_API_KEY`| Yes      | —                                    | Mistral AI API key            |
| `ENDEE_URL`      | No       | `http://127.0.0.1:8080`             | Endee server URL              |
| `NDD_AUTH_TOKEN`  | No       | —                                    | Endee auth token (if enabled) |

### Tunable Parameters

| Parameter             | File                  | Default | Description                       |
|----------------------|------------------------|---------|-----------------------------------|
| `CHUNK_SIZE`          | `pdfService.js`       | 500     | Characters per chunk              |
| `CHUNK_OVERLAP`       | `pdfService.js`       | 50      | Overlap between chunks            |
| `topK`                | `ragService.js`       | 5       | Number of chunks retrieved        |
| `temperature`         | `ragService.js`       | 0.3     | LLM creativity (0=factual, 1=creative) |
| `max_tokens`          | `ragService.js`       | 1024    | Max LLM response length          |
| `m`                   | `endeeService.js`     | 16      | HNSW max connections              |
| `ef_construction`     | `endeeService.js`     | 200     | HNSW build-time quality           |
| File size limit       | `uploadRoutes.js`     | 20MB    | Max PDF upload size               |

---

## 🛠️ Troubleshooting

### Common Issues

**"Endee health check failed"**
- Ensure Endee is running in WSL: `./endee --port 8080 --data-dir ./endee_data`
- Verify with: `curl http://127.0.0.1:8080/api/v1/health`

**"value is not string" on vector insert**
- The `meta` field must be `JSON.stringify()`'d before sending to Endee
- This is handled automatically in `endeeService.js`

**"Vector byte size mismatch"**
- Embedding dimension doesn't match the index dimension
- Ensure the index was created with `dim: 1024` (Mistral embed output)

**Search returns binary/garbled data**
- Endee returns MessagePack format. Ensure `@msgpack/msgpack` is installed
- The `search()` method uses `responseType: 'arraybuffer'` to handle this

**MongoDB connection refused**
- Start MongoDB: `sudo systemctl start mongod` (Linux) or check Windows Services
- Verify: `mongosh --eval "db.runCommand({ping:1})"`

**"Only PDF files are allowed"**
- The upload endpoint only accepts files with MIME type `application/pdf`
- Ensure you're uploading a valid PDF file

---

## 📝 Example Usage

1. **Start all services** (Endee → MongoDB → Backend → Frontend)

2. **Upload a PDF**: Click "Upload PDF" and select a document

3. **Ask questions**:
   - "What are the candidate's technical skills?"
   - "Summarize the work experience"
   - "What certifications does the person have?"
   - "What is their educational background?"

4. **View sources**: Each answer shows the relevant chunks retrieved from Endee with similarity scores

---

## 🧪 Testing the Pipeline Manually

### Test Endee directly:

```bash
# Health check
curl http://127.0.0.1:8080/api/v1/health

# List all indexes
curl http://127.0.0.1:8080/api/v1/index/list

# Create a test index
curl -X POST http://127.0.0.1:8080/api/v1/index/create \
  -H "Content-Type: application/json" \
  -d '{"index_name": "test_index", "dim": 3, "space_type": "cosine"}'

# Insert a vector (meta must be a string!)
curl -X POST http://127.0.0.1:8080/api/v1/index/test_index/vector/insert \
  -H "Content-Type: application/json" \
  -d '{"id": "1", "vector": [0.1, 0.2, 0.3], "meta": "{\"text\": \"hello world\"}"}'

# Delete test index
curl -X DELETE http://127.0.0.1:8080/api/v1/index/test_index
```

### Test Backend API:

```bash
# Upload a PDF
curl -X POST http://localhost:5000/api/upload \
  -F "pdf=@/path/to/document.pdf"

# Ask a question
curl -X POST http://localhost:5000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this document about?", "collectionName": "pdf_rag_document_123"}'

# List documents
curl http://localhost:5000/api/documents
```

---

## 📄 License

This project is for educational and demonstration purposes.

---

## 🙏 Acknowledgments

- **Endee** — High-performance HNSW vector database
- **Mistral AI** — Embeddings and language model API
- **pdf-parse** — PDF text extraction
- **React.js** — Frontend framework
- **MongoDB** — Document metadata storage