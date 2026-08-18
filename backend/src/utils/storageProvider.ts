import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { 
  S3Client, 
  CreateBucketCommand, 
  DeleteBucketCommand, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';
import './config.js'; // ensures .env is loaded before the provider type is read

dotenv.config();

const providerType = process.env.STORAGE_PROVIDER || 'local';
const dataDir = path.resolve('data');
const localStorageDir = path.join(dataDir, 'storage');

export interface FileStreamResult {
  stream: Readable;
  size: number;
}

export interface StorageProvider {
  createBucket(bucketId: string): Promise<void>;
  deleteBucket(bucketId: string): Promise<void>;
  uploadFile(bucketId: string, fileId: string, localFilePath: string, mimeType: string): Promise<string>;
  deleteFile(bucketId: string, fileId: string): Promise<void>;
  getFileStream(bucketId: string, fileId: string, range?: { start: number; end: number }): Promise<FileStreamResult>;
}

// --------------------------------------------------------------------------
// 1. LOCAL STORAGE PROVIDER
// --------------------------------------------------------------------------
class LocalStorageProvider implements StorageProvider {
  async createBucket(bucketId: string): Promise<void> {
    const bucketPath = path.join(localStorageDir, bucketId);
    if (!fs.existsSync(bucketPath)) {
      fs.mkdirSync(bucketPath, { recursive: true });
    }
  }

  async deleteBucket(bucketId: string): Promise<void> {
    const bucketPath = path.join(localStorageDir, bucketId);
    if (fs.existsSync(bucketPath)) {
      fs.rmSync(bucketPath, { recursive: true, force: true });
    }
  }

  async uploadFile(bucketId: string, fileId: string, localFilePath: string, mimeType: string): Promise<string> {
    // Multer already saves it to the correct path, so we just return the local file path
    const destPath = path.join(localStorageDir, bucketId, `${fileId}.dat`);
    if (localFilePath !== destPath) {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.renameSync(localFilePath, destPath);
    }
    return destPath;
  }

  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    const filePath = path.join(localStorageDir, bucketId, `${fileId}.dat`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getFileStream(bucketId: string, fileId: string, range?: { start: number; end: number }): Promise<FileStreamResult> {
    const filePath = path.join(localStorageDir, bucketId, `${fileId}.dat`);
    if (!fs.existsSync(filePath)) {
      throw new Error('Physical file not found.');
    }
    
    const size = fs.statSync(filePath).size;
    let stream: Readable;

    if (range) {
      stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    } else {
      stream = fs.createReadStream(filePath);
    }

    return { stream, size };
  }
}

// --------------------------------------------------------------------------
// 2. MINIO / S3 STORAGE PROVIDER
// --------------------------------------------------------------------------
class S3StorageProvider implements StorageProvider {
  private s3: S3Client;
  private bucketPrefix: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION || 'us-east-1';
    
    this.bucketPrefix = process.env.S3_BUCKET_PREFIX || 'gentan-';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('S3 configurations are incomplete. Please define S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY in .env');
    }

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Required for MinIO
    });
  }

  // Helper to map app bucketId to MinIO bucket name (MinIO needs lowercase alphanumeric and hyphens, max 63 chars)
  private getS3BucketName(bucketId: string): string {
    return `${this.bucketPrefix}${bucketId}`.toLowerCase();
  }

  async createBucket(bucketId: string): Promise<void> {
    const bucketName = this.getS3BucketName(bucketId);
    try {
      await this.s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (err: any) {
      // Ignore if bucket already exists
      if (err.name !== 'BucketAlreadyExists' && err.name !== 'BucketAlreadyOwnedByYou') {
        throw err;
      }
    }
  }

  async deleteBucket(bucketId: string): Promise<void> {
    const bucketName = this.getS3BucketName(bucketId);
    try {
      await this.s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
    } catch (err: any) {
      // Ignore if already deleted
      if (err.name !== 'NoSuchBucket') {
        throw err;
      }
    }
  }

  async uploadFile(bucketId: string, fileId: string, localFilePath: string, mimeType: string): Promise<string> {
    const bucketName = this.getS3BucketName(bucketId);
    const key = `${fileId}.dat`;

    // Ensure bucket exists in MinIO
    await this.createBucket(bucketId);

    const fileStream = fs.createReadStream(localFilePath);

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: fileStream,
        ContentType: mimeType
      }
    });

    await upload.done();

    // Cleanup temp uploaded file from local server disk
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    // Return the virtual S3 URL/Key
    return `s3://${bucketName}/${key}`;
  }

  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    const bucketName = this.getS3BucketName(bucketId);
    const key = `${fileId}.dat`;
    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      }));
    } catch (err: any) {
      if (err.name !== 'NoSuchKey') {
        throw err;
      }
    }
  }

  async getFileStream(bucketId: string, fileId: string, range?: { start: number; end: number }): Promise<FileStreamResult> {
    const bucketName = this.getS3BucketName(bucketId);
    const key = `${fileId}.dat`;

    // First fetch size via HEAD request
    const head = await this.s3.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    }));

    const totalSize = head.ContentLength || 0;
    let rangeHeader: string | undefined;

    if (range) {
      rangeHeader = `bytes=${range.start}-${range.end}`;
    }

    const response = await this.s3.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      Range: rangeHeader
    }));

    if (!response.Body) {
      throw new Error('S3 object body is empty.');
    }

    return {
      stream: response.Body as Readable,
      size: range ? (range.end - range.start) + 1 : totalSize
    };
  }
}

// --------------------------------------------------------------------------
// PROVIDER FACTORY
// --------------------------------------------------------------------------
let activeProvider: StorageProvider;

if (providerType === 'minio' || providerType === 's3') {
  activeProvider = new S3StorageProvider();
} else {
  activeProvider = new LocalStorageProvider();
}

console.log(`Active Storage Provider: [${providerType.toUpperCase()}]`);

export function getStorageProvider(): StorageProvider {
  return activeProvider;
}
