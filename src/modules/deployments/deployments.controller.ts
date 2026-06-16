import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';

/**
 * GET /deployments?page=1&limit=20&status=ACTIVE&search=keyword
 */
export const getAllDeployments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { website: { name: { contains: search, mode: 'insensitive' } } },
        { domain: { contains: search, mode: 'insensitive' } },
        { id: { contains: search } },
      ];
    }

    const [deployments, total] = await Promise.all([
      prisma.deployment.findMany({
        where,
        include: {
          website: { select: { id: true, name: true, status: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deployment.count({ where }),
    ]);

    // Serialize BigInt to number for JSON
    const serialized = deployments.map((d) => ({
      id: d.id,
      websiteId: d.website_id,
      websiteName: d.website?.name || 'Unknown',
      websiteStatus: d.website?.status || 'DRAFT',
      versionId: d.version_id,
      status: d.status,
      url: d.url,
      domain: d.domain,
      artifactPrefix: d.artifact_prefix,
      deployedBy: d.deployed_by,
      errorMessage: d.error_message,
      fileCount: d.file_count,
      totalSize: Number(d.total_size),
      sslEnabled: d.ssl_enabled,
      logs: d.logs || [],
      startedAt: d.started_at?.toISOString(),
      finishedAt: d.finished_at?.toISOString(),
      publishedAt: d.created_at.toISOString(),
    }));

    res.json({
      deployments: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /deployments/stats
 * Returns summary counts for the deployment dashboard.
 */
export const getDeploymentStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, active, failed, pending] = await Promise.all([
      prisma.deployment.count(),
      prisma.deployment.count({ where: { status: 'ACTIVE' } }),
      prisma.deployment.count({ where: { status: 'FAILED' } }),
      prisma.deployment.count({ where: { status: { in: ['PENDING', 'BUILDING', 'UPLOADING'] } } }),
    ]);

    // Recent deployments (last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.deployment.count({
      where: { created_at: { gte: since } },
    });

    res.json({ total, active, failed, pending, recentCount });
  } catch (err) {
    next(err);
  }
};
