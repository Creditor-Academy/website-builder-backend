import prismaClient from '../config/prisma.js';

async function migrate() {
  console.log('--- Migrating Orphan Records to Buildora Master ---');
  
  try {
    const masterOrg = await (prismaClient as any).institution.findFirst({
      where: { name: 'Buildora Master' }
    });

    if (!masterOrg) {
      console.error('❌ Buildora Master organization not found. Run verify-tenancy.ts first.');
      return;
    }

    console.log(`Using Institution: ${masterOrg.name} (${masterOrg.id})`);

    // Migrate Users
    const userUpdate = await prismaClient.user.updateMany({
      where: { institution_id: null },
      data: { institution_id: masterOrg.id }
    });
    console.log(`✅ Migrated ${userUpdate.count} users.`);

    // Migrate Websites
    const webUpdate = await prismaClient.website.updateMany({
      where: { institution_id: null },
      data: { institution_id: masterOrg.id }
    });
    console.log(`✅ Migrated ${webUpdate.count} websites.`);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();
