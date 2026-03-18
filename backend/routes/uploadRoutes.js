const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const pdfService = require('../services/pdfService');
const embeddingService = require('../services/embeddingService');
const endeeService = require('../services/endeeService');

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// MongoDB Document Schema
const documentSchema = new mongoose.Schema({
  name: String,
  originalName: String,
  filePath: String,
  collectionName: String,
  chunkCount: Number,
  pageCount: Number,
  status: { type: String, default: 'processing' },
  createdAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', documentSchema);

/**
 * POST /api/upload
 * Upload a PDF, process it, and store vectors in Endee
 */
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const fileName = req.file.originalname;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 Processing upload: ${fileName}`);
    console.log('='.repeat(60));

    // Step 1: Generate Endee collection name
    const collectionName = endeeService.generateCollectionName(fileName);
    console.log(`📦 Endee collection name: ${collectionName}`);

    // Create document record
    const doc = new Document({
      name: fileName,
      originalName: fileName,
      filePath: req.file.path,
      collectionName,
      status: 'processing'
    });
    await doc.save();

    // Step 2: Extract text from PDF
    console.log('\n📹 Step 1: Extracting text from PDF...');
    const pdfData = await pdfService.extractText(req.file.path);

    // Step 3: Split into chunks
    console.log('📹 Step 2: Splitting text into chunks...');
    const chunks = pdfService.splitIntoChunks(pdfData.text, fileName);

    if (chunks.length === 0) {
      doc.status = 'error';
      await doc.save();
      return res.status(400).json({ error: 'No text could be extracted from the PDF' });
    }

    // Step 4: Generate embeddings (before collection creation to get dimension)
    console.log('📹 Step 3: Generating embeddings...');
    const texts = chunks.map(c => c.text);
    const embeddings = await embeddingService.generateEmbeddings(texts);
    const dimension = embeddings[0].length;
    console.log(`📐 Embedding dimension: ${dimension}`);

    // Step 5: Create Endee collection with correct dimension
    console.log('📹 Step 4: Creating Endee collection...');
    await endeeService.createCollection(collectionName, dimension);

    // Step 6: Store vectors in Endee
    console.log('📹 Step 5: Storing vectors in Endee...');
    const points = chunks.map((chunk, index) => ({
      id: index + 1,
      vector: embeddings[index],
      meta: {
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        documentName: chunk.documentName,
        characterCount: chunk.characterCount,
        page: Math.floor(chunk.chunkIndex / 3) + 1
      }
    }));

    await endeeService.insertVectors(collectionName, points);

    // Step 7: Verify vectors in Endee
    console.log('📹 Step 6: Verifying Endee storage...');
    const collectionInfo = await endeeService.getCollectionInfo(collectionName);
    console.log(`✅ Endee collection status:`, JSON.stringify(collectionInfo));

    // Update document
    doc.chunkCount = chunks.length;
    doc.pageCount = pdfData.numPages;
    doc.status = 'ready';
    await doc.save();

    console.log(`\n✅ Upload complete! ${chunks.length} vectors stored in Endee`);

    res.json({
      message: 'PDF processed and stored in Endee successfully',
      document: {
        id: doc._id,
        name: doc.name,
        collectionName: doc.collectionName,
        chunkCount: doc.chunkCount,
        pageCount: doc.pageCount,
        status: doc.status
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents
 */
router.get('/documents', async (req, res) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });
    res.json({ documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document AND its Endee collection
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete from Endee
    console.log(`🗑️ Deleting Endee collection: ${doc.collectionName}`);
    await endeeService.deleteCollection(doc.collectionName);

    // Delete from MongoDB
    await Document.findByIdAndDelete(req.params.id);

    // Delete file
    const fs = require('fs');
    if (fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    res.json({ message: 'Document and Endee collection deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;