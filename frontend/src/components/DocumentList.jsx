import React from 'react';
import './DocumentList.css';

function DocumentList({ documents, selectedDoc, onSelect, onDelete }) {
  return (
    <div className="doc-list-section">
      <h3>📚 Documents in Endee</h3>
      {documents.length === 0 ? (
        <p className="no-docs">No documents uploaded yet</p>
      ) : (
        <div className="doc-list">
          {documents.map(doc => (
            <div
              key={doc._id}
              className={`doc-item ${selectedDoc?.collectionName === doc.collectionName ? 'selected' : ''}`}
              onClick={() => onSelect(doc)}
            >
              <div className="doc-info">
                <span className="doc-name">{doc.name}</span>
                <span className="doc-meta">
                  {doc.chunkCount} chunks • {doc.pageCount} pages
                </span>
                <span className="doc-collection">
                  Endee: {doc.collectionName}
                </span>
              </div>
              <div className="doc-actions">
                <span className={`doc-status ${doc.status}`}>{doc.status}</span>
                <button
                  className="delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDelete(doc._id); }}
                  title="Delete document & Endee collection"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentList;