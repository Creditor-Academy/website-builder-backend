import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../config/s3-client.js';
import { generateStaticSite } from './static-site-generator.js';
import prisma from '../config/prisma.js';

export type DeploymentStatus = 'pending' | 'building' | 'uploading' | 'active' | 'failed' | 'rolled_back';

export interface DeploymentRecord {
  id: string;
  versionId: string;
  status: DeploymentStatus;
  url: string;
  domain: string;
  artifactPrefix: string;
  publishedAt: string;
  startedAt: string;
  finishedAt: string | null;
  deployedBy: string;
  errorMessage: string | null;
  fileCount: number;
  totalSize: number;
  logs: string[];
}

interface DeployInput {
  websiteId: string;
  versionId: string;
  domain: string;
  content: Record<string, any>;
  siteName: string;
  deployedBy: string;
}

/** Root directory where all published sites are stored (local backup) */
const SITES_ROOT = path.resolve(process.cwd(), 'storage', 'sites');

/** Bucket for published sites — defaults to S3_SITES_BUCKET, falls back to S3_BUCKET */
const getSitesBucket = () =>
  (process.env.S3_SITES_BUCKET || process.env.S3_BUCKET || '').trim();

/** Check if S3 deployment is configured */
const isS3DeployConfigured = () => {
  const bucket = getSitesBucket();
  const accessKey = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  return !!(bucket && accessKey && secretKey && !accessKey.startsWith('your-'));
};

/** Base URL for accessing published sites */
const getPublicBaseUrl = () => {
  if (process.env.PUBLISHED_SITES_BASE_URL?.trim()) {
    return process.env.PUBLISHED_SITES_BASE_URL.trim().replace(/\/+$/, '');
  }
  const bucket = getSitesBucket();
  const region = process.env.S3_REGION || 'us-east-1';
  if (bucket && isS3DeployConfigured()) {
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }
  return `http://localhost:${process.env.PORT || 5000}/sites`;
};

const buildPrefix = (websiteId: string, deploymentId: string) =>
  `${websiteId}/${deploymentId}`;

