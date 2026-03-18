/**
 * In-Memory Document Store
 * Replaces MongoDB — persists document metadata for the lifetime of the server process.
 * All vector data lives in Endee; this just tracks what collections exist.
 */

const { v4: uuidv4 } = require('uuid');

class DocumentStore {
  constructor() {
    this.documents = new Map(); // id → document object
  }

  create(data) {
    const id = uuidv4();
    const doc = {
      id,
      name: data.name || '',
      originalName: data.originalName || data.name || '',
      filePath: data.filePath || '',
      collectionName: data.collectionName || '',
      chunkCount: data.chunkCount || 0,
      pageCount: data.pageCount || 0,
      status: data.status || 'processing',
      createdAt: new Date().toISOString()
    };
    this.documents.set(id, doc);
    return doc;
  }

  findById(id) {
    return this.documents.get(id) || null;
  }

  findAll() {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  update(id, updates) {
    const doc = this.documents.get(id);
    if (!doc) return null;
    const updated = { ...doc, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  delete(id) {
    return this.documents.delete(id);
  }
}

// Singleton — shared across the app
module.exports = new DocumentStore();