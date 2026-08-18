import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDb } from './utils/db.js';
import { 
  authenticateJWT, 
  authenticateFlexible 
} from './middleware/auth.js';
import { 
  login, 
  changePassword, 
  getStats 
} from './controllers/authController.js';
import { 
  listBuckets, 
  createBucket, 
  updateBucket, 
  deleteBucket 
} from './controllers/bucketController.js';
import { 
  upload, 
  listFiles, 
  uploadFile, 
  downloadFile, 
  deleteFile 
} from './controllers/fileController.js';
import { 
  listAPIKeys, 
  createAPIKey, 
  deleteAPIKey 
} from './controllers/keyController.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with security settings
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Parse JSON request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve API routes
// Authentication Routes
app.post('/api/auth/login', login);
app.post('/api/auth/change-password', authenticateJWT, changePassword);
app.get('/api/auth/stats', authenticateJWT, getStats);

// Bucket Routes
app.get('/api/buckets', authenticateJWT, listBuckets);
app.post('/api/buckets', authenticateJWT, createBucket);
app.put('/api/buckets/:bucketName', authenticateJWT, updateBucket);
app.delete('/api/buckets/:bucketName', authenticateJWT, deleteBucket);

// File Metadata Routes (Protected by either JWT or API Key)
app.get('/api/buckets/:bucketName/files', authenticateFlexible, listFiles);
app.post('/api/buckets/:bucketName/files', authenticateFlexible, upload.single('file'), uploadFile);
app.delete('/api/buckets/:bucketName/files/:fileId', authenticateFlexible, deleteFile);

// API Key Routes (Admin only)
app.get('/api/keys', authenticateJWT, listAPIKeys);
app.post('/api/keys', authenticateJWT, createAPIKey);
app.delete('/api/keys/:id', authenticateJWT, deleteAPIKey);

// Public/Private Storage Router (Outside /api for cleaner URL routes)
// Note: downloadFile handles authorization inside itself to allow seamless HTML5 player integration
app.get('/s/:bucketName/:filename', downloadFile);

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve React dashboard statically in production
const webDistPath = path.resolve('../web/dist');
if (fs.existsSync(webDistPath)) {
  console.log(`Serving static web assets from: ${webDistPath}`);
  app.use(express.static(webDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/s')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// Initialize database and start the server
async function startServer() {
  try {
    console.log('Initializing database...');
    await initDb();
    
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`Gentan Storage server running on port: ${PORT}`);
      console.log(`Local url: http://localhost:${PORT}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Failed to start Gentan Storage server:', error);
    process.exit(1);
  }
}

startServer();
export default app;
