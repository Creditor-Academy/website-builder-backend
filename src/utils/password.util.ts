import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const hashPassword = async (password : string) => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
  return await bcrypt.hash(password, saltRounds);
}

export const comparePassword = async (password : string, hashedPassword : string) => {
  return await bcrypt.compare(password, hashedPassword);
}