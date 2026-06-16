import {
    CloudFrontClient,
    CreateDistributionCommand,
    CreateInvalidationCommand,
    DeleteDistributionCommand,
    GetDistributionCommand,
    UpdateDistributionCommand,
    type DistributionConfig,
} from '@aws-sdk/client-cloudfront';
import {
    ACMClient,
    RequestCertificateCommand,
    DescribeCertificateCommand,
    DeleteCertificateCommand,
    type DomainValidation,
} from '@aws-sdk/client-acm';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'aws-hosting-service' });

// ─── Configuration ──────────────────────────────────────────────────────────

const ACM_REGION = 'us-east-1'; // ACM certs for CloudFront MUST be in us-east-1
const CF_REGION = process.env.S3_REGION || 'us-east-1';

const S3_SITES_BUCKET = () =>
    (process.env.S3_SITES_BUCKET || process.env.S3_BUCKET || '').trim();

const PRIMARY_DISTRIBUTION_ID = () =>
    (process.env.CLOUDFRONT_PRIMARY_DISTRIBUTION_ID || '').trim();

const KVS_ARN = () =>
    (process.env.CLOUDFRONT_KVS_ARN || '').trim();

const SITE_HOST = () =>
    (process.env.PUBLIC_SITE_HOST || 'buildora.app').trim();

// ─── Lazy Client Singletons ────────────────────────────────────────────────

let cfClient: CloudFrontClient | null = null;
let acmClient: ACMClient | null = null;

const getCloudFrontClient = () => {
    if (!cfClient) {
        cfClient = new CloudFrontClient({ region: CF_REGION });
    }
    return cfClient;
};

const getAcmClient = () => {
    if (!acmClient) {
        acmClient = new ACMClient({ region: ACM_REGION });
    }
    return acmClient;
};

/** Check whether CloudFront + ACM hosting is configured */
export const isHostingConfigured = (): boolean => {
    return !!(S3_SITES_BUCKET() && PRIMARY_DISTRIBUTION_ID());
};

// ─── ACM Certificate Operations ────────────────────────────────────────────

export interface CertificateRequest {
    certificateArn: string;
    validationRecords: Array<{
        name: string;
        type: string;
        value: string;
    }>;
}

/**
 * Request a new ACM certificate for a custom domain using DNS validation.
 * The caller must present the returned DNS CNAME records to the user.
 */
export const requestAcmCertificate = async (domain: string): Promise<CertificateRequest> => {
    const acm = getAcmClient();

    const result = await acm.send(new RequestCertificateCommand({
        DomainName: domain,
        ValidationMethod: 'DNS',
        IdempotencyToken: crypto.createHash('sha256').update(domain).digest('hex').slice(0, 32),
    }));

    const certificateArn = result.CertificateArn;
    if (!certificateArn) {
        throw new Error(`ACM did not return a certificate ARN for domain: ${domain}`);
    }

    logger.info({ domain, certificateArn }, 'ACM certificate requested');

    // ACM takes a few seconds to populate validation records.
    // We'll poll briefly (up to 30s) to retrieve them.
    let validationRecords: Array<{ name: string; type: string; value: string }> = [];
    for (let attempt = 0; attempt < 6; attempt++) {
        await sleep(5000);
        const described = await acm.send(new DescribeCertificateCommand({
            CertificateArn: certificateArn,
        }));

        const validations = described.Certificate?.DomainValidationOptions;
        if (validations && validations.length > 0 && validations[0]?.ResourceRecord) {
            validationRecords = validations
                .filter((v): v is DomainValidation & { ResourceRecord: NonNullable<DomainValidation['ResourceRecord']> } =>
                    !!v.ResourceRecord?.Name && !!v.ResourceRecord?.Value
                )
                .map(v => ({
                    name: v.ResourceRecord.Name!,
                    type: v.ResourceRecord.Type || 'CNAME',
                    value: v.ResourceRecord.Value!,
                }));
            break;
        }
    }

    return { certificateArn, validationRecords };
};

export type CertificateStatus = 'PENDING_VALIDATION' | 'ISSUED' | 'INACTIVE' | 'EXPIRED' | 'REVOKED'
    | 'FAILED' | 'VALIDATION_TIMED_OUT' | string;

/**
 * Check the current status of an ACM certificate.
 * Returns 'ISSUED' when the certificate is ready to use.
 */
