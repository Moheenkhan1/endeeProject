# 📄 Endee PDF RAG — Intelligent Document Q&A System

A full-stack **Retrieval-Augmented Generation (RAG)** application that lets users upload PDF documents and ask natural language questions about their content. The system uses **Endee** as a high-performance vector database, **Mistral AI** for embeddings and chat, and a **React + Node.js** stack for the web interface.

![Tech Stack](https://img.shields.io/badge/React-Frontend-blue) ![Node.js](https://img.shields.io/badge/Node.js-Backend-green) ![Endee](https://img.shields.io/badge/Endee-Vector_DB-purple) ![Mistral](https://img.shields.io/badge/Mistral_AI-LLM-orange)

---

## 🧠 What is RAG?

Retrieval-Augmented Generation (RAG) is a technique that enhances LLM responses by first retrieving relevant information from a knowledge base, then using that context to generate accurate, grounded answers. Instead of relying solely on the LLM's training data, RAG ensures answers come directly from your uploaded documents.

---

## 🏗️ Architecture Overview

User (Browser)
   │
   ▼
React Frontend (:3001)
   │
   ├── Upload PDF ───────────────┐
   └── Ask Question ───────────┐ │
                               ▼ ▼
                    Node.js Backend (:5000)
                    ├─ Upload Route
                    ├─ Query Route
                    └─ Documents Route
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
   PDF Service                         RAG Service
 (Extract + Chunk)               (Query Processing)
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
              Embedding Service
            (Mistral AI API)
                       │
                       ▼
                Endee Service
          (Store & Search Vectors)
                       │
                       ▼
        Endee Vector Database (:8080)
        (HNSW + Cosine Similarity)

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

User → React → POST /upload
        │
        ▼
Node Backend
  ├─ Save PDF (Multer)
  ├─ Extract text (pdf-parse)
  ├─ Chunk text (~500 chars, overlap)
  ├─ Generate embeddings (Mistral API)
  ├─ Create Endee index (HNSW, cosine)
  ├─ Store vectors + metadata (Endee)
  ├─ Save doc info (MongoDB)
  └─ Return success

### Flow 2: Question Answering Pipeline


User → React → POST /query
        │
        ▼
Node Backend (RAG)
  ├─ Convert question → embedding
  ├─ Search top-K chunks (Endee)
  ├─ Parse results (msgpack → JSON)
  ├─ Build context from chunks
  ├─ Send context + question → Mistral LLM
  └─ Return answer + sources

### Flow 3: Document Management


GET /documents      → Fetch all docs (MongoDB)

DELETE /documents/:id
  ├─ Remove from MongoDB
  ├─ Delete Endee index
  └─ Delete PDF file

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

cd /mnt/c/.../endee-pdf-rag/endee
chmod +x endee
./endee --port 8080 --data-dir ./endee_data

```

Keep this terminal open. Endee must be running before starting the backend.

### Step 3: Start MongoDB

mongosh --eval "db.runCommand({ping:1})"
# or (WSL)
sudo systemctl start mongod

```

### Step 4: Set Up Backend

cd backend
npm install

# Create environment file
notepad .env
```

Add the following to `.env`:

PORT=5000
MONGODB_URI=mongodb://localhost:27017/endee_pdf_rag
MISTRAL_API_KEY=your_key
ENDEE_URL=http://127.0.0.1:8080
```

Start the backend:

```powershell
npm run dev


### Step 5: Set Up Frontend

cd frontend
npm install
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