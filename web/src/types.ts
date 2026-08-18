export type UserRole = 'superadmin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface ManagedUser extends AuthUser {
  createdAt: string;
}

export interface Bucket {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  fileCount: number;
  totalSize: number;
}

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
}

export interface DiskUsage {
  total: number;
  free: number;
  used: number;
}

export interface Stats {
  buckets: number;
  files: number;
  totalSize: number;
  physicalDiskSize: number;
  apiKeys: number;
  users: number;
  disk: DiskUsage | null;
  diskLabel: string;
  storageProvider: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

export type TabId = 'overview' | 'buckets' | 'files' | 'keys' | 'users' | 'settings';
