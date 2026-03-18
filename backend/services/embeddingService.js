/**
 * Embedding Service — Mistral AI
 * Generates vector embeddings for text chunks to store in Endee
 */

const axios = require('axios');

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY;
    this.embeddingModel = 'mistral-embed';
    this.baseURL = 'https://api.mistral.ai/v1';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: 60000
    });
  }

  /**
   * Generate embeddings for an array of texts
   * These embeddings will be stored as vectors in Endee
   */
  async generateEmbeddings(texts) {
    try {
      // Batch process — Mistral supports multiple inputs
      const batchSize = 10;
      const allEmbeddings = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        console.log(`🧠 Generating embeddings batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} for Endee`);

        const response = await this.client.post('/embeddings', {
          model: this.embeddingModel,
          input: batch
        });

        const embeddings = response.data.data.map(item => item.embedding);
        allEmbeddings.push(...embeddings);

        // Rate limiting
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Generated ${allEmbeddings.length} embeddings (dim: ${allEmbeddings[0]?.length}) for Endee storage`);
      return allEmbeddings;
    } catch (error) {
      console.error('❌ Embedding generation error:', error.response?.data || error.message);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Generate a single embedding for a query
   * Used for searching Endee vector database
   */
  async generateQueryEmbedding(query) {
    try {
      const response = await this.client.post('/embeddings', {
        model: this.embeddingModel,
        input: [query]
      });

      const embedding = response.data.data[0].embedding;
      console.log(`🔍 Generated query embedding (dim: ${embedding.length}) for Endee search`);
      return embedding;
    } catch (error) {
      console.error('❌ Query embedding error:', error.response?.data || error.message);
      throw new Error(`Failed to generate query embedding: ${error.message}`);
    }
  }
}

module.exports = new EmbeddingService();