export const describeCertificateStatus = async (certificateArn: string): Promise<{
    status: CertificateStatus;
    validationRecords: Array<{ name: string; type: string; value: string }>;
}> => {
    const acm = getAcmClient();
    const result = await acm.send(new DescribeCertificateCommand({
        CertificateArn: certificateArn,
    }));

    const cert = result.Certificate;
    const status = cert?.Status || 'PENDING_VALIDATION';
    const validationRecords = (cert?.DomainValidationOptions || [])
        .filter((v): v is DomainValidation & { ResourceRecord: NonNullable<DomainValidation['ResourceRecord']> } =>
            !!v.ResourceRecord?.Name && !!v.ResourceRecord?.Value
        )
        .map(v => ({
            name: v.ResourceRecord.Name!,
            type: v.ResourceRecord.Type || 'CNAME',
            value: v.ResourceRecord.Value!,
        }));

    return { status, validationRecords };
};

/**
 * Delete an ACM certificate. Only works when the cert is not in use by any distribution.
 */
export const deleteAcmCertificate = async (certificateArn: string): Promise<void> => {
    const acm = getAcmClient();
    try {
        await acm.send(new DeleteCertificateCommand({
            CertificateArn: certificateArn,
        }));
        logger.info({ certificateArn }, 'ACM certificate deleted');
    } catch (err: any) {
        // ResourceInUseException means it's still attached to a distribution
        if (err.name === 'ResourceInUseException') {
            logger.warn({ certificateArn }, 'Cannot delete certificate — still in use');
            return;
        }
        throw err;
    }
};

// ─── CloudFront Distribution Operations ─────────────────────────────────────

export interface DistributionResult {
    distributionId: string;
    domainName: string; // e.g. d12345.cloudfront.net
    status: string;
}

/**
 * Create a dedicated CloudFront distribution for a custom domain.
 * The distribution's origin path is locked to /sites/{websiteId}/latest
 * so no CloudFront Function is needed for routing.
 */
export const createDistribution = async (
    domain: string,
    certificateArn: string,
    websiteId: string,
): Promise<DistributionResult> => {
    const cf = getCloudFrontClient();
    const bucket = S3_SITES_BUCKET();
    const callerRef = `buildora-${websiteId}-${Date.now()}`;

    const config: DistributionConfig = {
        CallerReference: callerRef,
        Comment: `Buildora site: ${domain} (${websiteId})`,
        Enabled: true,
        Aliases: {
            Quantity: 1,
            Items: [domain],
        },
        Origins: {
            Quantity: 1,
            Items: [
                {
                    Id: 's3-origin',
                    DomainName: `${bucket}.s3.amazonaws.com`,
                    OriginPath: `/sites/${websiteId}/latest`,
                    S3OriginConfig: {
                        OriginAccessIdentity: '', // Using OAC (set via bucket policy) or public bucket
                    },
                },
            ],
        },
        DefaultCacheBehavior: {
            TargetOriginId: 's3-origin',
            ViewerProtocolPolicy: 'redirect-to-https',
            AllowedMethods: {
                Quantity: 2,
                Items: ['GET', 'HEAD'],
            },
            CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized managed policy
            Compress: true,
            ForwardedValues: undefined as any,
        },
        ViewerCertificate: {
            ACMCertificateArn: certificateArn,
            SSLSupportMethod: 'sni-only',
            MinimumProtocolVersion: 'TLSv1.2_2021',
        },
        DefaultRootObject: 'index.html',
        CustomErrorResponses: {
            Quantity: 2,
            Items: [
                {
                    ErrorCode: 403,
                    ResponseCode: '404',
                    ResponsePagePath: '/404.html',
                    ErrorCachingMinTTL: 60,
                },
                {
                    ErrorCode: 404,
                    ResponseCode: '404',
                    ResponsePagePath: '/404.html',
                    ErrorCachingMinTTL: 60,
                },
            ],
        },
    };

    const result = await cf.send(new CreateDistributionCommand({
        DistributionConfig: config,
    }));

    const dist = result.Distribution;
    if (!dist?.Id || !dist?.DomainName) {
        throw new Error('CloudFront did not return a valid distribution');
    }

    logger.info({ domain, distributionId: dist.Id, cfDomain: dist.DomainName }, 'CloudFront distribution created');

    return {
        distributionId: dist.Id,
        domainName: dist.DomainName,
        status: dist.Status || 'InProgress',
    };
};

/**
 * Create a CloudFront cache invalidation for a distribution.
 * Used after re-publishing or rolling back a site.
 */
export const createCacheInvalidation = async (
    distributionId: string,
    paths: string[] = ['/*'],
): Promise<string | undefined> => {
    const cf = getCloudFrontClient();

    const result = await cf.send(new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
            CallerReference: `inv-${Date.now()}`,
            Paths: {
                Quantity: paths.length,
                Items: paths,
            },
        },
    }));

    const invalidationId = result.Invalidation?.Id;
    logger.info({ distributionId, invalidationId, paths }, 'CloudFront invalidation created');
    return invalidationId;
};

