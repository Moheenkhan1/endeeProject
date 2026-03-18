# 📄 Endee PDF RAG — Intelligent Document Q&A System

A full-stack **Retrieval-Augmented Generation (RAG)** application that allows users to upload PDF documents and ask natural language questions about their content.

It uses:

* **Endee** → Vector database
* **Mistral AI** → Embeddings + LLM
* **React + Node.js** → Full-stack app

---

## 🧠 What is RAG?

**Retrieval-Augmented Generation (RAG)** enhances LLM responses by:

1. Retrieving relevant document data
2. Passing it as context to the LLM
3. Generating grounded, accurate answers

👉 Ensures answers come from *your uploaded PDFs*, not just model memory.

---

## 🏗️ Architecture Overview

```
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
        Endee Vector DB (:8080)
        (HNSW + Cosine Similarity)
```

---

## 📦 Tech Stack

| Component     | Technology                       | Purpose                   |
| ------------- | -------------------------------- | ------------------------- |
| Frontend      | React.js, Tailwind CSS, Axios    | UI for upload & Q&A       |
| Backend       | Node.js, Express.js              | API & orchestration       |
| Vector DB     | Endee (HNSW)                     | Store & search embeddings |
| Embeddings    | Mistral (`mistral-embed`)        | Text → 1024-dim vectors   |
| LLM           | Mistral (`mistral-small-latest`) | Answer generation         |
| Metadata DB   | MongoDB                          | Document metadata         |
| PDF Parsing   | pdf-parse                        | Extract text              |
| Serialization | MessagePack                      | Decode Endee responses    |

---

## 🔄 Request Flow

### 📄 Flow 1: PDF Upload

```
User → React → POST /upload
        │
        ▼
Backend
  ├─ Save PDF (Multer)
  ├─ Extract text
  ├─ Chunk text (~500 chars)
  ├─ Generate embeddings
  ├─ Create Endee index
  ├─ Store vectors
  ├─ Save metadata (MongoDB)
  └─ Return success
```

👉 **Pipeline:** `PDF → Text → Chunks → Embeddings → Vector DB`

---

### ❓ Flow 2: Question Answering

```
User → React → POST /query
        │
        ▼
Backend (RAG)
  ├─ Question → embedding
  ├─ Search top-K chunks
  ├─ Parse results
  ├─ Build context
  ├─ Send to LLM
  └─ Return answer + sources
```

👉 **Pipeline:** `Question → Retrieve → Generate`

---

### 🗂️ Flow 3: Document Management

```
GET /documents → List documents

DELETE /documents/:id
  ├─ Remove from MongoDB
  ├─ Delete Endee index
  └─ Delete PDF file
```

---

## 🚀 Installation & Setup

### ✅ Prerequisites

| Requirement     | Version | Notes              |
| --------------- | ------- | ------------------ |
| Node.js         | ≥ 18    | Runtime            |
| npm             | ≥ 9     | Package manager    |
| MongoDB         | ≥ 6     | Local instance     |
| WSL 2           | Ubuntu  | Required for Endee |
| Mistral API Key | —       | Required           |

---

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/endee-pdf-rag.git
cd endee-pdf-rag
```

---

### 2️⃣ Start Endee (WSL)

```bash
cd /mnt/c/.../endee-pdf-rag/endee
chmod +x endee
./endee --port 8080 --data-dir ./endee_data
```

👉 Runs on: `http://127.0.0.1:8080`

---

### 3️⃣ Start MongoDB

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
# OR (WSL)
sudo systemctl start mongod
```

---

### 4️⃣ Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/endee_pdf_rag
MISTRAL_API_KEY=your_key
ENDEE_URL=http://127.0.0.1:8080
```

Run:

```bash
npm run dev
```

👉 Backend: `http://localhost:5000`

---

### 5️⃣ Frontend Setup

```bash
cd frontend
npm install
npm start
```

👉 Frontend: `http://localhost:3001`

---

### 6️⃣ Verify Services

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:3001 |
| Backend  | http://localhost:5000 |
| Endee    | http://127.0.0.1:8080 |
| MongoDB  | localhost:27017       |

---

## 📁 Project Structure

```
endee-pdf-rag/
├── backend/
│   ├── routes/
│   ├── services/
│   ├── uploads/
│   ├── server.js
│   └── .env
│
├── frontend/
│   ├── src/components/
│   ├── App.js
│   └── index.js
│
├── endee/
│   ├── endee
│   └── endee_data/
│
└── README.md
```

---

## ⚙️ Endee API Endpoints

| Method | Endpoint                           | Purpose           |
| ------ | ---------------------------------- | ----------------- |
| GET    | /api/v1/health                     | Health check      |
| POST   | /api/v1/index/create               | Create index      |
| POST   | /api/v1/index/{name}/vector/insert | Insert vectors    |
| POST   | /api/v1/index/{name}/search        | Similarity search |
| GET    | /api/v1/index/list                 | List indexes      |
| DELETE | /api/v1/index/{name}               | Delete index      |

---

## 📝 Example Usage

1. Start all services

2. Upload a PDF

3. Ask questions like:

   * "Summarize the document"
   * "What are the key skills?"
   * "What is the experience?"

4. View answers with **source chunks + similarity scores**

---

## ⚡ One-Line Summary

**Upload documents → Convert to vectors → Retrieve relevant context → Generate accurate answers**

---
