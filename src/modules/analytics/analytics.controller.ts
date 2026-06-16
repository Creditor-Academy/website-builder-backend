import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma.js';

/**
 * POST /analytics/track
 * Called by the lightweight tracking script in published sites.
 * Expects: { websiteId, path?, referrer? }
 * Returns 204 (no content) to minimize bandwidth.
 */
export const trackPageView = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { websiteId, path } = req.body;

    if (!websiteId || typeof websiteId !== 'string') {
      return res.status(400).json({ error: 'websiteId is required' });
    }

    await prisma.pageView.create({
      data: {
        website_id: websiteId,
        path: typeof path === 'string' ? path.slice(0, 500) : '/',
        referrer: typeof req.body.referrer === 'string' ? req.body.referrer.slice(0, 1000) : null,
        user_agent: (req.headers['user-agent'] || '').slice(0, 500) || null,
      },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /analytics/websites/:websiteId
 * Returns page view stats for a specific website.
 * Query params: period=7d|30d|90d (default 30d)
 */
export const getWebsiteAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const websiteId = req.params.websiteId as string;
    const period = (req.query.period as string) || '30d';
    const user = req.context.user;

    // Verify ownership
    const website = await prisma.website.findFirst({
      where: { id: websiteId, deleted_at: null },
      select: { owner_id: true, institution_id: true },
    });

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    const isOwner = website.owner_id === user.id;
    const isInstitutionAdmin =
      user.role === 'INSTITUTION_ADMIN' &&
      !!user.institution_id &&
      website.institution_id === user.institution_id;

    if (!isAdmin && !isOwner && !isInstitutionAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Calculate date range
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalViews, viewsByDay] = await Promise.all([
      prisma.pageView.count({
        where: { website_id: websiteId, created_at: { gte: since } },
      }),
      prisma.pageView.groupBy({
        by: ['created_at'],
        where: { website_id: websiteId, created_at: { gte: since } },
        _count: { _all: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    // Aggregate by day
    const dailyMap = new Map<string, number>();
    for (const row of viewsByDay) {
      const day = row.created_at.toISOString().split('T')[0]!;
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + row._count._all);
    }

    const daily = Array.from(dailyMap.entries()).map(([date, views]) => ({ date, views }));

    // Top pages
    const topPages = await prisma.pageView.groupBy({
      by: ['path'],
      where: { website_id: websiteId, created_at: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });

    res.json({
      websiteId,
      period,
      totalViews,
      daily,
      topPages: topPages.map((p) => ({ path: p.path, views: p._count._all })),
    });
  } catch (err) {
    next(err);
  }
};
