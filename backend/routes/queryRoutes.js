const express = require('express');
const ragService = require('../services/ragService');
const endeeService = require('../services/endeeService');

const router = express.Router();

/**
 * POST /api/query
 * Ask a question about a document — uses Endee for retrieval + Mistral for answer
 */
router.post('/query', async (req, res) => {
  try {
    const { collectionName, question } = req.body;

    if (!collectionName || !question) {
      return res.status(400).json({
        error: 'Both collectionName and question are required'
      });
    }

    if (question.trim().length < 3) {
      return res.status(400).json({ error: 'Question is too short' });
    }

    // Execute RAG pipeline: Embed → Endee Search → Mistral Answer
    const result = await ragService.answerQuestion(collectionName, question.trim());

    res.json({
      question,
      answer: result.answer,
      sources: result.sources,
      metadata: {
        endeeCollection: result.collectionUsed,
        chunksRetrieved: result.endeeSearchResults,
        searchEngine: 'Endee Vector Database'
      }
    });

  } catch (error) {
    console.error('❌ Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collections
 * List all Endee vector collections (one per uploaded PDF)
 */
router.get('/collections', async (req, res) => {
  try {
    const collections = await endeeService.listCollections();
    res.json({ collections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;