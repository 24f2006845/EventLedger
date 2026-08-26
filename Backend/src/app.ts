import express from 'express';
import cookieParser from 'cookie-parser';
const app = express();
import authRoutes from './modules/auth/auth.routes.js';
import apiKeyRoutes from './modules/apiKey/apiKey.routes.js';
import projectRoutes from './modules/Projects/project.routes.js';

app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/project/:projectId/apiKeys', apiKeyRoutes);
app.use('/api/projects', projectRoutes);

export default app;