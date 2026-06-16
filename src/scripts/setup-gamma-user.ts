import prismaClient from '../config/prisma.js';
import { hashPassword } from '../utils/password.util.js';
import { UserRole } from '@prisma/client';

async function setup() {
  const org = await prismaClient.institution.findFirst({ where: { name: 'Gamma labs' } });
  if (!org) {
    console.log("Gamma labs not found");
    return;
  }

  const email = 'gamma@test.com';
  const password = 'Password123!';
  const password_hash = await hashPassword(password);

  const user = await prismaClient.user.upsert({
    where: { email },
    update: { institution_id: org.id, role: UserRole.INSTITUTION_ADMIN },
    create: {
      email,
      name: 'Gamma Admin',
      password_hash,
      role: UserRole.INSTITUTION_ADMIN,
      institution_id: org.id,
      isVerified: true
    }
  });

  console.log(`--- Gamma Labs Test User Created ---`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Organization: ${org.name}`);
  console.log(`Role: ${user.role}`);
}

setup();
