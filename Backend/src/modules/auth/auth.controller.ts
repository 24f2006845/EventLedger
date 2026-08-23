import type { Request, Response } from 'express';
import AppError from '../../utils/Apperror.js';
import { registerService, loginService, logoutService, GetMeService, refreshTokenService } from './auth.service.js';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const registerController = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  try {
    const result = await registerService(username, email, password);
    if (result instanceof AppError) {
      return res.status(result.statusCode).json({ error: result.message });
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await loginService(email, password);
    if (result instanceof AppError) {
      return res.status(result.statusCode).json({ error: result.message });
    }
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    const { refreshToken: _refreshToken, ...response } = result;
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logoutController = async (req: Request, res: Response) => {
  const userId = req.user?.userId; 
  res.clearCookie('refreshToken', refreshCookieOptions);

  try {
    const result = await logoutService(userId as string); ;
    if (result instanceof AppError) {
      return res.status(result.statusCode).json({ error: result.message });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export const getMeController = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  try {
    const result = await GetMeService(userId as string);
    if (result instanceof AppError) {
      return res.status(result.statusCode).json({ error: result.message });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const refreshTokenController = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  try {
    if (typeof refreshToken !== 'string' || !refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const result = await refreshTokenService(refreshToken);
    if (result instanceof AppError) {
      return res.status(result.statusCode).json({ error: result.message });
    }
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    const { refreshToken: _refreshToken, ...response } = result;
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

