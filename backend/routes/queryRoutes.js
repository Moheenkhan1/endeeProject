const express = require('express');
const ragService = require('../services/ragService');

const router = express.Router();

/**
 * POST /api/query
 * Ask a question about a document — uses Endee for retrieval
 */
router.post('/query', async (req, res) => {
  try {
    const { collectionName, question } = req.body;

    if (!collectionName || !question) {
      return res.status(400).json({
        error: 'Both collectionName and question are required'
      });
    }

    // Execute RAG pipeline (Embed → Endee Search → LLM)
    const result = await ragService.answerQuestion(collectionName, question);

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

module.exports = router;