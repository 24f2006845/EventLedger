import express from 'express';
const app = express();
import authRoutes from './modules/auth/auth.routes.js';

app.use(express.json());
app.use('/api/auth', authRoutes);

export default app;