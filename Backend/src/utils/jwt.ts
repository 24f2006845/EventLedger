import AppError from "./Apperror.js";
import type { JwtPayload } from "../types/jwt.types.js";
import jwt from "jsonwebtoken";

const requiredSecret = (name: 'ACCESS_TOKEN_SECRET' | 'REFRESH_TOKEN_SECRET') => {
  const secret = process.env[name];
  if (!secret) throw new Error(`${name} must be defined`);
  return secret;
};

const accessTokenSecret = requiredSecret('ACCESS_TOKEN_SECRET');
const refreshTokenSecret = requiredSecret('REFRESH_TOKEN_SECRET');

export function generateAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, accessTokenSecret, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, refreshTokenSecret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, accessTokenSecret) as unknown as JwtPayload;
    if (!decoded || typeof decoded.userId !== 'string' || !decoded.role) throw new Error('Invalid payload');
    return decoded;
  } catch (err) {
    throw new AppError("Invalid or expired access token", 401);
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, refreshTokenSecret) as unknown as JwtPayload;
    if (!decoded || typeof decoded.userId !== 'string' || !decoded.role) throw new Error('Invalid payload');
    return decoded;
  } catch (err) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}
