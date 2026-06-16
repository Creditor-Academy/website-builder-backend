import type { NextFunction, Request, Response } from 'express';
import assetsService from './assets.service.js';

const parseWebsiteId = (req: Request) => {
  const websiteId = typeof req.query.website_id === 'string'
    ? req.query.website_id
    : typeof req.body?.website_id === 'string'
      ? req.body.website_id
      : undefined;

  return websiteId && websiteId.trim().length > 0 ? websiteId.trim() : undefined;
};

const handleAssetScopeError = (res: Response, error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === 'Website not found') {
    res.status(404).json({ error: error.message });
    return true;
  }

  if (error.message === 'You do not have access to this website') {
    res.status(403).json({ error: error.message });
    return true;
  }

  return false;
};

class AssetsController {
  listAssets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const result = await assetsService.listAssets(req.context.user, parseWebsiteId(req), page, limit);
      res.status(200).json(result);
    } catch (error) {
      if (handleAssetScopeError(res, error)) {
        return;
      }
      next(error);
    }
  };

  uploadAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
      }

      const asset = await assetsService.createUploadedAsset(
        req.context.user,
        req.file,
        parseWebsiteId(req),
      );

      res.status(201).json({ asset });
    } catch (error) {
      if (handleAssetScopeError(res, error)) {
        return;
      }
      next(error);
    }
  };

  importUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asset = await assetsService.importAssetFromUrl(
        req.context.user,
        req.validated.body.name || 'Imported Asset',
        req.validated.body.url,
        parseWebsiteId(req),
      );

      res.status(201).json({ asset });
    } catch (error) {
      if (handleAssetScopeError(res, error)) {
        return;
      }
      next(error);
    }
  };

  deleteAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await assetsService.deleteAsset(req.context.user, req.validated.params.id, parseWebsiteId(req));
      if (!deleted) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      res.status(200).json({ message: 'Asset deleted successfully' });
    } catch (error) {
      if (handleAssetScopeError(res, error)) {
        return;
      }
      next(error);
    }
  };
}

export default new AssetsController();