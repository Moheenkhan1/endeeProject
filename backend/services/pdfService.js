/**
 * PDF Processing Service
 * Extracts text from PDFs and splits into chunks for Endee vector storage
 */

const fs = require('fs');
const pdfParse = require('pdf-parse');

class PDFService {
  constructor() {
    this.chunkSize = 500;      // characters per chunk
    this.chunkOverlap = 100;   // overlap between chunks
  }

  /**
   * Extract text from a PDF file
   */
  async extractText(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      console.log(`📄 Extracted ${data.numpages} pages, ${data.text.length} characters`);

      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info
      };
    } catch (error) {
      console.error('❌ PDF extraction error:', error.message);
      throw new Error(`Failed to extract PDF text: ${error.message}`);
    }
  }

  /**
   * Split text into overlapping chunks for embedding and Endee storage
   * Uses recursive character splitting for better chunk quality
   */
  splitIntoChunks(text, documentName) {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          chunkIndex,
          documentName,
          characterCount: currentChunk.trim().length
        });

        // Keep overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(words.length * 0.2));
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        chunkIndex,
        documentName,
        characterCount: currentChunk.trim().length
      });
    }

    console.log(`✂️ Split into ${chunks.length} chunks for Endee storage`);
    return chunks;
  }
}

module.exports = new PDFService();