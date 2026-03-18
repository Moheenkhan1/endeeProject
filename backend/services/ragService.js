/**
 * RAG Service — Orchestrates the full RAG pipeline using Endee
 * 
 * Flow: Question → Embed → Search Endee → Build Context → LLM Answer
 */

const axios = require('axios');
const endeeService = require('./endeeService');
const embeddingService = require('./embeddingService');

class RAGService {
  constructor() {
    this.mistralClient = axios.create({
      baseURL: 'https://api.mistral.ai/v1',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      timeout: 60000
    });
    this.chatModel = 'mistral-small-latest';
  }

  /**
   * Full RAG pipeline: Query → Endee Search → LLM Answer
   */
  async answerQuestion(collectionName, question) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`❓ Question: ${question}`);
    console.log(`📦 Endee Collection: ${collectionName}`);
    console.log('='.repeat(60));

    // Step 1: Generate query embedding
    console.log('\n🔹 Step 1: Generating query embedding...');
    const queryEmbedding = await embeddingService.generateQueryEmbedding(question);

    // Step 2: Search Endee vector database for relevant chunks
    console.log('🔹 Step 2: Searching Endee vector database...');
    const endeeResults = await endeeService.search(collectionName, queryEmbedding, 5);

    if (endeeResults.length === 0) {
      return {
        answer: 'I could not find any relevant information in the uploaded document to answer your question. Please try rephrasing your question or ensure the document contains relevant content.',
        sources: [],
        endeeSearchResults: 0
      };
    }

    console.log(`🔹 Endee returned ${endeeResults.length} relevant chunks:`);
    endeeResults.forEach((r, i) => {
      console.log(`   [${i + 1}] Score: ${r.score.toFixed(4)} | Chunk #${r.chunkIndex} | ${r.text.substring(0, 80)}...`);
    });

    // Step 3: Build context from Endee results
    console.log('🔹 Step 3: Building context from Endee results...');
    const context = this.buildContext(endeeResults);

    // Step 4: Generate answer using Mistral AI with Endee context
    console.log('🔹 Step 4: Generating answer with Mistral AI...');
    const answer = await this.generateAnswer(question, context);

    console.log('✅ RAG pipeline complete\n');

    return {
      answer,
      sources: endeeResults.map(r => ({
        text: r.text,
        score: r.score,
        chunkIndex: r.chunkIndex,
        page: r.page
      })),
      endeeSearchResults: endeeResults.length,
      collectionUsed: collectionName
    };
  }

  /**
   * Build context string from Endee search results
   */
  buildContext(endeeResults) {
    return endeeResults
      .map((result, index) => {
        return `[Source ${index + 1}] (Relevance: ${(result.score * 100).toFixed(1)}%)\n${result.text}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Generate answer using Mistral AI with context from Endee
   */
  async generateAnswer(question, context) {
    const systemPrompt = `You are a helpful document Q&A assistant. You answer questions based ONLY on the provided context retrieved from the Endee vector database. 

Rules:
1. Answer based ONLY on the provided context
2. If the context doesn't contain enough information, say so
3. Cite the source numbers [Source X] when referencing information
4. Be concise but thorough
5. If you're unsure, indicate your level of confidence`;

    const userPrompt = `Context from Endee Vector Database:
---
${context}
---

Question: ${question}

Please answer the question based on the context above.`;

    try {
      const response = await this.mistralClient.post('/chat/completions', {
        model: this.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1024
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Mistral chat error:', error.response?.data || error.message);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }
}

module.exports = new RAGService();