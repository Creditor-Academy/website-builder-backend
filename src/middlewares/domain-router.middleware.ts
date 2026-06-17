import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import prismaClient from '../config/prisma.js';
import cacheService from '../services/cache.service.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../config/s3-client.js';
import { Readable } from 'stream';

const SITE_HOST = process.env.PUBLIC_SITE_HOST || 'buildora.app';

/**
 * Domain-routing middleware.
 *
 * Inspects the `Host` header to determine if the request is for a published site
 * (either a *.buildora.app subdomain or a verified custom domain).
 *
 * If matched, serves the corresponding static files from storage/sites/{websiteId}/latest/.
 * If not matched, passes the request through to the normal API routes.
 */
export const domainRouter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const host = (req.hostname || req.headers.host || '').split(':')[0]!.toLowerCase().trim();

    // Skip if this is the main app domain, localhost, or an API/assets path
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === SITE_HOST) {
      return next();
    }

    // Skip API, uploads, and admin paths — they should be handled by normal routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/sites/')) {
      return next();
    }

    // Determine if this is a subdomain or custom domain
    let websiteId: string | null = null;

    // Check cache first
    const cacheKey = `domain:${host}`;
    const cached = await cacheService.get(cacheKey).catch(() => null);
    const cachedValue = cached ? (typeof cached === 'string' ? (() => { try { return JSON.parse(cached); } catch { return cached; } })() : cached) : null;

    if (cachedValue === '__none__') {
      // Known non-site domain, skip
      return next();
    }

    if (cachedValue && typeof cachedValue === 'string') {
      websiteId = cachedValue;
    } else {
      // Look up in Domain table
      const domainRecord = await prismaClient.domain.findUnique({
        where: { domain: host },
        select: { website_id: true, status: true },
      });

      if (domainRecord && domainRecord.status === 'ACTIVE') {
        websiteId = domainRecord.website_id;
        // Cache for 5 minutes
        await cacheService.set(cacheKey, websiteId, 300).catch(() => {});
      } else {
        // Also check if it's a subdomain pattern: {slug}.buildora.app
        if (host.endsWith(`.${SITE_HOST}`)) {
          const subdomain = host.replace(`.${SITE_HOST}`, '');
          const subdomainRecord = await prismaClient.domain.findUnique({
            where: { domain: subdomain },
            select: { website_id: true, status: true },
          });
          if (subdomainRecord && subdomainRecord.status === 'ACTIVE') {
            websiteId = subdomainRecord.website_id;
            await cacheService.set(cacheKey, websiteId, 300).catch(() => {});
          }
        }

        if (!websiteId) {
          // Cache negative result for 2 minutes to avoid repeated DB lookups
          await cacheService.set(cacheKey, '__none__', 120).catch(() => {});
          return next();
        }
      }
    }

    // Serve static files from S3
    const reqPath = req.path === '/' ? '/index.html' : req.path;
    let s3Key = `sites/${websiteId}/latest${reqPath}`;
    
    // Normalize path based on extension
    let fallbackS3Key: string | null = null;
    if (reqPath.endsWith('/')) {
      s3Key = `sites/${websiteId}/latest${reqPath}index.html`;
    } else if (!path.extname(reqPath)) {
      s3Key = `sites/${websiteId}/latest${reqPath}.html`;
      fallbackS3Key = `sites/${websiteId}/latest${reqPath}/index.html`;
    }

    const s3 = getS3Client();
    const bucket = (process.env.S3_SITES_BUCKET || process.env.S3_BUCKET || '').trim();

    if (!bucket) {
      return res.status(500).send('S3 bucket not configured for sites');
    }

    try {
      let s3Object;
      try {
        s3Object = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: s3Key,
        }));
      } catch (err: any) {
        if (fallbackS3Key && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) {
          s3Key = fallbackS3Key;
          s3Object = await s3.send(new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
          }));
        } else {
          throw err;
        }
      }

      const contentType = s3Object.ContentType || getContentType(s3Key);
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Served-By', 'Buildora S3 Proxy');
      
      if (s3Object.CacheControl) {
        res.setHeader('Cache-Control', s3Object.CacheControl);
      } else if (s3Key.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=60');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      }

      // Stream the body directly to Express response
      if (s3Object.Body) {
        const stream = s3Object.Body as Readable;
        stream.on('error', (err) => {
          console.error('[domain-router] S3 Stream Error:', err);
          if (!res.headersSent) res.status(500).end();
        });
        return stream.pipe(res);
      }
      return res.status(404).send('Page not found');
    } catch (err: any) {
      // File not found
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        try {
          const s3NotFound = await s3.send(new GetObjectCommand({
            Bucket: bucket,
            Key: `sites/${websiteId}/latest/404.html`,
          }));
          res.status(404);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          
          if (s3NotFound.Body) {
            const stream404 = s3NotFound.Body as Readable;
            stream404.on('error', (err) => {
              console.error('[domain-router] S3 404 Stream Error:', err);
              if (!res.headersSent) res.status(500).end();
            });
            return stream404.pipe(res);
          }
        } catch {
          return res.status(404).send('Page not found');
        }
      } else {
        console.error('[domain-router] S3 Fetch Error:', err);
        return res.status(500).send('Internal Server Error');
      }
    }
  } catch (error) {
    // On any error, fall through to normal routes
    return next();
  }
};

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}
