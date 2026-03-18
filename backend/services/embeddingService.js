/**
 * Embedding Service — Mistral AI
 * Uses a fresh https agent per request to avoid TLS session memory leaks.
 */

const axios = require('axios');
const https = require('https');

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY;
    this.embeddingModel = 'mistral-embed';
    this.baseURL = 'https://api.mistral.ai/v1';
  }

  _makeClient() {
    // Fresh agent per call — prevents TLS session accumulation in heap
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: 60000,
      httpsAgent: new https.Agent({ keepAlive: false })
    });
  }

  async generateEmbeddings(texts) {
    try {
      const client = this._makeClient();
      const response = await client.post('/embeddings', {
        model: this.embeddingModel,
        input: texts
      });
      const embeddings = response.data.data.map(item => item.embedding);
      console.log(`✅ Generated ${embeddings.length} embeddings (dim: ${embeddings[0]?.length})`);
      return embeddings;
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Failed to generate embeddings: ${msg}`);
    }
  }

  async generateQueryEmbedding(query) {
    try {
      const client = this._makeClient();
      const response = await client.post('/embeddings', {
        model: this.embeddingModel,
        input: [query]
      });
      const embedding = response.data.data[0].embedding;
      console.log(`🔍 Query embedding generated (dim: ${embedding.length})`);
      return embedding;
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Failed to generate query embedding: ${msg}`);
    }
  }
}

module.exports = new EmbeddingService();