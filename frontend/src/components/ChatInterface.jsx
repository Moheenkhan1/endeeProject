import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import './ChatInterface.css';

function ChatInterface({ selectedDoc }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedDoc) {
      setMessages([{
        type: 'system',
        text: `Document "${selectedDoc.name || selectedDoc.originalName}" selected. Vectors loaded from Endee collection: ${selectedDoc.collectionName}. Ask any question!`
      }]);
    }
  }, [selectedDoc]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedDoc || loading) return;

    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { type: 'user', text: question }]);
    setLoading(true);

    try {
      const result = await api.queryDocument(selectedDoc.collectionName, question);

      setMessages(prev => [...prev, {
        type: 'assistant',
        text: result.answer,
        sources: result.sources,
        metadata: result.metadata
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'error',
        text: error.response?.data?.error || 'Failed to get answer'
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedDoc) {
    return (
      <div className="chat-container empty">
        <div className="empty-state">
          <span className="empty-icon">💬</span>
          <h2>PDF Q&A with Endee Vector Database</h2>
          <p>Upload a PDF and select it to start asking questions.</p>
          <p className="tech-note">
            Powered by: <strong>Endee</strong> (Vector Search) + <strong>Mistral AI</strong> (Embeddings & LLM)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>💬 Chat with: {selectedDoc.name || selectedDoc.originalName}</h3>
        <span className="endee-badge">🔍 Endee Vector Search Active</span>
      </div>

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            <div className="message-content">
              {msg.type === 'user' && <span className="msg-label">You</span>}
              {msg.type === 'assistant' && <span className="msg-label">AI (via Endee RAG)</span>}
              {msg.type === 'system' && <span className="msg-label">System</span>}

              <p className="msg-text">{msg.text}</p>

              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <span className="sources-title">
                    📊 Endee Retrieved {msg.metadata?.chunksRetrieved} chunks:
                  </span>
                  {msg.sources.map((src, j) => (
                    <div key={j} className="source-item">
                      <div className="source-header">
                        <span>Source {j + 1}</span>
                        <span className="score">
                          Similarity: {(src.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="source-text">{src.text.substring(0, 200)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="message-content">
              <span className="msg-label">AI (via Endee RAG)</span>
              <div className="typing-indicator">
                <span></span><span></span><span></span>
                Searching Endee & generating answer...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the document..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatInterface;