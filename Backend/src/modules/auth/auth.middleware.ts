import type { NextFunction, Response } from 'express';
import { AppError } from '../../utils/Apperror.js';
import { verifyToken } from '../../utils/jwt.js';
import type { AuthenticatedRequest } from './auth.types.js';

export const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError(401, 'Access token is required'));
  try {
    const payload = verifyToken(header.slice(7), 'access');
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) throw new Error('Invalid subject');
    req.user = { id, email: payload.email };
    return next();
  } catch { return next(new AppError(401, 'Invalid or expired access token')); }
};
