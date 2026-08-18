import jwt, { type SignOptions } from 'jsonwebtoken';

export type TokenType = 'access' | 'refresh';
export type TokenPayload = { sub: string; email: string; type: TokenType };

const getSecret = (type: TokenType): string => {
  const secret = type === 'access' ? process.env.ACCESS_TOKEN_SECRET : process.env.REFRESH_TOKEN_SECRET;
  if (!secret) throw new Error(`${type.toUpperCase()}_TOKEN_SECRET is not configured`);
  return secret;
};

const getExpiresIn = (type: TokenType): SignOptions['expiresIn'] =>
  (type === 'access' ? process.env.ACCESS_TOKEN_EXPIRES_IN : process.env.REFRESH_TOKEN_EXPIRES_IN) ?? (type === 'access' ? '15m' : '7d');

export const signToken = (payload: Omit<TokenPayload, 'type'>, type: TokenType): string =>
  jwt.sign({ ...payload, type }, getSecret(type), { expiresIn: getExpiresIn(type) });

export const verifyToken = (token: string, type: TokenType): TokenPayload => {
  const payload = jwt.verify(token, getSecret(type));
  if (typeof payload !== 'object' || payload === null || payload.type !== type || typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('Invalid token payload');
  return payload as TokenPayload;
};
