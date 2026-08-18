import type { NextFunction, Request, Response } from 'express';
import { credentialsSchema, refreshSchema } from './auth.validation.js';
import * as authService from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

export const register = async (req: Request, res: Response, next: NextFunction) => { try { res.status(201).json(await authService.register(credentialsSchema.parse(req.body))); } catch (error) { next(error); } };
export const login = async (req: Request, res: Response, next: NextFunction) => { try { res.json(await authService.login(credentialsSchema.parse(req.body))); } catch (error) { next(error); } };
export const refresh = async (req: Request, res: Response, next: NextFunction) => { try { const { refreshToken } = refreshSchema.parse(req.body); res.json(await authService.refresh(refreshToken)); } catch (error) { next(error); } };
export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ user: await authService.getUser(req.user!.id) }); } catch (error) { next(error); } };
export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { await authService.logout(req.user!.id); res.status(204).send(); } catch (error) { next(error); } };
