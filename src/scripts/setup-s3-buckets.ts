/**
 * One-time setup script: configures S3 buckets for production deployment.
 *
 * - buildora-assets  → public-read for assets/* (uploaded images)
 * - ebookathena      → public-read for sites/* (published website HTML)
 *
 * Run with:  npx tsx src/scripts/setup-s3-buckets.ts
 */

import 'dotenv/config';
import {
  S3Client,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const region = process.env.S3_REGION || 'us-east-1';
const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;

if (!accessKeyId || !secretAccessKey) {
  console.error('❌  S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set in .env');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const ASSET_BUCKET = process.env.S3_BUCKET || 'buildora-assets';
const SITES_BUCKET = process.env.S3_SITES_BUCKET || 'ebookathena';

async function bucketExists(bucket: string): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

async function disableBlockPublicAccess(bucket: string) {
  console.log(`  Disabling "Block Public Access" on ${bucket}...`);
  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    }),
  );
}

async function setPublicReadPolicy(bucket: string, prefix: string) {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: `PublicRead-${prefix.replace(/\//g, '-')}`,
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucket}/${prefix}*`,
      },
    ],
  };

  console.log(`  Applying public-read policy on ${bucket}/${prefix}*...`);
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    }),
  );
}

async function setupBucket(bucket: string, prefix: string) {
  console.log(`\n🪣  Setting up bucket: ${bucket}`);
  const exists = await bucketExists(bucket);
  if (!exists) {
    console.error(`  ❌  Bucket "${bucket}" does not exist. Create it in the AWS console first.`);
    return;
  }
  console.log(`  ✅  Bucket exists`);
  await disableBlockPublicAccess(bucket);
  await setPublicReadPolicy(bucket, prefix);
  console.log(`  ✅  Done — objects under ${bucket}/${prefix}* are now publicly readable`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Buildora S3 Bucket Setup');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Region: ${region}`);
  console.log(`Assets bucket: ${ASSET_BUCKET}`);
  console.log(`Sites bucket:  ${SITES_BUCKET}`);

  await setupBucket(ASSET_BUCKET, 'assets/');
  await setupBucket(SITES_BUCKET, 'sites/');

  console.log('\n✅  All done! Published sites will be accessible at:');
  console.log(`   https://${SITES_BUCKET}.s3.${region}.amazonaws.com/sites/{websiteId}/latest/index.html`);
  console.log(`\n   Asset images will be accessible at:`);
  console.log(`   https://${ASSET_BUCKET}.s3.${region}.amazonaws.com/assets/{...}`);
}

main().catch((err) => {
  console.error('❌  Setup failed:', err.message);
  process.exit(1);
});
