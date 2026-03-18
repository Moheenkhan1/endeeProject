/**
 * PDF Processing Service
 * Spawns pdf_worker.js as an isolated child process.
 */

const { spawn } = require('child_process');
const path = require('path');

class PDFService {
  constructor() {
    this.chunkSize = 1200;   // increased from 800 — more context per chunk
    this.chunkOverlap = 200; // increased from 150 — better continuity across chunks
    this.workerPath = path.join(__dirname, '../pdf_worker.js');
  }

  extractText(filePath) {
    return new Promise((resolve, reject) => {
      let stdout = '';

      const worker = spawn(process.execPath, [this.workerPath, filePath], {
        env: process.env
      });

      worker.stdout.on('data', (d) => { stdout += d.toString(); });
      worker.stderr.on('data', () => {});

      worker.on('close', () => {
        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          if (jsonStart === -1 || jsonEnd === -1) {
            return reject(new Error(`No JSON in worker output. Raw: ${stdout.substring(0, 200)}`));
          }
          const result = JSON.parse(stdout.substring(jsonStart, jsonEnd + 1));
          if (result.error) return reject(new Error(result.error));
          if (!result.text || result.text.length === 0) {
            return reject(new Error('No text extracted — PDF may be image-based or encrypted'));
          }
          console.log(`📄 Extracted ${result.numPages} pages, ${result.charCount} characters`);
          resolve({ text: result.text, numPages: result.numPages, info: {} });
        } catch (e) {
          reject(new Error(`Worker parse error: ${e.message} | stdout: ${stdout.substring(0, 300)}`));
        }
      });

      worker.on('error', (err) => {
        reject(new Error(`Failed to spawn PDF worker: ${err.message}`));
      });
    });
  }

  splitIntoChunks(text, documentName) {
    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      let end = Math.min(start + this.chunkSize, text.length);

      // Prefer breaking at sentence boundaries for cleaner chunks
      if (end < text.length) {
        // Try period first, then comma, then space
        const sentenceEnd = text.lastIndexOf('. ', end);
        const commaEnd = text.lastIndexOf(', ', end);
        const spaceEnd = text.lastIndexOf(' ', end);

        if (sentenceEnd > start + this.chunkSize * 0.5) {
          end = sentenceEnd + 1;
        } else if (commaEnd > start + this.chunkSize * 0.6) {
          end = commaEnd + 1;
        } else if (spaceEnd > start + this.chunkSize * 0.7) {
          end = spaceEnd + 1;
        }
      }

      const chunkText = text.substring(start, end).trim();

      if (chunkText.length > 50) {
        chunks.push({
          text: chunkText,
          chunkIndex,
          documentName,
          characterCount: chunkText.length,
          page: Math.floor(chunkIndex / 3) + 1
        });
        chunkIndex++;
      }

      // Always advance — prevent infinite loop
      const nextStart = end - this.chunkOverlap;
      start = nextStart > start ? nextStart : end;
    }

    console.log(`✂️  Split into ${chunks.length} chunks (avg ${Math.round(text.length / Math.max(chunks.length, 1))} chars each)`);
    return chunks;
  }
}

module.exports = new PDFService();