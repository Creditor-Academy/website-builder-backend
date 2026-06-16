import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

let s3Client: S3Client | null = null;

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required S3 configuration: ${name}`);
  }

  return value;
};

export const getS3BucketName = () => requireEnv('S3_BUCKET');

export const getS3Client = () => {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT?.trim();
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

    s3Client = new S3Client({
      region: requireEnv('S3_REGION'),
      ...(endpoint ? { endpoint } : {}),
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
      ...(process.env.S3_FORCE_PATH_STYLE === 'true' ? { forcePathStyle: true } : {}),
    });
  }

  return s3Client;
};

export const buildS3PublicUrl = (objectKey: string) => {
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${objectKey}`;
  }

  const endpoint = process.env.S3_ENDPOINT?.trim().replace(/\/+$/, '');
  const bucket = getS3BucketName();

  if (endpoint) {
    return `${endpoint}/${bucket}/${objectKey}`;
  }

  return `https://${bucket}.s3.${requireEnv('S3_REGION')}.amazonaws.com/${objectKey}`;
};