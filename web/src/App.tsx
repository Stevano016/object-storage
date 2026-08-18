import React, { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, 
  Folder, 
  File, 
  Key, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  Search, 
  Copy, 
  FileText, 
  FileVideo, 
  FileImage, 
  FileAudio,
  UploadCloud, 
  Download, 
  Globe, 
  Lock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Eye,
  User,
  KeyRound
} from 'lucide-react';
import { useAuth } from './context/AuthContext';

// Helper to format bytes to human readable sizes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface Bucket {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  fileCount: number;
  totalSize: number;
}

interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
}

interface Stats {
  buckets: number;
  files: number;
  totalSize: number;
  physicalDiskSize: number;
  apiKeys: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function App() {
  const { isAuthenticated, user, token, logout, login, apiFetch, apiUrl } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'buckets' | 'files' | 'keys' | 'settings'>('overview');
  
  // Toast Notification State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Auth Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      return showToast('Masukkan username dan password.', 'error');
    }
    setLoginLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login gagal.');
      }
      login(data.token, data.user);
      showToast('Login berhasil! Selamat datang.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // Stats State
  const [stats, setStats] = useState<Stats>({ buckets: 0, files: 0, totalSize: 0, physicalDiskSize: 0, apiKeys: 0 });
  const fetchStats = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch('/api/auth/stats');
      setStats(data);
    } catch (err: any) {
      showToast('Gagal memuat statistik server.', 'error');
    }
  };

  // Buckets State
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [showCreateBucketModal, setShowCreateBucketModal] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketIsPublic, setNewBucketIsPublic] = useState(false);
  const [createBucketLoading, setCreateBucketLoading] = useState(false);

  const fetchBuckets = async () => {
    if (!isAuthenticated) return;
    setBucketsLoading(true);
    try {
      const data = await apiFetch('/api/buckets');
      setBuckets(data);
    } catch (err: any) {
      showToast('Gagal memuat daftar bucket.', 'error');
    } finally {
      setBucketsLoading(false);
    }
  };

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName) return;
    setCreateBucketLoading(true);
    try {
      await apiFetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBucketName, isPublic: newBucketIsPublic })
      });
      showToast(`Bucket '${newBucketName}' berhasil dibuat.`, 'success');
      setNewBucketName('');
      setNewBucketIsPublic(false);
      setShowCreateBucketModal(false);
      fetchBuckets();
      fetchStats();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreateBucketLoading(false);
    }
  };

  const handleDeleteBucket = async (name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus bucket '${name}' dan semua isinya? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await apiFetch(`/api/buckets/${name}`, { method: 'DELETE' });
      showToast(`Bucket '${name}' telah dihapus.`, 'success');
      fetchBuckets();
      fetchStats();
      if (activeBucket === name) setActiveBucket('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleBucketPublic = async (bucket: Bucket) => {
    try {
      const nextPublic = !bucket.isPublic;
      await apiFetch(`/api/buckets/${bucket.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: nextPublic })
      });
      showToast(`Akses bucket '${bucket.name}' diubah ke ${nextPublic ? 'PUBLIK' : 'PRIVAT'}.`, 'success');
      fetchBuckets();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Files State
  const [activeBucket, setActiveBucket] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [filePage, setFilePage] = useState(1);
  const [filePages, setFilePages] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected File View State
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFileBucket, setSelectedFileBucket] = useState<string>('');

  const fetchFiles = async (bucketName: string, page = 1, search = '') => {
    if (!bucketName || !isAuthenticated) return;
    setFilesLoading(true);
    try {
      const data = await apiFetch(`/api/buckets/${bucketName}/files?page=${page}&limit=24&search=${encodeURIComponent(search)}`);
      setFiles(data.files);
      setFilePage(data.pagination.page);
      setFilePages(data.pagination.pages);
    } catch (err: any) {
      showToast('Gagal memuat berkas.', 'error');
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    if (activeBucket) {
      fetchFiles(activeBucket, 1, fileSearch);
    } else {
      setFiles([]);
    }
  }, [activeBucket]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileSearch(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(activeBucket, 1, fileSearch);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      uploadSelectedFile(droppedFiles[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected && selected.length > 0) {
      uploadSelectedFile(selected[0]);
    }
  };

  const uploadSelectedFile = (file: File) => {
    if (!activeBucket) return showToast('Pilih bucket terlebih dahulu.', 'error');
    setUploadLoading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${apiUrl}/api/buckets/${activeBucket}/files`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploadLoading(false);
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        showToast(`Berkas '${file.name}' berhasil diunggah.`, 'success');
        setShowUploadModal(false);
        fetchFiles(activeBucket, 1, fileSearch);
        fetchStats();
        fetchBuckets(); // reload sizes
      } else {
        let errorMsg = 'Gagal mengunggah berkas.';
        try {
          const resJson = JSON.parse(xhr.responseText);
          errorMsg = resJson.error || errorMsg;
        } catch (_) {}
        showToast(errorMsg, 'error');
      }
    };

    xhr.onerror = () => {
      setUploadLoading(false);
      setUploadProgress(null);
      showToast('Jaringan bermasalah saat mengunggah.', 'error');
    };

    xhr.send(formData);
  };

  const handleDeleteFile = async (fileId: string, bucketName: string) => {
    if (!window.confirm('Hapus berkas ini secara permanen dari server?')) return;
    try {
      await apiFetch(`/api/buckets/${bucketName}/files/${fileId}`, { method: 'DELETE' });
      showToast('Berkas berhasil dihapus.', 'success');
      setSelectedFile(null);
      fetchFiles(bucketName, filePage, fileSearch);
      fetchStats();
      fetchBuckets(); // reload sizes
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createKeyLoading, setCreateKeyLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    if (!isAuthenticated) return;
    setApiKeysLoading(true);
    try {
      const data = await apiFetch('/api/keys');
      setApiKeys(data);
    } catch (err: any) {
      showToast('Gagal memuat API Key.', 'error');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    setCreateKeyLoading(true);
    setGeneratedKey(null);
    try {
      const data = await apiFetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName })
      });
      setGeneratedKey(data.apiKey);
      setNewKeyName('');
      fetchApiKeys();
      fetchStats();
      showToast('API Key baru berhasil dibuat.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreateKeyLoading(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!window.confirm('Revoke API Key ini? Aplikasi luar tidak akan bisa mengakses storage menggunakan key ini.')) return;
    try {
      await apiFetch(`/api/keys/${id}`, { method: 'DELETE' });
      showToast('API Key berhasil direvoke.', 'success');
      fetchApiKeys();
      fetchStats();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Settings State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return showToast('Semua input password wajib diisi.', 'error');
    }
    if (newPassword !== confirmPassword) {
      return showToast('Password baru dan konfirmasi tidak cocok.', 'error');
    }
    setPasswordLoading(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      showToast('Password admin berhasil diubah.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Initialize and React to Tab Changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchBuckets();
      fetchApiKeys();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // When returning to files view, auto-select first bucket if none selected
    if (activeTab === 'files' && buckets.length > 0 && !activeBucket) {
      setActiveBucket(buckets[0].name);
    }
  }, [activeTab, buckets]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Disalin ke clipboard!', 'success');
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage className="file-card-icon" />;
    if (mimeType.startsWith('video/')) return <FileVideo className="file-card-icon" />;
    if (mimeType.startsWith('audio/')) return <FileAudio className="file-card-icon" />;
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return <FileText className="file-card-icon" />;
    return <File className="file-card-icon" />;
  };

  // RENDER LOGIN PAGE IF NOT AUTHENTICATED
  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <HardDrive />
            <h1>Gentan Storage</h1>
            <p>Self-Hosted Secure Object Storage Server</p>
          </div>
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                className="form-input"
                id="username"
                type="text"
                placeholder="admin"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} type="submit" disabled={loginLoading}>
              {loginLoading ? <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} /> : 'Masuk ke Dashboard'}
            </button>
          </form>
        </div>
        
        {/* Simple Toasts */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === 'success' && <CheckCircle style={{ width: 18, height: 18 }} />}
              {t.type === 'error' && <AlertTriangle style={{ width: 18, height: 18 }} />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // RENDER MAIN DASHBOARD
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <HardDrive style={{ width: 24, height: 24 }} />
          <span>Gentan Storage</span>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexGrow: 1 }}>
          <button 
            className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <HardDrive />
            Overview
          </button>
          <button 
            className={`nav-btn ${activeTab === 'buckets' ? 'active' : ''}`}
            onClick={() => setActiveTab('buckets')}
          >
            <Folder />
            Buckets
          </button>
          <button 
            className={`nav-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <File />
            File Browser
          </button>
          <button 
            className={`nav-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <Key />
            API Keys
          </button>
          <button 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings />
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingLeft: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', color: 'var(--accent-primary)', flexShrink: 0, justifyContent: 'center' }}>
              <User style={{ width: 16, height: 16 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Administrator</span>
            </div>
          </div>
          <button className="nav-btn" onClick={logout} style={{ color: 'var(--danger)' }}>
            <LogOut style={{ width: 18, height: 18 }} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header">
          <h2 style={{ textTransform: 'capitalize' }}>{activeTab}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => { fetchStats(); fetchBuckets(); fetchApiKeys(); if (activeBucket) fetchFiles(activeBucket, filePage, fileSearch); showToast('Data diperbarui.', 'info'); }} style={{ padding: '0.5rem 0.75rem' }}>
              <RefreshCw style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Server: Gentan VPS</span>
          </div>
        </header>

        <div className="page-body">
          {/* TOASTS PANEL */}
          <div className="toast-container">
            {toasts.map(t => (
              <div key={t.id} className={`toast toast-${t.type}`}>
                {t.type === 'success' && <CheckCircle style={{ width: 18, height: 18 }} />}
                {t.type === 'error' && <AlertTriangle style={{ width: 18, height: 18 }} />}
                <span>{t.text}</span>
              </div>
            ))}
          </div>

          {/* ==================== TAB: OVERVIEW ==================== */}
          {activeTab === 'overview' && (
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon"><Folder /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.buckets}</span>
                    <span className="stat-label">Total Buckets</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><File /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.files}</span>
                    <span className="stat-label">Total Files</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><HardDrive /></div>
                  <div className="stat-info">
                    <span className="stat-value">{formatBytes(stats.totalSize)}</span>
                    <span className="stat-label">Storage Used</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><Key /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.apiKeys}</span>
                    <span className="stat-label">Active API Keys</span>
                  </div>
                </div>
              </div>

              <div className="overview-grid">
                <div className="dashboard-panel">
                  <div className="panel-header">
                    <h3>Penyimpanan VPS</h3>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      <span>Ukuran Fisik Folder Data:</span>
                      <span style={{ fontWeight: 600 }}>{formatBytes(stats.physicalDiskSize)}</span>
                    </div>
                    <div className="progress-bar-container" style={{ height: '12px' }}>
                      {/* Simulating size indicator on storage folder */}
                      <div className="progress-bar-fill" style={{ width: `${Math.min(100, (stats.physicalDiskSize / (1024 * 1024 * 1024 * 50)) * 100)}%` }}></div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Kapasitas folder disk lokal server. Metadata bucket tersimpan di database SQLite lokal.
                    </p>
                  </div>
                </div>

                <div className="dashboard-panel">
                  <h3>Panduan Akses API</h3>
                  <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    <p>Gunakan header HTTP ini untuk program eksternal:</p>
                    <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>X-API-Key: YOUR_API_KEY</code>
                    <p>Endpoint URL Dasar:</p>
                    <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{apiUrl}/api/buckets/[bucket_name]/files</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: BUCKETS ==================== */}
          {activeTab === 'buckets' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Daftar Storage Buckets</h3>
                <button className="btn btn-primary" onClick={() => setShowCreateBucketModal(true)}>
                  <Plus style={{ width: 18, height: 18 }} />
                  Buat Bucket Baru
                </button>
              </div>

              {bucketsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 className="animate-spin" />
                </div>
              ) : buckets.length === 0 ? (
                <div className="empty-state">
                  <Folder />
                  <h3>Belum ada Bucket</h3>
                  <p>Buat bucket pertama Anda untuk mengelompokkan berkas foto atau video yang diunggah.</p>
                  <button className="btn btn-primary" onClick={() => setShowCreateBucketModal(true)}>
                    Buat Bucket Baru
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nama Bucket</th>
                        <th>Status Akses</th>
                        <th>Jumlah File</th>
                        <th>Total Ukuran</th>
                        <th>Tanggal Dibuat</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</td>
                          <td>
                            <button 
                              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                              onClick={() => handleToggleBucketPublic(b)}
                              title="Klik untuk mengubah visibilitas"
                            >
                              {b.isPublic ? (
                                <span className="badge badge-public">
                                  <Globe style={{ width: 12, height: 12 }} />
                                  Publik
                                </span>
                              ) : (
                                <span className="badge badge-private">
                                  <Lock style={{ width: 12, height: 12 }} />
                                  Privat
                                </span>
                              )}
                            </button>
                          </td>
                          <td>{b.fileCount} berkas</td>
                          <td>{formatBytes(b.totalSize)}</td>
                          <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-secondary btn-icon-only" 
                                onClick={() => { setActiveBucket(b.name); setActiveTab('files'); }}
                                title="Buka berkas di bucket ini"
                              >
                                <Eye style={{ width: 16, height: 16 }} />
                              </button>
                              <button 
                                className="btn btn-danger btn-icon-only" 
                                onClick={() => handleDeleteBucket(b.name)}
                                title="Hapus Bucket"
                              >
                                <Trash2 style={{ width: 16, height: 16 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CREATE BUCKET MODAL */}
              {showCreateBucketModal && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3>Buat Bucket Baru</h3>
                      <button className="btn btn-secondary btn-icon-only" onClick={() => setShowCreateBucketModal(false)}>
                        <X style={{ width: 18, height: 18 }} />
                      </button>
                    </div>
                    <form onSubmit={handleCreateBucket}>
                      <div className="modal-body">
                        <div className="form-group">
                          <label className="form-label">Nama Bucket</label>
                          <input
                            className="form-input"
                            type="text"
                            placeholder="foto-kegiatan"
                            value={newBucketName}
                            onChange={e => setNewBucketName(e.target.value)}
                            required
                          />
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Hanya huruf kecil, angka, dan tanda hubung (-). Panjang 3-63 karakter.
                          </p>
                        </div>
                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label className="checkbox-label">
                            <input
                              className="checkbox-input"
                              type="checkbox"
                              checked={newBucketIsPublic}
                              onChange={e => setNewBucketIsPublic(e.target.checked)}
                            />
                            Akses Publik (Izinkan siapa saja mengakses berkas tanpa autentikasi)
                          </label>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={() => setShowCreateBucketModal(false)}>
                          Batal
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={createBucketLoading}>
                          {createBucketLoading ? <Loader2 className="animate-spin" /> : 'Buat Bucket'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB: FILE BROWSER ==================== */}
          {activeTab === 'files' && (
            <div>
              <div className="explorer-header">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexGrow: 1, minWidth: '250px' }}>
                  <Folder style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <select 
                    className="form-input" 
                    value={activeBucket} 
                    onChange={e => { setActiveBucket(e.target.value); setFileSearch(''); }}
                    style={{ maxWidth: '250px', cursor: 'pointer' }}
                  >
                    <option value="">Pilih Bucket...</option>
                    {buckets.map(b => (
                      <option key={b.id} value={b.name}>{b.name} ({b.isPublic ? 'Publik' : 'Privat'})</option>
                    ))}
                  </select>
                  
                  {activeBucket && (
                    <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                      <UploadCloud style={{ width: 18, height: 18 }} />
                      Unggah File
                    </button>
                  )}
                </div>

                {activeBucket && (
                  <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
                    <Search />
                    <input 
                      className="form-input" 
                      type="text" 
                      placeholder="Cari berkas..." 
                      value={fileSearch} 
                      onChange={handleSearchChange} 
                    />
                  </form>
                )}
              </div>

              {!activeBucket ? (
                <div className="empty-state">
                  <Folder />
                  <h3>Belum ada Bucket yang terpilih</h3>
                  <p>Pilih salah satu bucket dari daftar drop-down di atas untuk melihat isi berkasnya.</p>
                </div>
              ) : filesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                  <Loader2 className="animate-spin" />
                </div>
              ) : files.length === 0 ? (
                <div className="empty-state">
                  <File />
                  <h3>Bucket Kosong</h3>
                  <p>Belum ada foto atau video di dalam bucket '{activeBucket}'.</p>
                  <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                    Unggah File Pertama
                  </button>
                </div>
              ) : (
                <div>
                  <div className="file-grid">
                    {files.map(f => {
                      const isImage = f.mimeType.startsWith('image/');
                      const isVideo = f.mimeType.startsWith('video/');
                      
                      // For private bucket images, we load using token param for browser render auth
                      const bucketRecord = buckets.find(b => b.name === activeBucket);
                      const isPublicBucket = bucketRecord?.isPublic;
                      const authParam = isPublicBucket ? '' : `&token=${token}`;
                      const previewUrl = `${apiUrl}/s/${activeBucket}/${f.name}?id=${f.id}${authParam}`;

                      return (
                        <div key={f.id} className="file-card" onClick={() => { setSelectedFile(f); setSelectedFileBucket(activeBucket); }}>
                          <div className="file-card-preview">
                            {isImage ? (
                              <img src={previewUrl} alt={f.originalName} loading="lazy" />
                            ) : isVideo ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                <FileVideo className="file-card-icon" style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Video Player</span>
                              </div>
                            ) : (
                              getFileIcon(f.mimeType)
                            )}
                          </div>
                          <div className="file-card-info">
                            <span className="file-card-name" title={f.originalName}>{f.originalName}</span>
                            <div className="file-card-meta">
                              <span>{formatBytes(f.size)}</span>
                              <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {filePages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                      <button 
                        className="btn btn-secondary" 
                        disabled={filePage <= 1}
                        onClick={() => fetchFiles(activeBucket, filePage - 1, fileSearch)}
                      >
                        Sebelumnya
                      </button>
                      <span style={{ alignSelf: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Halaman {filePage} dari {filePages}</span>
                      <button 
                        className="btn btn-secondary" 
                        disabled={filePage >= filePages}
                        onClick={() => fetchFiles(activeBucket, filePage + 1, fileSearch)}
                      >
                        Selanjutnya
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* UPLOAD FILE MODAL */}
              {showUploadModal && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h3>Unggah Berkas ke '{activeBucket}'</h3>
                      <button className="btn btn-secondary btn-icon-only" onClick={() => setShowUploadModal(false)}>
                        <X style={{ width: 18, height: 18 }} />
                      </button>
                    </div>
                    <div className="modal-body">
                      {uploadLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
                          <Loader2 className="animate-spin" style={{ width: 40, height: 40, marginBottom: '1rem', color: 'var(--accent-primary)' }} />
                          <span style={{ fontWeight: 500 }}>Sedang Mengunggah Berkas...</span>
                          {uploadProgress !== null && (
                            <div style={{ width: '100%', marginTop: '1.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                <span>Kemajuan:</span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <div className="progress-bar-container">
                                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          className="dropzone"
                          onDragOver={e => e.preventDefault()}
                          onDrop={handleFileDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            style={{ display: 'none' }} 
                          />
                          <UploadCloud className="dropzone-icon" />
                          <p className="dropzone-text">Klik atau seret berkas Anda ke sini</p>
                          <p className="dropzone-subtext">Mendukung berkas Gambar, Video, Audio, Dokumen, dll hingga 500MB</p>
                        </div>
                      )}
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)} disabled={uploadLoading}>
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* FILE DETAILS VIEW MODAL */}
              {selectedFile && (
                <div className="modal-overlay" onClick={() => setSelectedFile(null)}>
                  <div className="modal-content large" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3 style={{ maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Detail: {selectedFile.originalName}</h3>
                      <button className="btn btn-secondary btn-icon-only" onClick={() => setSelectedFile(null)}>
                        <X style={{ width: 18, height: 18 }} />
                      </button>
                    </div>
                    <div className="modal-body">
                      <div className="media-preview-container">
                        {/* Stream View Container */}
                        <div className="media-viewer">
                          {selectedFile.mimeType.startsWith('image/') ? (
                            <img 
                              src={`${apiUrl}/s/${selectedFileBucket}/${selectedFile.name}?id=${selectedFile.id}${!buckets.find(b => b.name === selectedFileBucket)?.isPublic ? `&token=${token}` : ''}`} 
                              alt={selectedFile.originalName} 
                            />
                          ) : selectedFile.mimeType.startsWith('video/') ? (
                            <video 
                              controls 
                              preload="metadata"
                              playsInline
                              src={`${apiUrl}/s/${selectedFileBucket}/${selectedFile.name}?id=${selectedFile.id}${!buckets.find(b => b.name === selectedFileBucket)?.isPublic ? `&token=${token}` : ''}`} 
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                              {getFileIcon(selectedFile.mimeType)}
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Pratinjau media tidak tersedia untuk tipe file ini.</span>
                            </div>
                          )}
                        </div>

                        {/* File Metadata Details List */}
                        <div className="file-details-list">
                          <div className="detail-item">
                            <span className="detail-label">Nama Asli</span>
                            <span className="detail-value">{selectedFile.originalName}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Tipe File</span>
                            <span className="detail-value">{selectedFile.mimeType}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Ukuran</span>
                            <span className="detail-value">{formatBytes(selectedFile.size)}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Tanggal Unggah</span>
                            <span className="detail-value">{new Date(selectedFile.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* URLs Generation Box */}
                        <div className="dashboard-panel" style={{ backgroundColor: 'var(--bg-primary)' }}>
                          <span className="detail-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Tautan Berkas</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                                <span>URL Publik Stream / Download:</span>
                                <button style={{ border: 'none', background: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }} onClick={() => copyToClipboard(`${apiUrl}/s/${selectedFileBucket}/${selectedFile.name}?id=${selectedFile.id}`)}>Salin Link</button>
                              </div>
                              <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', display: 'block' }}>
                                {apiUrl}/s/{selectedFileBucket}/{selectedFile.name}?id={selectedFile.id}
                              </code>
                            </div>

                            {!buckets.find(b => b.name === selectedFileBucket)?.isPublic && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--warning)' }}>
                                  <span>Tautan Terotentikasi (JWT Token):</span>
                                  <button style={{ border: 'none', background: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }} onClick={() => copyToClipboard(`${apiUrl}/s/${selectedFileBucket}/${selectedFile.name}?id=${selectedFile.id}&token=${token || ''}`)}>Salin Tautan</button>
                                </div>
                                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', display: 'block', color: 'var(--text-secondary)' }}>
                                  {apiUrl}/s/{selectedFileBucket}/{selectedFile.name}?id={selectedFile.id}&token={token?.substring(0, 15)}...
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => handleDeleteFile(selectedFile.id, selectedFileBucket)}>
                        <Trash2 style={{ width: 16, height: 16 }} />
                        Hapus Berkas
                      </button>
                      <a className="btn btn-secondary" href={`${apiUrl}/s/${selectedFileBucket}/${selectedFile.name}?id=${selectedFile.id}${!buckets.find(b => b.name === selectedFileBucket)?.isPublic ? `&token=${token}` : ''}`} target="_blank" rel="noopener noreferrer">
                        <Download style={{ width: 16, height: 16 }} />
                        Unduh
                      </a>
                      <button className="btn btn-primary" onClick={() => setSelectedFile(null)}>
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB: API KEYS ==================== */}
          {activeTab === 'keys' && (
            <div>
              <div className="overview-grid">
                <div className="dashboard-panel">
                  <h3>Buat API Key Baru</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', marginTop: '0.25rem' }}>
                    API Key memungkinkan skrip luar atau server lain mengunggah dan mendownload file programmatically.
                  </p>
                  
                  <form onSubmit={handleCreateApiKey}>
                    <div className="form-group">
                      <label className="form-label">Nama Deskripsi Key</label>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="Contoh: Skrip Backup Otomatis, App Mobile, dll"
                        value={newKeyName}
                        onChange={e => setNewKeyName(e.target.value)}
                        required
                      />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={createKeyLoading} style={{ marginTop: '0.5rem' }}>
                      {createKeyLoading ? <Loader2 className="animate-spin" /> : 'Buat API Key'}
                    </button>
                  </form>

                  {generatedKey && (
                    <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid var(--success-border)', backgroundColor: 'var(--success-bg)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600 }}>
                        <CheckCircle style={{ width: 18, height: 18 }} />
                        <span>API Key Berhasil Dibuat!</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        SALIN KEY INI SEKARANG. Anda tidak akan bisa melihat key ini lagi demi alasan keamanan.
                      </p>
                      <div className="secure-key-container">
                        <span className="secure-key-text">{generatedKey}</span>
                        <button className="btn btn-secondary btn-icon-only" onClick={() => copyToClipboard(generatedKey)}>
                          <Copy style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="dashboard-panel">
                  <h3>API Key Aktif</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
                    API Key yang aktif saat ini. Revoke jika mencurigai kebocoran key.
                  </p>

                  {apiKeysLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                      <Loader2 className="animate-spin" />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border-muted)', borderRadius: 'var(--radius-md)' }}>
                      Belum ada API Key aktif.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Nama Key</th>
                            <th>Dibuat</th>
                            <th style={{ textAlign: 'right' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map(k => (
                            <tr key={k.id}>
                              <td style={{ fontWeight: 600 }}>{k.name}</td>
                              <td style={{ fontSize: '0.85rem' }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="btn btn-danger btn-icon-only" onClick={() => handleDeleteApiKey(k.id)} title="Revoke Key">
                                  <Trash2 style={{ width: 14, height: 14 }} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: SETTINGS ==================== */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '600px' }}>
              <div className="dashboard-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <KeyRound style={{ color: 'var(--accent-primary)' }} />
                  <h3>Ganti Password Admin</h3>
                </div>
                
                <form onSubmit={handleChangePassword}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="curr-password">Password Saat Ini</label>
                    <input
                      className="form-input"
                      id="curr-password"
                      type="password"
                      placeholder="••••••••••••"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-password">Password Baru</label>
                    <input
                      className="form-input"
                      id="new-password"
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="conf-password">Konfirmasi Password Baru</label>
                    <input
                      className="form-input"
                      id="conf-password"
                      type="password"
                      placeholder="Ulangi password baru"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={passwordLoading} style={{ marginTop: '0.5rem' }}>
                    {passwordLoading ? <Loader2 className="animate-spin" /> : 'Perbarui Password'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
