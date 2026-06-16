import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { AssetScope, AssetType, UserRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { buildS3PublicUrl, getS3BucketName, getS3Client } from '../../config/s3-client.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/error.utils.js';

/** Check whether S3 credentials are actually configured (not just placeholders) */
const isS3Configured = () => {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  const accessKey = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !region || !accessKey || !secretKey) return false;
  if (accessKey.startsWith('your-') || secretKey.startsWith('your-')) return false;

  return true;
};
import prisma from '../../config/prisma.js';
import type { AuthUser } from '../../types/auth.types.js';

class AssetsService {
  private readonly filesRoot = path.resolve(process.cwd(), 'storage', 'assets', 'files');

  private getAssetType(mimeType?: string, fileName?: string): AssetType {
    if (mimeType?.startsWith('image/')) return AssetType.image;
    if (mimeType?.startsWith('video/')) return AssetType.video;
    if (fileName && /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName)) return AssetType.image;
    if (fileName && /\.(mp4|webm|ogg|mov)$/i.test(fileName)) return AssetType.video;
    return AssetType.file;
  }

  private extensionFromContentType(contentType?: string) {
    switch (contentType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/gif':
        return '.gif';
      case 'image/webp':
        return '.webp';
      case 'image/svg+xml':
        return '.svg';
      case 'video/mp4':
        return '.mp4';
      case 'video/webm':
        return '.webm';
      case 'video/ogg':
        return '.ogg';
      case 'video/quicktime':
        return '.mov';
      default:
        return '';
    }
  }

  private buildObjectKey(userId: string, sourceName: string, websiteId?: string) {
    const extension = path.extname(sourceName) || '';
    const scopeSegment = websiteId ? `website/${websiteId}` : 'global';

    return `assets/${userId}/${scopeSegment}/${crypto.randomUUID()}${extension.toLowerCase()}`;
  }

  /**
   * Save a file to local disk under storage/assets/files/ and return a URL
   * served by the Express static middleware at /uploads/.
   */
  private async saveToLocalDisk(objectKey: string, body: Buffer): Promise<string> {
    const localPath = path.resolve(this.filesRoot, objectKey.replace(/\//g, path.sep));
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, body);

    const port = process.env.PORT || 5000;
    return `http://localhost:${port}/uploads/${objectKey}`;
  }

  private async deleteFromLocalDisk(objectKey: string) {
    const localPath = path.resolve(this.filesRoot, objectKey.replace(/\//g, path.sep));
    await fs.rm(localPath, { force: true });
  }

  private async uploadToS3(objectKey: string, body: Buffer, contentType?: string) {
    if (!isS3Configured()) {
      return this.saveToLocalDisk(objectKey, body);
    }

    const client = getS3Client();
    const bucket = getS3BucketName();

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return buildS3PublicUrl(objectKey);
  }

  private async deleteFromS3(objectKey: string) {
    if (!isS3Configured()) {
      return this.deleteFromLocalDisk(objectKey);
    }

    await getS3Client().send(new DeleteObjectCommand({
      Bucket: getS3BucketName(),
      Key: objectKey,
    }));
  }

  private async assertWebsiteAccess(user: AuthUser, websiteId: string) {
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        deleted_at: null,
      },
      select: {
        id: true,
        owner_id: true,
        institution_id: true,
      },
    });

    if (!website) {
      throw new NotFoundError('Website not found');
    }

    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      return website.id;
    }

    if (
      user.role === UserRole.INSTITUTION_ADMIN
      && !!user.institution_id
      && website.institution_id === user.institution_id
    ) {
      return website.id;
    }

    if (website.owner_id === user.id) {
      return website.id;
    }

    throw new ForbiddenError('You do not have access to this website');
  }

  async listAssets(
    user: AuthUser,
    websiteId?: string,
    page = 1,
    limit = 50,
  ) {
    const scopedWebsiteId = websiteId ? await this.assertWebsiteAccess(user, websiteId) : undefined;

    const where: Prisma.AssetWhereInput = scopedWebsiteId
      ? {
          // Website-scoped: only the user's own assets for that website
          owner_id: user.id,
          scope: AssetScope.WEBSITE,
          website_id: scopedWebsiteId,
        }
      : {
          // Global scope: user's own assets + admin/super-admin uploaded assets
          scope: AssetScope.GLOBAL,
          OR: [
            { owner_id: user.id },
            {
              owner: {
                role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
              },
            },
          ],
        };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { owner: { select: { role: true, name: true } } },
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        url: a.url,
        size: a.size,
        date: a.created_at.toISOString(),
        ownerId: a.owner_id,
        institutionId: a.institution_id,
        scope: a.scope,
        websiteId: a.website_id,
        isGlobal: a.owner.role === UserRole.ADMIN || a.owner.role === UserRole.SUPER_ADMIN,
        ownerName: a.owner.name,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createUploadedAsset(
    user: AuthUser,
    file: Express.Multer.File,
    websiteId?: string,
  ) {
    const scopedWebsiteId = websiteId ? await this.assertWebsiteAccess(user, websiteId) : undefined;
    const objectKey = this.buildObjectKey(user.id, file.originalname, scopedWebsiteId);
    let publicUrl: string;

    try {
      const fileBuffer = await fs.readFile(file.path);
      publicUrl = await this.uploadToS3(objectKey, fileBuffer, file.mimetype);
    } finally {
      await fs.rm(file.path, { force: true });
    }

    const asset = await prisma.asset.create({
      data: {
        name: file.originalname,
        type: this.getAssetType(file.mimetype, file.originalname),
        url: publicUrl,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        scope: scopedWebsiteId ? AssetScope.WEBSITE : AssetScope.GLOBAL,
        objectKey,
        owner_id: user.id,
        institution_id: user.institution_id || null,
        website_id: scopedWebsiteId || null,
      },
    });

    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      url: asset.url,
      size: asset.size,
      date: asset.created_at.toISOString(),
      ownerId: asset.owner_id,
      institutionId: asset.institution_id,
      scope: asset.scope,
      websiteId: asset.website_id,
    };
  }

  async importAssetFromUrl(
    user: AuthUser,
    name: string,
    url: string,
    websiteId?: string,
  ) {
    const scopedWebsiteId = websiteId ? await this.assertWebsiteAccess(user, websiteId) : undefined;
    const response = await fetch(url);

    if (!response.ok) {
      throw new BadRequestError(`Failed to fetch asset from URL: ${response.status}`);
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || undefined;
    const urlExtension = path.extname(new URL(url).pathname);
    const derivedExtension = urlExtension || this.extensionFromContentType(contentType);
    const sourceName = name.includes('.') ? name : `${name}${derivedExtension}`;
    const objectKey = this.buildObjectKey(user.id, sourceName, scopedWebsiteId);
    const body = Buffer.from(await response.arrayBuffer());
    const publicUrl = await this.uploadToS3(objectKey, body, contentType);

    const asset = await prisma.asset.create({
      data: {
        name,
        type: this.getAssetType(contentType, sourceName),
        url: publicUrl,
        size: `${(body.byteLength / (1024 * 1024)).toFixed(1)} MB`,
        scope: scopedWebsiteId ? AssetScope.WEBSITE : AssetScope.GLOBAL,
        objectKey,
        owner_id: user.id,
        institution_id: user.institution_id || null,
        website_id: scopedWebsiteId || null,
      },
    });

    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      url: asset.url,
      size: asset.size,
      date: asset.created_at.toISOString(),
      ownerId: asset.owner_id,
      institutionId: asset.institution_id,
      scope: asset.scope,
      websiteId: asset.website_id,
    };
  }

  async deleteAsset(user: AuthUser, assetId: string, websiteId?: string) {
    const scopedWebsiteId = websiteId ? await this.assertWebsiteAccess(user, websiteId) : undefined;

    const target = await prisma.asset.findFirst({
      where: { id: assetId },
    });

    if (!target) {
      return false;
    }

    // Only the owner or an admin/super-admin can delete
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (target.owner_id !== user.id && !isAdmin) {
      throw new ForbiddenError('You can only delete your own assets');
    }

    // If website-scoped, verify the scope matches
    if (scopedWebsiteId && (target.scope !== AssetScope.WEBSITE || target.website_id !== scopedWebsiteId)) {
      return false;
    }

    await prisma.asset.delete({ where: { id: target.id } });

    if (target.objectKey) {
      await this.deleteFromS3(target.objectKey);
    }

    return true;
  }
}

export default new AssetsService();