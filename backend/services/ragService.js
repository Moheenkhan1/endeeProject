/**
 * RAG Service — Orchestrates the full RAG pipeline using Endee
 *
 * Flow: Question → Embed → Search Endee → Build Context → Mistral Answer
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
    this.topK = 8;
  }

  /**
   * Full RAG pipeline: Query → Endee Search → LLM Answer
   */
  async answerQuestion(collectionName, question) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`❓ Question: ${question}`);
    console.log(`📦 Endee Collection: ${collectionName}`);
    console.log('='.repeat(60));

    // Step 1: Embed the question
    console.log('\n🔹 Step 1: Generating query embedding...');
    const queryEmbedding = await embeddingService.generateQueryEmbedding(question);
    console.log(`   → Embedding dim: ${queryEmbedding.length}`);

    // Step 2: Search Endee
    console.log('🔹 Step 2: Searching Endee...');
    const results = await endeeService.search(collectionName, queryEmbedding, this.topK);

    if (results.length === 0) {
      console.warn('⚠️  No results returned from Endee search');
      return {
        answer:
          'No relevant information was found in the document for your question. ' +
          'Please make sure the document was uploaded successfully, or try rephrasing your question.',
        sources: [],
        endeeSearchResults: 0,
        collectionUsed: collectionName
      };
    }

    // Step 3: Filter low-quality results
    const SCORE_THRESHOLD = 0.2; // cosine similarity — 0 = orthogonal, 1 = identical
    const relevantResults = results.filter(r => r.score >= SCORE_THRESHOLD);

    console.log(`🔹 ${results.length} results, ${relevantResults.length} above score threshold (${SCORE_THRESHOLD})`);

    const finalResults = relevantResults.length > 0 ? relevantResults : results; // fallback: use all

    // Step 4: Build context
    console.log('🔹 Step 3: Building context...');
    const context = this.buildContext(finalResults);
    console.log(`   → Context length: ${context.length} chars`);

    // Step 5: Generate answer
    console.log('🔹 Step 4: Calling Mistral AI...');
    const answer = await this.generateAnswer(question, context);

    console.log('✅ RAG pipeline complete\n');

    return {
      answer,
      sources: finalResults.map(r => ({
        text: r.text,
        score: r.score,
        chunkIndex: r.chunkIndex,
        page: r.page,
        documentName: r.documentName
      })),
      endeeSearchResults: finalResults.length,
      collectionUsed: collectionName
    };
  }

  /**
   * Build context string from Endee search results
   */
  buildContext(results) {
    return results
      .map((r, i) => {
        const scorePercent = (r.score * 100).toFixed(1);
        const pageInfo = r.page ? ` | Page ${r.page}` : '';
        return `[Source ${i + 1}${pageInfo} | Relevance: ${scorePercent}%]\n${r.text.trim()}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Generate answer using Mistral AI with retrieved context
   */
  async generateAnswer(question, context) {
    const systemPrompt = `You are an expert document Q&A assistant. Your job is to answer questions accurately using ONLY the provided context passages retrieved from a PDF document.

Important rules:
- Base your answer exclusively on the provided context
- If the context contains a clear answer, give it directly and confidently
- Cite sources using [Source N] when referencing specific passages
- If the context is partially relevant, extract what is useful and be clear about gaps
- Do NOT say "I don't have enough data" if the context clearly answers the question
- Be concise and precise`;

    const userPrompt = `Context retrieved from the document:
---
${context}
---

Question: ${question}

Answer based on the context above:`;

    try {
      const response = await this.mistralClient.post('/chat/completions', {
        model: this.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1024
      });

      const answer = response.data.choices[0].message.content;
      console.log(`   → Answer length: ${answer.length} chars`);
      return answer;
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Failed to generate answer: ${msg}`);
    }
  }
}

module.exports = new RAGService();