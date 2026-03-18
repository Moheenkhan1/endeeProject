const axios = require('axios');
const { decode } = require('@msgpack/msgpack');

class EndeeService {
    constructor() {
        this.baseUrl = process.env.ENDEE_URL || 'http://127.0.0.1:8080';
        this.authToken = process.env.NDD_AUTH_TOKEN || null;
    }

    generateCollectionName(filename) {
        const sanitized = filename
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .toLowerCase();
        return `pdf_rag_${sanitized}_${Date.now()}`;
    }

    getConfig() {
        const config = { headers: { 'Content-Type': 'application/json' } };
        if (this.authToken) {
            config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        return config;
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
                {
                    index_name: name,
                    dim: dimension,
                    space_type: 'cosine',
                    m: 16,
                    ef_construction: 200
                },
                this.getConfig()
            );
            console.log(`✅ Index created: ${name}`);
            return response.data;
        } catch (error) {
            console.error('❌ Endee createCollection error:', error.response?.status, error.response?.data || error.message);
            throw new Error(`Failed to create Endee index: ${error.message}`);
        }
    }

    async insertVectors(collectionName, vectors) {
        try {
            console.log(`📥 Inserting ${vectors.length} vectors into: ${collectionName}`);
            const payload = vectors.map(vec => ({
                id: String(vec.id),
                vector: vec.vector,
                meta: JSON.stringify(vec.metadata || vec.meta || {})
            }));

            const response = await axios.post(
                `${this.baseUrl}/api/v1/index/${collectionName}/vector/insert`,
                payload,
                this.getConfig()
            );
            console.log(`✅ Vectors inserted successfully`);
            return response.data;
        } catch (error) {
            console.error('❌ Endee insertVectors error:', error.response?.status, error.response?.data || error.message);
            throw new Error(`Failed to insert vectors: ${error.message}`);
        }
    }

    async search(collectionName, queryVector, topK = 5) {
        try {
            console.log(`🔍 Searching Endee index: ${collectionName} (k=${topK})`);
            const response = await axios.post(
                `${this.baseUrl}/api/v1/index/${collectionName}/search`,
                {
                    vector: queryVector,
                    k: topK
                },
                {
                    ...this.getConfig(),
                    responseType: 'arraybuffer'  // receive raw bytes for msgpack
                }
            );

            // Decode msgpack response
            const buffer = Buffer.from(response.data);
            const decoded = decode(buffer);
            console.log(`✅ Search completed, decoded ${Array.isArray(decoded) ? decoded.length : 0} results`);

            // Parse results - each result has id, score/distance, and meta (stringified JSON)
            let results = [];
            if (Array.isArray(decoded)) {
                results = decoded.map(item => {
                    let meta = {};
                    // meta could be a string, a Buffer/Uint8Array, or already an object
                    if (item.meta) {
                        let metaStr = item.meta;
                        if (metaStr instanceof Uint8Array || Buffer.isBuffer(metaStr)) {
                            metaStr = Buffer.from(metaStr).toString('utf-8');
                        }
                        if (typeof metaStr === 'string') {
                            try { meta = JSON.parse(metaStr); } catch(e) { meta = { raw: metaStr }; }
                        } else if (typeof metaStr === 'object') {
                            meta = metaStr;
                        }
                    }
                    return {
                        id: item.id,
                        score: item.score ?? item.distance ?? 0,
                        text: meta.text || '',
                        chunkIndex: meta.chunkIndex ?? 0,
                        documentName: meta.documentName || '',
                        characterCount: meta.characterCount || 0,
                        page: meta.page || 1
                    };
                });
            }

            return results;
        } catch (error) {
            console.error('❌ Endee search error:', error.response?.status, error.response?.data || error.message);
            throw new Error(`Failed to search Endee: ${error.message}`);
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
            console.error('❌ Endee getCollectionInfo error:', error.response?.status, error.response?.data || error.message);
            return { status: 'unknown', error: error.message };
        }
    }

    async deleteCollection(collectionName) {
        try {
            console.log(`🗑️ Deleting Endee index: ${collectionName}`);
            const response = await axios.delete(
                `${this.baseUrl}/api/v1/index/${collectionName}`,
                this.getConfig()
            );
            console.log(`✅ Index deleted: ${collectionName}`);
            return response.data;
        } catch (error) {
            console.error('❌ Endee deleteCollection error:', error.response?.status, error.response?.data || error.message);
        }
    }

    async listCollections() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/api/v1/index/list`,
                this.getConfig()
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to list Endee indexes: ${error.message}`);
        }
    }
}

module.exports = new EndeeService();