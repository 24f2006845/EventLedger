import bcrypt from 'bcrypt';
import prisma from '../../config/db.js';
import { AppError } from '../../utils/Apperror.js';
import { signToken, verifyToken } from '../../utils/jwt.js';
import type { Credentials } from './auth.validation.js';

const publicUserSelect = { id: true, email: true } as const;
const issueTokens = async (user: { id: number; email: string }) => {
  const accessToken = signToken({ sub: String(user.id), email: user.email }, 'access');
  const refreshToken = signToken({ sub: String(user.id), email: user.email }, 'refresh');
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: await bcrypt.hash(refreshToken, 12) } });
  return { accessToken, refreshToken };
};

export const register = async ({ email, password }: Credentials) => {
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError(409, 'An account with this email already exists');
  const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 12) }, select: publicUserSelect });
  return { user, ...(await issueTokens(user)) };
};
export const login = async ({ email, password }: Credentials) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) throw new AppError(401, 'Invalid email or password');
  return { user: { id: user.id, email: user.email }, ...(await issueTokens(user)) };
};
export const refresh = async (token: string) => {
  let payload;
  try { payload = verifyToken(token, 'refresh'); } catch { throw new AppError(401, 'Invalid or expired refresh token'); }
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.refreshTokenHash || !(await bcrypt.compare(token, user.refreshTokenHash))) throw new AppError(401, 'Invalid or expired refresh token');
  return { user: { id: user.id, email: user.email }, ...(await issueTokens(user)) };
};
export const logout = async (userId: number) => { await prisma.user.updateMany({ where: { id: userId }, data: { refreshTokenHash: null } }); };
export const getUser = async (userId: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw new AppError(404, 'User not found');
  return user;
};
