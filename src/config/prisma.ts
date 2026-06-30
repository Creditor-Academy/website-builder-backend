import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// Force Node.js to accept self-signed certificates from AWS/Supabase globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Parse the connection string to explicitly remove ?sslmode=...
// The pg library treats sslmode=require as verify-full, which forces strict verification
// and completely ignores our custom ssl object below.
let cleanConnectionString = process.env.POSTGRESQL_URL || '';
try {
  const dbUrl = new URL(cleanConnectionString);
  dbUrl.searchParams.delete('sslmode');
  cleanConnectionString = dbUrl.toString();
} catch (e) {
  console.warn("Could not parse database URL to remove sslmode");
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prismaClient = new PrismaClient({ adapter });

console.log("Prisma PostgreSQL connected successfully");

export default prismaClient;