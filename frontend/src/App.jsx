import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';
import DocumentList from './components/DocumentList';
import api from './services/api';
import './App.css';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [endeeStatus, setEndeeStatus] = useState('checking');

  useEffect(() => {
    loadDocuments();
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const health = await api.healthCheck();
      setEndeeStatus(health.endeeVectorDB);
    } catch {
      setEndeeStatus('disconnected');
    }
  };

  const loadDocuments = async () => {
    try {
      const data = await api.getDocuments();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleUpload = async (file) => {
    setLoading(true);
    try {
      const result = await api.uploadPDF(file);
      await loadDocuments();
      setSelectedDoc(result.document);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteDocument(id);
      if (selectedDoc && selectedDoc.id === id) {
        setSelectedDoc(null);
      }
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>📄 PDF Q&A with Endee Vector Database</h1>
          <p className="subtitle">Upload PDFs • Store vectors in Endee • Ask questions with RAG</p>
          <div className={`status-badge ${endeeStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            Endee DB: {endeeStatus}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="sidebar">
          <FileUpload onUpload={handleUpload} loading={loading} />
          <DocumentList
            documents={documents}
            selectedDoc={selectedDoc}
            onSelect={setSelectedDoc}
            onDelete={handleDelete}
          />
        </div>
        <div className="chat-area">
          <ChatInterface selectedDoc={selectedDoc} />
        </div>
      </main>
    </div>
  );
}

export default App;