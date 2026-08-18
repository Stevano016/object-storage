import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PORT, CORS_ORIGIN } from './utils/config.js';
import { initDb } from './utils/db.js';
import {
  authenticateJWT,
  authenticateFlexible,
  requireSuperAdmin,
  requireSuperAdminOrApiKey
} from './middleware/auth.js';
import { login, me, changePassword, getStats } from './controllers/authController.js';
import { listBuckets, createBucket, updateBucket, deleteBucket } from './controllers/bucketController.js';
import { upload, listFiles, uploadFile, downloadFile, deleteFile } from './controllers/fileController.js';
import { listAPIKeys, createAPIKey, deleteAPIKey } from './controllers/keyController.js';
import { listUsers, createUser, updateUser, deleteUser } from './controllers/userController.js';
import { resolveShare, requireShareEditor } from './middleware/share.js';
import {
  listShares,
  createShare,
  updateShare,
  deleteShare,
  getSharedInfo,
  listSharedFiles,
  uploadSharedFile,
  deleteSharedFile
} from './controllers/shareController.js';

const app = express();

app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Authentication (any signed-in account) ---
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateJWT, me);
app.post('/api/auth/change-password', authenticateJWT, changePassword);
app.get('/api/auth/stats', authenticateJWT, getStats);

// --- Buckets: everyone may browse, only superadmins may reshape them ---
app.get('/api/buckets', authenticateJWT, listBuckets);
app.post('/api/buckets', authenticateJWT, requireSuperAdmin, createBucket);
app.put('/api/buckets/:bucketName', authenticateJWT, requireSuperAdmin, updateBucket);
app.delete('/api/buckets/:bucketName', authenticateJWT, requireSuperAdmin, deleteBucket);

// --- Files: regular users may list and upload; deleting is privileged ---
app.get('/api/buckets/:bucketName/files', authenticateFlexible, listFiles);
app.post('/api/buckets/:bucketName/files', authenticateFlexible, upload.single('file'), uploadFile);
app.delete('/api/buckets/:bucketName/files/:fileId', authenticateFlexible, requireSuperAdminOrApiKey, deleteFile);

// --- API keys (superadmin only) ---
app.get('/api/keys', authenticateJWT, requireSuperAdmin, listAPIKeys);
app.post('/api/keys', authenticateJWT, requireSuperAdmin, createAPIKey);
app.delete('/api/keys/:id', authenticateJWT, requireSuperAdmin, deleteAPIKey);

// --- User management (superadmin only) ---
app.get('/api/users', authenticateJWT, requireSuperAdmin, listUsers);
app.post('/api/users', authenticateJWT, requireSuperAdmin, createUser);
app.put('/api/users/:id', authenticateJWT, requireSuperAdmin, updateUser);
app.delete('/api/users/:id', authenticateJWT, requireSuperAdmin, deleteUser);

// --- Share links: management is privileged, usage is anonymous ---
app.get('/api/shares', authenticateJWT, requireSuperAdmin, listShares);
app.post('/api/shares', authenticateJWT, requireSuperAdmin, createShare);
app.put('/api/shares/:id', authenticateJWT, requireSuperAdmin, updateShare);
app.delete('/api/shares/:id', authenticateJWT, requireSuperAdmin, deleteShare);

// The token in the URL is the whole credential — no session required.
app.get('/api/share/:token', resolveShare, getSharedInfo);
app.get('/api/share/:token/files', resolveShare, listSharedFiles);
app.post('/api/share/:token/files', resolveShare, requireShareEditor, upload.single('file'), uploadSharedFile);
app.delete('/api/share/:token/files/:fileId', resolveShare, requireShareEditor, deleteSharedFile);

// Public/private storage router (outside /api for cleaner URLs).
// downloadFile authorizes internally so HTML5 media players can stream directly.
app.get('/s/:bucketName/:filename', downloadFile);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve the built React dashboard in production
const webDistPath = path.resolve('../web/dist');
if (fs.existsSync(webDistPath)) {
  console.log(`Serving static web assets from: ${webDistPath}`);
  app.use(express.static(webDistPath));
  app.get('*', (req, res, next) => {
    // Note the trailing slashes: '/s' alone would also swallow '/share/:token',
    // which must be handed to the SPA so the public share page can render.
    if (req.path.startsWith('/api/') || req.path.startsWith('/s/')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

async function startServer() {
  try {
    console.log('Initializing database...');
    await initDb();

    app.listen(PORT, () => {
      console.log('==================================================');
      console.log(`Gentan Storage server running on port: ${PORT}`);
      console.log(`Local url: http://localhost:${PORT}`);
      console.log('==================================================');
    });
  } catch (error) {
    console.error('Failed to start Gentan Storage server:', error);
    process.exit(1);
  }
}

startServer();
export default app;
