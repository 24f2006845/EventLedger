import type { Request } from 'express';
export type AuthUser = { id: number; email: string };
export type AuthenticatedRequest = Request & { user?: AuthUser };
