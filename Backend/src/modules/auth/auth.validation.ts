import * as z from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const registerSchema = z.object({
  username: z.string().trim().min(3, { message: 'Username must be at least 3 characters long' }),
  email: z.string().trim().toLowerCase().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
});

export function validateSchema (schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: result.error.issues.map(issue => ({ field: issue.path.join('.') || 'body', message: issue.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

export const validateRegister = validateSchema(registerSchema);
export const validateLogin = validateSchema(loginSchema);
