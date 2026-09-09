import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NotFoundError } from '../exceptions/NotFoundError';
import { URL } from '../types/TypeAliases';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3Env {
  S3_ACCESSKEYID?: string;
  S3_SECRETACCESSKEY?: string;
  S3_ENDPOINT?: string;
  S3_BUCKETNAME?: string;
}

export interface PresignedUrlGenerator {
  generateGetPresignedUrl(keyName: string | null, expiresIn?: number): Promise<URL | null>;
  generatePutPresignedUrl(keyName: string, expiresIn?: number): Promise<URL>;
}

export class S3Service implements PresignedUrlGenerator {
  private client: S3Client | undefined;
  private bucketName: string | undefined;
  private accessKeyId: string | undefined;
  private secretAccessKey: string | undefined;
  private endpoint: string | undefined;

  constructor(env?: S3Env) {
    // Never throw on construction (import-time safe). Credentials are
    // validated eagerly in src/config/env.ts; unit tests inject a mock
    // PresignedUrlGenerator instead. Missing keys surface lazily on use.
    const resolved = env ?? this.readEnvShim();
    this.accessKeyId = resolved?.S3_ACCESSKEYID;
    this.secretAccessKey = resolved?.S3_SECRETACCESSKEY;
    this.endpoint = resolved?.S3_ENDPOINT;
    this.bucketName = resolved?.S3_BUCKETNAME;
  }

  private readEnvShim(): S3Env {
    // Defer to validated env without importing it at module top
    // (avoids hard crash when env is missing during isolated unit tests).
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getEnv } = require('../config/env') as typeof import('../config/env');
      const e = getEnv();
      return {
        S3_ACCESSKEYID: e.S3_ACCESSKEYID,
        S3_SECRETACCESSKEY: e.S3_SECRETACCESSKEY,
        S3_ENDPOINT: e.S3_ENDPOINT,
        S3_BUCKETNAME: e.S3_BUCKETNAME,
      };
    } catch {
      return {};
    }
  }

  private getClient(): S3Client {
    if (!this.client) {
      if (!this.accessKeyId || !this.secretAccessKey) {
        throw new NotFoundError('S3 keys not found.');
      }
      this.client = new S3Client({
        region: 'default',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  async generatePutPresignedUrl(keyName: string, expiresIn = 300): Promise<URL> {
    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: keyName,
    });

    return getSignedUrl(this.getClient(), putCommand, { expiresIn });
  }

  async generateGetPresignedUrl(keyName: string | null, expiresIn = 1800): Promise<URL | null> {
    if (!keyName) return null;

    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: keyName,
    });

    return getSignedUrl(this.getClient(), getCommand, { expiresIn });
  }
}

let shared: S3Service | undefined;

/** Lazy singleton accessor — no S3 client is created on import. */
export function getS3Service(): S3Service {
  if (!shared) shared = new S3Service();
  return shared;
}
