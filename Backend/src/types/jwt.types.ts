import type { Role } from "../../generated/prisma/browser.js";
export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number; // Issued at time
  exp?: number; // Expiration time
}

