/**
 * Endee Vector Database Configuration
 * 
 * Endee is the core vector database for this RAG system.
 * All vector storage, indexing, and similarity search operations
 * go through Endee's REST API.
 */

const ENDEE_CONFIG = {
  host: process.env.ENDEE_HOST || 'http://127.0.0.1:8080',
  
  // Vector configuration for Mistral AI embeddings
  vectorSize: 1024, // Mistral embed dimension
  distanceMetric: 'Cosine', // Cosine similarity for semantic search

  // Collection settings for Endee
  collectionPrefix: 'pdf_rag_', // Prefix for all collections in Endee

  // Search settings
  defaultTopK: 5, // Number of similar vectors to retrieve
  scoreThreshold: 0.3, // Minimum similarity score

  // Endee API endpoints
  endpoints: {
    collections: '/collections',
    points: (collection) => `/collections/${collection}/points`,
    search: (collection) => `/collections/${collection}/points/search`,
    delete: (collection) => `/collections/${collection}`,
    scroll: (collection) => `/collections/${collection}/points/scroll`,
  }
};

module.exports = ENDEE_CONFIG;