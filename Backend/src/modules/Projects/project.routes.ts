import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { createProjectController, deleteProjectController, getAllProjectsController, getProjectByIdController } from './project.controller.js';
const router = express.Router();


router.get('/', authMiddleware , getAllProjectsController);
router.post('/create', authMiddleware , createProjectController);
router.get('/:id', authMiddleware , getProjectByIdController);
router.delete('/:id', authMiddleware , deleteProjectController);

export default router;