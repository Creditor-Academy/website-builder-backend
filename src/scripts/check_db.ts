import prismaClient from '../config/prisma.js';

async function check() {
    try {
        const users = await prismaClient.user.count();
        const websites = await prismaClient.website.count();
        const orgs = await prismaClient.institution.count();
        console.log(`Users: ${users}`);
        console.log(`Websites: ${websites}`);
        console.log(`Organizations: ${orgs}`);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
check();
