import cron from 'node-cron';
import DomainService from './domain/domain.service.js';
import CleanupService from '../services/cleanup.service.js';
import pino from 'pino';

const logger = pino({ name: 'cron-scheduler' });

export function initCron() {
    logger.info('Initializing background cron jobs');

    const domainService = new DomainService();
    const cleanupService = new CleanupService();

    // 1. Certificate Polling (Every 5 minutes)
    // Checks ACM certificate statuses and provisions CloudFront distributions for custom domains.
    cron.schedule('*/5 * * * *', async () => {
        try {
            await domainService.pollPendingCertificates();
        } catch (error) {
            logger.error({ error }, 'Error in pollPendingCertificates cron');
        }
    });

    // 2. Distribution Cleanup (Every hour)
    // Deletes CloudFront distributions and ACM certificates for domains that have been removed.
    cron.schedule('0 * * * *', async () => {
        try {
            await domainService.cleanupDisabledDistributions();
        } catch (error) {
            logger.error({ error }, 'Error in cleanupDisabledDistributions cron');
        }
    });

    // 3. User & Token Cleanup (Every night at 3:00 AM)
    // Cleans up expired auth tokens and soft-deleted user accounts.
    cron.schedule('0 3 * * *', async () => {
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
