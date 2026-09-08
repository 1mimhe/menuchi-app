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
}

export class S3Service implements PresignedUrlGenerator {
  private client: S3Client;
  private bucketName;

  constructor(env?: S3Env) {
    const { S3_ACCESSKEYID, S3_SECRETACCESSKEY, S3_ENDPOINT } = env ?? process.env;
    if (S3_ACCESSKEYID && S3_SECRETACCESSKEY) {
      this.client = new S3Client({
        region: 'default',
        endpoint: S3_ENDPOINT,
        credentials: {
          accessKeyId: S3_ACCESSKEYID,
          secretAccessKey: S3_SECRETACCESSKEY,
        },
      });
    } else throw new NotFoundError('S3 keys not found.');

    this.bucketName = env?.S3_BUCKETNAME ?? process.env.S3_BUCKETNAME;
  }
  
  async generatePutPresignedUrl(keyName: string, expiresIn = 300): Promise<URL> {
    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: keyName
    });

    return getSignedUrl(this.client, putCommand, { expiresIn });
  }

  async generateGetPresignedUrl(keyName: string | null, expiresIn = 1800): Promise<URL | null> {
    if (!keyName) return null;

    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: keyName
    });

    return getSignedUrl(this.client, getCommand, { expiresIn });
  }  
}

export default new S3Service();