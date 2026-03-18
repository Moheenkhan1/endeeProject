const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pdfService = require('../services/pdfService');
const embeddingService = require('../services/embeddingService');
const endeeService = require('../services/endeeService');
const documentStore = require('../services/documentStore');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post('/upload', upload.single('pdf'), async (req, res) => {
  let doc = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    const fileName = req.file.originalname;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 Processing upload: ${fileName}`);
    console.log('='.repeat(60));

    const collectionName = endeeService.generateCollectionName(fileName);
    console.log(`📦 Endee collection name: ${collectionName}`);

    doc = documentStore.create({ name: fileName, originalName: fileName, filePath: req.file.path, collectionName, status: 'processing' });

    console.log('\n📄 Step 1: Extracting text from PDF...');
    const pdfData = await pdfService.extractText(req.file.path);
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      documentStore.update(doc.id, { status: 'error' });
      return res.status(400).json({ error: 'No text could be extracted from the PDF' });
    }

    console.log('✂️  Step 2: Splitting text into chunks...');
    const chunks = pdfService.splitIntoChunks(pdfData.text, fileName);
    if (chunks.length === 0) {
      documentStore.update(doc.id, { status: 'error' });
      return res.status(400).json({ error: 'No chunks generated' });
    }
    console.log(`   → ${chunks.length} chunks created`);

    console.log('🧠 Step 3: Generating embeddings...');
    const texts = chunks.map(c => c.text);
    
    // Process ONE chunk at a time to keep memory flat
    const embeddings = [];
    for (let i = 0; i < texts.length; i++) {
      console.log(`   → Embedding ${i + 1}/${texts.length}`);
      const [emb] = await embeddingService.generateEmbeddings([texts[i]]);
      embeddings.push(emb);
      // Force GC opportunity between calls
      await new Promise(r => setTimeout(r, 100));
    }

    const dimension = embeddings[0].length;
    console.log(`   → Dimension: ${dimension}`);

    console.log('🗄️  Step 4: Creating Endee collection...');
    await endeeService.createCollection(collectionName, dimension);

    console.log('📥 Step 5: Storing vectors in Endee...');
    const points = chunks.map((chunk, i) => ({
      id: i + 1,
      vector: embeddings[i],
      meta: {
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        documentName: chunk.documentName,
        characterCount: chunk.characterCount,
        page: chunk.page || Math.floor(chunk.chunkIndex / 3) + 1
      }
    }));
    await endeeService.insertVectors(collectionName, points);

    console.log('✅ Step 6: Verifying Endee storage...');
    const collectionInfo = await endeeService.getCollectionInfo(collectionName);
    console.log(`   → Collection info:`, JSON.stringify(collectionInfo));

    documentStore.update(doc.id, { chunkCount: chunks.length, pageCount: pdfData.numPages, status: 'ready' });
    const updatedDoc = documentStore.findById(doc.id);

    console.log(`\n✅ Upload complete! ${chunks.length} vectors stored in Endee`);

    res.json({
      message: 'PDF processed and stored in Endee successfully',
      document: {
        id: updatedDoc.id,
        name: updatedDoc.name,
        collectionName: updatedDoc.collectionName,
        chunkCount: updatedDoc.chunkCount,
        pageCount: updatedDoc.pageCount,
        status: updatedDoc.status
      },
      endeeStats: {
        collection: collectionName,
        vectorsStored: chunks.length,
        embeddingDimension: dimension,
        distanceMetric: 'Cosine'
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    if (doc) documentStore.update(doc.id, { status: 'error' });
    res.status(500).json({ error: error.message });
  }
});

router.get('/documents', (req, res) => {
  try {
    res.json({ documents: documentStore.findAll() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const doc = documentStore.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await endeeService.deleteCollection(doc.collectionName);

    if (doc.filePath && fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);

    documentStore.delete(doc.id);
    res.json({ message: 'Document and Endee collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;