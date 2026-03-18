import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = {
  // Upload PDF — vectors stored in Endee
  uploadPDF: async (file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    const response = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Query document — searches Endee vector DB
  queryDocument: async (collectionName, question) => {
    const response = await axios.post(`${API_BASE}/query`, {
      collectionName,
      question
    });
    return response.data;
  },

  // Get all documents
  getDocuments: async () => {
    const response = await axios.get(`${API_BASE}/documents`);
    return response.data;
  },

  // Delete document and Endee collection
  deleteDocument: async (id) => {
    const response = await axios.delete(`${API_BASE}/documents/${id}`);
    return response.data;
  },

  // List Endee collections
  getCollections: async () => {
    const response = await axios.get(`${API_BASE}/collections`);
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await axios.get(`${API_BASE}/health`);
    return response.data;
  }
};

export default api;