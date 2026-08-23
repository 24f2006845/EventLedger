import * as z from 'zod';
import AppError from '../../utils/Apperror.js';
import type { Request, Response, NextFunction } from 'express';

export const registerSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters long' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

export function ValidateSchema (schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(issue => issue.message);
        return res.status(400).json({ errors: errorMessages });
      }
      next(error);
    }
  };
}   

export const validateRegister = ValidateSchema(registerSchema);
export const validateLogin = ValidateSchema(loginSchema);