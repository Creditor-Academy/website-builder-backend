import jwt from "jsonwebtoken";
import type { SignOptions, Secret } from "jsonwebtoken";
import type { JWTPayload } from "../types/auth.types.js";
import { TOKEN_EXPIRY } from "../constants/auth.constants.js";
import { UnauthorizedError } from "./error.utils.js";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start with an empty signing key.');
}
const expiresIn = TOKEN_EXPIRY.ACCESS_TOKEN || '15m';

export const generateAccessToken = (payload: any) => {
  return jwt.sign(
    payload, secretKey as Secret,
    { expiresIn: expiresIn } as SignOptions
  );
};

export const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, secretKey as Secret);
    return decoded as JWTPayload;
  } catch (error: any) {
    throw new UnauthorizedError("Invalid token");
  }
};