import InstitutionDao from './institution.dao.js';

class InstitutionService {
    async createInstitution(data: { name: string; email: string; status?: string }) {
        return await InstitutionDao.create(data);
    }

    async getInstitutions() {
        return await InstitutionDao.list();
    }

    async getInstitutionById(id: string) {
        return await InstitutionDao.findById(id);
    }

    async getDetailedInstitutions() {
        return await InstitutionDao.getDetailedList();
    }

    async getDetailedInstitutionById(id: string) {
        return await InstitutionDao.findDetailedById(id);
    }

    async updateInstitution(id: string, data: any) {
        return await InstitutionDao.update(id, data);
    }

    async deleteInstitution(id: string) {
        return await InstitutionDao.delete(id);
    }
}

export default new InstitutionService();
