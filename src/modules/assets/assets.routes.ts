import express from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import assetsController from './assets.controller.js';
import { assetIdParamsSchema, importAssetUrlSchema } from './assets.validation.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/css', 'application/javascript',
  'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
]);

const upload = multer({
  dest: 'storage/assets/tmp',
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed`));
    }
  },
});

const router = express.Router();

router.use(authenticate);

router.get('/', assetsController.listAssets);
router.post('/upload', upload.single('file'), assetsController.uploadAsset);
router.post('/import-url', validateRequest(importAssetUrlSchema), assetsController.importUrl);
router.delete('/:id', validateRequest(assetIdParamsSchema, 'params'), assetsController.deleteAsset);

export default router;