# Endee PDF RAG — Document Q&A System

Upload any PDF and ask questions about it in plain English. Powered by Endee vector search and Mistral AI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Tailwind CSS |
| Backend | Node.js, Express.js |
| Vector DB | Endee (HNSW) |
| Embeddings + LLM | Mistral AI |
| PDF Parsing | Custom Node.js worker |
| Serialization | MessagePack |

---

## How It Works

**Upload flow:**
PDF → Extract text → Split into chunks → Generate embeddings → Store in Endee

**Query flow:**
Question → Embed question → Search Endee → Build context → Mistral generates answer

---

## Architecture

```
Browser
  │
  ├── Upload PDF ──► POST /api/upload
  │                      │
  │                  Extract text
  │                  Split chunks
  │                  Embed (Mistral)
  │                  Store (Endee)
  │
  └── Ask Question ──► POST /api/query
                           │
                       Embed question (Mistral)
                       Search top-K (Endee)
                       Build context
                       Generate answer (Mistral)
                       Return answer + sources
```

---

## Setup

### Prerequisites
- Node.js v20+
- Mistral API key
- Endee running on port 8080 (via WSL)

### 1. Start Endee (WSL)
```bash
cd endee
chmod +x endee
./endee --port 8080 --data-dir ./endee_data
```

### 2. Backend
```bash
cd backend
npm install
```

Create `.env`:
```env
PORT=5000
MISTRAL_API_KEY=your_key_here
ENDEE_HOST=http://127.0.0.1:8080
```

```bash
node server.js
```

### 3. Frontend
```bash
cd frontend
npm install
npm start
```

### Services
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend | http://localhost:5000 |
| Endee | http://127.0.0.1:8080 |

---

## Project Structure

```
endee-pdf-rag/
├── backend/
│   ├── routes/
│   │   ├── uploadRoutes.js
│   │   └── queryRoutes.js
│   ├── services/
│   │   ├── endeeService.js
│   │   ├── embeddingService.js
│   │   ├── ragService.js
│   │   ├── pdfService.js
│   │   └── documentStore.js
│   ├── pdf_worker.js
│   └── server.js
├── frontend/
│   └── src/
└── endee/
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload | Upload and process a PDF |
| POST | /api/query | Ask a question |
| GET | /api/documents | List uploaded documents |
| DELETE | /api/documents/:id | Delete a document |
| GET | /api/health | Health check |

---

## Results

> Screenshots of the working application

| Upload | Q&A |
|--------|-----|
| ![Upload](https://drive.google.com/file/d/1JN3hwS1R61wTEgok3NBfGVc0x5TzB9D_/view?usp=drivesdk) | ![QA](https://drive.google.com/file/d/1kgvG8TgGsmgw97bd1S-uPTJJxNGhnvm_/view?usp=drivesdk) |

_Replace the links above with your actual Google Drive image links._

---

## Notes

- No MongoDB required — document metadata is stored in memory
- PDF parsing runs in an isolated child process to avoid memory issues
- Each uploaded PDF gets its own Endee vector index