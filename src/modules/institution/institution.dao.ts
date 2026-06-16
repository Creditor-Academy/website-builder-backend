import prismaClient from '../../config/prisma.js';

class InstitutionDao {
    async create(data: { name: string; email: string; status?: string }) {
        // Prisma 7 style with model-specific methods
        return await prismaClient.institution.create({
            data: {
                name: data.name,
                email: data.email,
                status: data.status || 'PENDING'
            }
        });
    }

    async list() {
        return await prismaClient.institution.findMany({
            include: {
                _count: {
                    select: {
                        users: true,
                        websites: true,
                        templates: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async getDetailedList() {
        return await prismaClient.institution.findMany({
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        created_at: true
                    }
                },
                websites: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        created_at: true,
                        owner_id: true
                    }
                },
                templates: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                        scope: true,
                        createdAt: true,
                        deletedAt: true
                    }
                },
                _count: {
                    select: {
                        users: true,
                        websites: true,
                        templates: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    async findById(id: string) {
        return await prismaClient.institution.findUnique({
            where: { id },
            include: {
                users: {
                    select: { id: true, name: true, email: true, role: true }
                }
            }
        });
    }

    async findDetailedById(id: string) {
        return await prismaClient.institution.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        created_at: true
                    }
                },
                websites: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        created_at: true,
                        owner_id: true
                    }
                },
                templates: {
                    select: {
                        id: true,
                        name: true,
                        category: true,
                        scope: true,
                        createdAt: true,
                        deletedAt: true
                    }
                },
                _count: {
                    select: {
                        users: true,
                        websites: true,
                        templates: true
                    }
                }
            }
        });
    }

    async update(id: string, data: any) {
        // Filter out fields that shouldn't be updated or cause errors
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.email) updateData.email = data.email;
        if (data.status) updateData.status = data.status;

        return await prismaClient.institution.update({
            where: { id },
            data: updateData
        });
    }

    async delete(id: string) {
        return await prismaClient.institution.delete({
            where: { id }
        });
    }
}

export default new InstitutionDao();
