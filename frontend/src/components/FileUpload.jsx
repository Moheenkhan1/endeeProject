import React, { useCallback, useState } from 'react';
import './FileUpload.css';

function FileUpload({ onUpload, loading }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      await processFile(file);
    }
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) await processFile(file);
  };

  const processFile = async (file) => {
    setError(null);
    setUploadResult(null);
    try {
      const result = await onUpload(file);
      setUploadResult(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="upload-section">
      <h3>📤 Upload PDF</h3>
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${loading ? 'processing' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !loading && document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          hidden
        />
        {loading ? (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <p>Processing & storing in Endee...</p>
          </div>
        ) : (
          <>
            <span className="upload-icon">📎</span>
            <p>Drop a PDF here or click to browse</p>
            <span className="upload-hint">Max 20MB</span>
          </>
        )}
      </div>

      {uploadResult && (
        <div className="upload-result success">
          <strong>✅ Stored in Endee!</strong>
          <span>{uploadResult.endeeStats?.vectorsStored} vectors • {uploadResult.endeeStats?.distanceMetric} distance</span>
          <span className="collection-name">Collection: {uploadResult.endeeStats?.collection}</span>
        </div>
      )}

      {error && (
        <div className="upload-result error">
          <strong>❌ Error</strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default FileUpload;