const build404Html = (siteName: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Page Not Found – ${siteName.replace(/[<>"&]/g, '')}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#334155;text-align:center}.c{max-width:480px;padding:48px 24px}h1{font-size:6rem;font-weight:800;color:#2563eb;line-height:1}p{margin-top:16px;font-size:1.1rem;color:#64748b}a{display:inline-block;margin-top:24px;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style>
</head>
<body><div class="c"><h1>404</h1><p>The page you're looking for doesn't exist.</p><a href="/">Go Home</a></div></body>
</html>`;

const writeFile = async (filePath: string, body: string) => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, body, 'utf-8');
};

export const deploy = async (input: DeployInput): Promise<DeploymentRecord> => {
  const deploymentId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const logs: string[] = [];
  const prefix = buildPrefix(input.websiteId, deploymentId);

  const record: DeploymentRecord = {
    id: deploymentId,
    versionId: input.versionId,
    status: 'pending',
    url: '',
    domain: input.domain,
    artifactPrefix: prefix,
    publishedAt: startedAt,
    startedAt,
    finishedAt: null,
    deployedBy: input.deployedBy,
    errorMessage: null,
    fileCount: 0,
    totalSize: 0,
    logs,
  };

  try {
    // Phase 1: Build
    record.status = 'building';
    logs.push(`[${new Date().toISOString()}] [INFO] Starting deployment ${deploymentId}`);
    logs.push(`[${new Date().toISOString()}] [INFO] Generating static site for "${input.siteName}"...`);

    const files = generateStaticSite(input.content, input.siteName, input.websiteId);
    logs.push(`[${new Date().toISOString()}] [INFO] Generated ${files.length} file(s).`);

    // Phase 2: Upload to S3 + local backup
    record.status = 'uploading';

    let totalSize = 0;
    const useS3 = isS3DeployConfigured();

    if (useS3) {
      const bucket = getSitesBucket();
      const s3 = getS3Client();
      logs.push(`[${new Date().toISOString()}] [INFO] Uploading ${files.length} file(s) to S3 bucket "${bucket}"...`);

      for (const file of files) {
        const body = Buffer.from(file.html, 'utf-8');
        totalSize += body.length;

        const contentType = file.filename.endsWith('.xml') ? 'application/xml'
          : file.filename.endsWith('.txt') ? 'text/plain'
          : 'text/html';

        // Upload to versioned path: sites/{websiteId}/{deploymentId}/...
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `sites/${prefix}/${file.filename}`,
          Body: body,
          ContentType: `${contentType}; charset=utf-8`,
          CacheControl: 'public, max-age=300',
        }));

        // Upload to latest path: sites/{websiteId}/latest/...
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `sites/${input.websiteId}/latest/${file.filename}`,
          Body: body,
          ContentType: `${contentType}; charset=utf-8`,
          CacheControl: 'public, max-age=60',
        }));

        logs.push(`[${new Date().toISOString()}] [INFO] Uploaded ${file.filename}`);
      }

      // Upload 404 page
      const errorHtml = build404Html(input.siteName);
      const errorBody = Buffer.from(errorHtml, 'utf-8');
      for (const key of [`sites/${prefix}/404.html`, `sites/${input.websiteId}/latest/404.html`]) {
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: errorBody,
          ContentType: 'text/html; charset=utf-8',
          CacheControl: 'public, max-age=300',
        }));
      }
    } else {
      logs.push(`[${new Date().toISOString()}] [INFO] S3 not configured — writing to local storage...`);
    }

    // Always write to local disk as backup
    for (const file of files) {
      const filePath = path.join(SITES_ROOT, prefix, file.filename);
      await writeFile(filePath, file.html);
      if (!useS3) totalSize += Buffer.byteLength(file.html, 'utf-8');
    }
    const latestDir = path.join(SITES_ROOT, input.websiteId, 'latest');
    for (const file of files) {
      await writeFile(path.join(latestDir, file.filename), file.html);
    }
    const errorHtml = build404Html(input.siteName);
    await writeFile(path.join(latestDir, '404.html'), errorHtml);
    await writeFile(path.join(SITES_ROOT, prefix, '404.html'), errorHtml);
    logs.push(`[${new Date().toISOString()}] [INFO] Local backup written.`);

    // Phase 3: Finalize
    record.status = 'active';
    record.fileCount = files.length;
    record.totalSize = totalSize;
    record.url = `${getPublicBaseUrl()}/sites/${input.websiteId}/latest/index.html`;
    record.finishedAt = new Date().toISOString();
    logs.push(`[${new Date().toISOString()}] [SUCCESS] Deployment complete (${useS3 ? 'S3' : 'local'}). URL: ${record.url}`);
  } catch (err: any) {
    record.status = 'failed';
    record.errorMessage = err?.message || 'Unknown deployment error';
    record.finishedAt = new Date().toISOString();
    logs.push(`[${new Date().toISOString()}] [ERROR] Deployment failed: ${record.errorMessage}`);
  }

  // Persist to deployments table
  try {
    const statusMap: Record<string, string> = {
      pending: 'PENDING', building: 'BUILDING', uploading: 'UPLOADING',
      active: 'ACTIVE', failed: 'FAILED', rolled_back: 'ROLLED_BACK',
    };
    await prisma.deployment.create({
      data: {
        id: record.id,
        website_id: input.websiteId,
        version_id: record.versionId || null,
        status: (statusMap[record.status] || 'PENDING') as any,
        url: record.url || null,
        domain: record.domain,
        artifact_prefix: record.artifactPrefix,
        deployed_by: input.deployedBy,
        error_message: record.errorMessage,
        file_count: record.fileCount,
        total_size: BigInt(record.totalSize),
        ssl_enabled: false,
        logs: record.logs,
        started_at: new Date(record.startedAt),
        finished_at: record.finishedAt ? new Date(record.finishedAt) : null,
      },
    });
  } catch (dbErr: any) {
    console.error('[deployment] Failed to persist deployment to DB:', dbErr.message);
  }

  return record;
};
