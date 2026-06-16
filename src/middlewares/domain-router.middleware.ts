import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import prismaClient from '../config/prisma.js';
import cacheService from '../services/cache.service.js';

const SITES_ROOT = path.resolve(process.cwd(), 'storage', 'sites');
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
            where: { domain: host },
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

    // Serve static files from the site's latest deployment
    const reqPath = req.path === '/' ? '/index.html' : req.path;
    let filePath: string;

    // Try exact path first
    if (reqPath.endsWith('/')) {
      filePath = path.join(SITES_ROOT, websiteId, 'latest', reqPath, 'index.html');
    } else if (path.extname(reqPath)) {
      filePath = path.join(SITES_ROOT, websiteId, 'latest', reqPath);
    } else {
      // Try as directory with index.html
      filePath = path.join(SITES_ROOT, websiteId, 'latest', reqPath, 'index.html');
    }

    // Prevent path traversal
    const resolvedPath = path.resolve(filePath);
    const siteRoot = path.resolve(SITES_ROOT, websiteId, 'latest');
    if (!resolvedPath.startsWith(siteRoot)) {
      return res.status(403).send('Forbidden');
    }

    try {
      await fs.access(resolvedPath);
      const contentType = getContentType(resolvedPath);
      const isText = contentType.includes('text/') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('javascript');
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Served-By', 'Buildora');
      // Cache static assets aggressively, HTML for a short time
      if (isText && resolvedPath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=60');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      }
      const content = await fs.readFile(resolvedPath, isText ? 'utf-8' : undefined);
      return res.send(content);
    } catch {
      // File not found — try 404.html
      const notFoundPath = path.join(siteRoot, '404.html');
      try {
        await fs.access(notFoundPath);
        const content = await fs.readFile(notFoundPath, 'utf-8');
        return res.status(404).send(content);
      } catch {
        return res.status(404).send('Page not found');
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