/**
 * Disable and then delete a CloudFront distribution.
 * CloudFront requires distributions to be disabled before deletion.
 * This is a two-step process that may take several minutes.
 */
export const deleteDistribution = async (distributionId: string): Promise<void> => {
    const cf = getCloudFrontClient();

    try {
        // Step 1: Get the current config and ETag
        const getResult = await cf.send(new GetDistributionCommand({
            Id: distributionId,
        }));

        const etag = getResult.ETag;
        const config = getResult.Distribution?.DistributionConfig;
        if (!config || !etag) {
            logger.warn({ distributionId }, 'Distribution not found or missing ETag');
            return;
        }

        // Step 2: Disable if enabled
        if (config.Enabled) {
            config.Enabled = false;
            await cf.send(new UpdateDistributionCommand({
                Id: distributionId,
                DistributionConfig: config,
                IfMatch: etag,
            }));
            logger.info({ distributionId }, 'CloudFront distribution disabled — deletion will be completed by cleanup cron');
            // Note: Actual deletion requires waiting for the distribution to be fully disabled (Deployed status)
            // which can take 10-20 minutes. The cleanup cron should handle the actual DeleteDistributionCommand.
        }
    } catch (err: any) {
        if (err.name === 'NoSuchDistribution') {
            logger.info({ distributionId }, 'Distribution already deleted');
            return;
        }
        throw err;
    }
};

// ─── CloudFront KeyValueStore Operations (Subdomain Routing) ────────────────

/**
 * Update the CloudFront KeyValueStore with a subdomain → websiteId mapping.
 * This is used by the CloudFront Function to route *.buildora.app requests.
 *
 * Note: The KeyValueStore API requires the @aws-sdk/client-cloudfront-keyvaluestore
 * package. If it's not available, this falls back to a no-op with a warning.
 */
export const updateKeyValueStore = async (slug: string, websiteId: string): Promise<void> => {
    const kvsArn = KVS_ARN();
    if (!kvsArn) {
        logger.warn({ slug, websiteId }, 'CLOUDFRONT_KVS_ARN not configured — skipping KVS update');
        return;
    }

    try {
        // Dynamic import because @aws-sdk/client-cloudfront-keyvaluestore may not be installed yet
        // @ts-ignore — module is intentionally optional
        const { CloudFrontKeyValueStoreClient, PutKeyCommand, DescribeKeyValueStoreCommand } = await import(
            /* @ts-ignore */ '@aws-sdk/client-cloudfront-keyvaluestore'
        );

        const kvsClient = new CloudFrontKeyValueStoreClient({ region: CF_REGION });

        // Get the current ETag (required for puts)
        const desc = await kvsClient.send(new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }));
        const etag = desc.ETag;
        if (!etag) {
            throw new Error('KeyValueStore missing ETag');
        }

        await kvsClient.send(new PutKeyCommand({
            KvsARN: kvsArn,
            Key: slug,
            Value: websiteId,
            IfMatch: etag,
        }));

        logger.info({ slug, websiteId }, 'CloudFront KVS mapping updated');
    } catch (err: any) {
        // If the KVS SDK is not installed, log a warning but don't fail the deployment
        if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
            logger.warn('@aws-sdk/client-cloudfront-keyvaluestore not installed — KVS update skipped');
            return;
        }
        logger.error({ err, slug, websiteId }, 'Failed to update CloudFront KVS');
        throw err;
    }
};

/**
 * Remove a subdomain mapping from the CloudFront KeyValueStore.
 */
export const deleteKeyValueStoreEntry = async (slug: string): Promise<void> => {
    const kvsArn = KVS_ARN();
    if (!kvsArn) return;

    try {
        // @ts-ignore — module is intentionally optional
        const { CloudFrontKeyValueStoreClient, DeleteKeyCommand, DescribeKeyValueStoreCommand } = await import(
            /* @ts-ignore */ '@aws-sdk/client-cloudfront-keyvaluestore'
        );

        const kvsClient = new CloudFrontKeyValueStoreClient({ region: CF_REGION });
        const desc = await kvsClient.send(new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }));
        const etag = desc.ETag;
        if (!etag) return;

        await kvsClient.send(new DeleteKeyCommand({
            KvsARN: kvsArn,
            Key: slug,
            IfMatch: etag,
        }));

        logger.info({ slug }, 'CloudFront KVS mapping deleted');
    } catch (err: any) {
        if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') return;
        if (err.name === 'ResourceNotFoundException') return;
        logger.error({ err, slug }, 'Failed to delete CloudFront KVS entry');
    }
};

// ─── Utilities ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
