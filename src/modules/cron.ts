import cron from 'node-cron';
import DomainService from './domain/domain.service.js';
import CleanupService from '../services/cleanup.service.js';
import cacheService from '../services/cache.service.js';
import pino from 'pino';

const logger = pino({ name: 'cron-scheduler' });

export function initCron() {
    logger.info('Initializing background cron jobs');

    const domainService = new DomainService();
    const cleanupService = new CleanupService();

    /**
     * Acquire a distributed lock via Redis to prevent multiple container instances
     * from running the same cron job simultaneously.
     * Returns true if the lock was acquired, false if another instance holds it.
     */
    const acquireLock = async (key: string, ttlSeconds: number): Promise<boolean> => {
        try {
            const result = await cacheService.client.set(
                `cron:lock:${key}`,
                '1',
                { ex: ttlSeconds, nx: true } // NX = only set if NOT exists (atomic)
            );
            return result === 'OK';
        } catch {
            // If Redis is down, allow the job to run (fail-open)
            return true;
        }
    };

    // 1. Certificate Polling (Every 5 minutes)
    // Checks ACM certificate statuses and provisions CloudFront distributions for custom domains.
    cron.schedule('*/5 * * * *', async () => {
        if (!await acquireLock('poll-certificates', 280)) return;
        try {
            await domainService.pollPendingCertificates();
        } catch (error) {
            logger.error({ error }, 'Error in pollPendingCertificates cron');
        }
    });

    // 2. Distribution Cleanup (Every hour)
    // Deletes CloudFront distributions and ACM certificates for domains that have been removed.
    cron.schedule('0 * * * *', async () => {
        if (!await acquireLock('cleanup-distributions', 3500)) return;
        try {
            await domainService.cleanupDisabledDistributions();
        } catch (error) {
            logger.error({ error }, 'Error in cleanupDisabledDistributions cron');
        }
    });

    // 3. User & Token Cleanup (Every night at 3:00 AM)
    // Cleans up expired auth tokens and soft-deleted user accounts.
    cron.schedule('0 3 * * *', async () => {
        if (!await acquireLock('nightly-cleanup', 82800)) return; // 23h TTL
        try {
            await cleanupService.cleanupExpiredTokens();
            await cleanupService.cleanupDeletedUsers();
            logger.info('Nightly cleanup routines completed');
        } catch (error) {
            logger.error({ error }, 'Error in nightly cleanup cron');
        }
    });

    logger.info('Cron jobs scheduled successfully');
}
