import prismaClient from '../config/prisma.js';
import { UserRole } from '@prisma/client';

async function verify() {
  console.log('--- Multi-tenancy Verification Status ---');
  
  try {
    const orgs = await (prismaClient as any).institution.findMany({
      include: {
        _count: {
          select: { users: true, websites: true }
        }
      }
    });

    console.log(`\nFound ${orgs.length} Organizations:`);
    orgs.forEach((org: any) => {
      console.log(`- ${org.name} (${org.status}): ${org._count.users} users, ${org._count.websites} websites`);
    });

    const superAdmin = await prismaClient.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });
    console.log(`\nSuper Admin Check: ${superAdmin ? "✅ Found (" + superAdmin.email + ")" : "❌ MISSING"}`);

    const orphanedWebsites = await prismaClient.website.count({
      where: { institution_id: null }
    });
    console.log(`Orphaned Websites: ${orphanedWebsites === 0 ? "✅ 0" : "⚠️ " + orphanedWebsites + " (Needs migration)"}`);

    const orphanedUsers = await prismaClient.user.count({
      where: { institution_id: null }
    });
    console.log(`Orphaned Users: ${orphanedUsers === 0 ? "✅ 0" : "⚠️ " + orphanedUsers + " (Needs migration)"}`);

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    process.exit();
  }
}

verify();
