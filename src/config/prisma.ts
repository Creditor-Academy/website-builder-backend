import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRESQL_URL,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prismaClient = new PrismaClient({ adapter });

console.log("Prisma PostgreSQL connected successfully");

export default prismaClient;