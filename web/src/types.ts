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
  /** Storage ceiling in bytes, or null when the bucket is unlimited. */
  quotaBytes: number | null;
}

/** A folder inside a bucket. Folders are metadata; objects stay flat in storage. */
export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  fileCount: number;
  subfolderCount: number;
}

/** One step of the breadcrumb, bucket root excluded. */
export interface FolderCrumb {
  id: string;
  name: string;
}

/** Flattened tree for the "move to folder" picker. */
export interface FolderOption {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
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
  /** Accounts still reachable with the password published in the README. */
  accountsUsingDefaultPassword: string[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type SharePermission = 'viewer' | 'editor';

export interface ShareLink {
  id: string;
  token: string;
  permission: SharePermission;
  label: string | null;
  bucketName: string;
  fileId: string | null;
  fileName: string | null;
  expiresAt: string | null;
  createdAt: string;
  path: string;
}

/** What a visitor holding a share link is told about it. */
export interface ShareInfo {
  permission: SharePermission;
  bucketName: string;
  label: string | null;
  scope: 'bucket' | 'file';
  expiresAt: string | null;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
}

export type TabId = 'overview' | 'buckets' | 'files' | 'shares' | 'keys' | 'users' | 'settings';
