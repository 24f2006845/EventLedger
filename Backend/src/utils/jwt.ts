import AppError from "./Apperror.js";
import type { JwtPayload } from "../types/jwt.types.js";
import jwt from "jsonwebtoken";

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || "defaultAccessTokenSecret";
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "defaultRefreshTokenSecret";
if(!accessTokenSecret || !refreshTokenSecret) {
  throw new AppError("JWT secrets are not defined in environment variables", 500);
}

export function generateAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, accessTokenSecret, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, refreshTokenSecret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, accessTokenSecret) as JwtPayload;
    return decoded;
  } catch (err) {
    throw new AppError("Invalid or expired access token", 401);
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, refreshTokenSecret) as JwtPayload;
    return decoded;
  } catch (err) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}   