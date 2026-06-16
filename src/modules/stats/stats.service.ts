import prismaClient from '../../config/prisma.js';

class StatsService {
    async getPlatformStats() {
        // Global stats for Super Admin
        const [userCount, orgCount, webCount, templateCount] = await Promise.all([
            prismaClient.user.count(),
            (prismaClient as any).institution.count(),
            prismaClient.website.count(),
            prismaClient.websiteTemplate.count({ where: { deletedAt: null } })
        ]);

        return {
            totalUsers: userCount,
            totalOrganizations: orgCount,
            totalWebsites: webCount,
            totalTemplates: templateCount,
            activeDeployments: webCount // Simplified
        };
    }

    async getTenantStats(institution_id: string) {
        // Scoped stats for Institution Admin
        const [userCount, webCount, templateCount] = await Promise.all([
            prismaClient.user.count({ where: { institution_id } }),
            prismaClient.website.count({ where: { institution_id } }),
            prismaClient.websiteTemplate.count({ where: { institution_id, deletedAt: null } })
        ]);

        return {
            totalUsers: userCount,
            totalWebsites: webCount,
            totalTemplates: templateCount,
            activeDeployments: webCount
        };
    }

    async getUserStats(userId: string) {
        // Stats for individual user
        const webCount = await prismaClient.website.count({ 
            where: { owner_id: userId } 
        });

        return {
            totalWebsites: webCount,
            activeDeployments: webCount,
            totalUsers: 1, // Just themselves
            totalOrganizations: 0
        };
    }
}

export default new StatsService();
