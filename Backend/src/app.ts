import express from 'express';
import cookieParser from 'cookie-parser';
const app = express();
import authRoutes from './modules/auth/auth.routes.js';

app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

export default app;