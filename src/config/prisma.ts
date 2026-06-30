import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// Force Node.js to accept self-signed certificates from AWS/Supabase globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRESQL_URL,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prismaClient = new PrismaClient({ adapter });

console.log("Prisma PostgreSQL connected successfully");

export default prismaClient;