const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const uploadRoutes = require('./routes/uploadRoutes');
const queryRoutes = require('./routes/queryRoutes');
const endeeService = require('./services/endeeService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', uploadRoutes);
app.use('/api', queryRoutes);

// Health check — Endee only
app.get('/api/health', async (req, res) => {
  try {
    const endeeHealth = await endeeService.healthCheck();
    res.json({
      status: 'ok',
      server: 'running',
      endeeVectorDB: endeeHealth ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// List all Endee collections
app.get('/api/collections', async (req, res) => {
  try {
    const collections = await endeeService.listCollections();
    res.json({ collections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server — no DB dependency
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Endee Vector DB: ${process.env.ENDEE_HOST || 'http://127.0.0.1:8080'}`);
  console.log(`🧠 Mistral API ready`);
});