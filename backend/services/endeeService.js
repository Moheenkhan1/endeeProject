const axios = require('axios');
const { decode } = require('@msgpack/msgpack');

class EndeeService {
  constructor() {
    this.baseUrl = process.env.ENDEE_HOST || 'http://127.0.0.1:8080';
    this.authToken = process.env.NDD_AUTH_TOKEN || null;
  }

  generateCollectionName(filename) {
    const sanitized = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .substring(0, 40);
    return `pdf_rag_${sanitized}_${Date.now()}`;
  }

  getConfig(extra = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
    return { headers, ...extra };
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/health`, this.getConfig());
      return response.data;
    } catch (error) {
      throw new Error(`Endee health check failed: ${error.message}`);
    }
  }

  async createCollection(name, dimension = 1024) {
    try {
      console.log(`📦 Creating Endee index: ${name} (dim: ${dimension})`);
      const response = await axios.post(
        `${this.baseUrl}/api/v1/index/create`,
        { index_name: name, dim: dimension, space_type: 'cosine', m: 16, ef_construction: 200 },
        this.getConfig()
      );
      console.log(`✅ Index created: ${name}`);
      return response.data;
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Failed to create Endee index: ${msg}`);
    }
  }

  async insertVectors(collectionName, vectors) {
    try {
      console.log(`📥 Inserting ${vectors.length} vectors into: ${collectionName}`);
      const payload = vectors.map(vec => ({
        id: String(vec.id),
        vector: vec.vector,
        meta: JSON.stringify(vec.meta || {})
      }));

      const batchSize = 50;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        await axios.post(
          `${this.baseUrl}/api/v1/index/${collectionName}/vector/insert`,
          batch,
          this.getConfig()
        );
        console.log(`   → Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(payload.length / batchSize)}`);
      }
      console.log(`✅ All vectors inserted successfully`);
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Failed to insert vectors: ${msg}`);
    }
  }

  /**
   * Endee returns each result as an array:
   * [score, id, meta_buffer, "", distance, []]
   *  [0]    [1]    [2]        [3]   [4]    [5]
   */
  _parseResult(item) {
    // Handle both array format and object format
    let score, id, rawMeta;

    if (Array.isArray(item)) {
      score = item[0] ?? 0;
      id    = item[1] ?? '';
      rawMeta = item[2];
    } else {
      score   = item.score ?? item.distance ?? 0;
      id      = item.id ?? '';
      rawMeta = item.meta;
    }

    const meta = this._parseMeta(rawMeta);
    return { score, id, meta };
  }

  _parseMeta(rawMeta) {
    if (!rawMeta) return {};
    try {
      // Plain object already
      if (typeof rawMeta === 'object' && !Buffer.isBuffer(rawMeta) && !(rawMeta instanceof Uint8Array)) {
        // msgpack may decode Buffer as {type:'Buffer', data:[...]}
        if (rawMeta.type === 'Buffer' && Array.isArray(rawMeta.data)) {
          rawMeta = Buffer.from(rawMeta.data);
        } else {
          return rawMeta;
        }
      }

      let metaStr;
      if (Buffer.isBuffer(rawMeta) || rawMeta instanceof Uint8Array) {
        metaStr = Buffer.from(rawMeta).toString('utf-8');
      } else {
        metaStr = String(rawMeta);
      }

      const start = metaStr.indexOf('{');
      const end = metaStr.lastIndexOf('}');
      if (start === -1 || end === -1) return {};
      return JSON.parse(metaStr.substring(start, end + 1));
    } catch (e) {
      console.warn('⚠️  Meta parse warning:', e.message);
      return {};
    }
  }

  async search(collectionName, queryVector, topK = 5) {
    try {
      console.log(`🔍 Searching Endee: ${collectionName} (topK=${topK})`);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/index/${collectionName}/search`,
        { vector: queryVector, k: topK },
        this.getConfig({ responseType: 'arraybuffer' })
      );

      const buffer = Buffer.from(response.data);
      const decoded = decode(buffer);

      if (!Array.isArray(decoded) || decoded.length === 0) {
        console.warn('⚠️  Endee returned no results');
        return [];
      }

      console.log(`   → ${decoded.length} raw results from Endee`);

      const results = decoded.map((item, idx) => {
        const { score, id, meta } = this._parseResult(item);
        const text = meta.text || '';
        console.log(`   [${idx + 1}] score=${score.toFixed(4)} | text="${text.substring(0, 60)}"`);
        return {
          id,
          score,
          text,
          chunkIndex: meta.chunkIndex ?? idx,
          documentName: meta.documentName || '',
          characterCount: meta.characterCount || 0,
          page: meta.page || 1
        };
      });

      const valid = results.filter(r => r.text.trim().length > 0);
      console.log(`   → ${valid.length} valid results after filtering`);
      return valid;

    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Failed to search Endee: ${msg}`);
    }
  }

  async getCollectionInfo(collectionName) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/index/${collectionName}/info`,
        this.getConfig()
      );
      return response.data;
    } catch (error) {
      return { status: 'unknown', error: error.message };
    }
  }

  async deleteCollection(collectionName) {
    try {
      console.log(`🗑️  Deleting Endee index: ${collectionName}`);
      await axios.delete(`${this.baseUrl}/api/v1/index/${collectionName}`, this.getConfig());
      console.log(`✅ Index deleted: ${collectionName}`);
    } catch (error) {
      console.warn(`⚠️  deleteCollection failed: ${error.message}`);
    }
  }

  async listCollections() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/index/list`, this.getConfig());
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list Endee indexes: ${error.message}`);
    }
  }
}

module.exports = new EndeeService();