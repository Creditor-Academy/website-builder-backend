import prismaClient from '../config/prisma.js';

async function check() {
    try {
        const users = await prismaClient.user.findMany({
            select: { name: true, email: true, role: true }
        });
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
check();
