import express from 'express';
import { generateApiKey, getApiKeys, deleteApiKey } from './apiKey.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = express.Router({
    mergeParams: true, // This option allows the router to access parameters from the parent route
});

router.post('/generate', authMiddleware, generateApiKey);
router.get('/', authMiddleware, getApiKeys);
router.delete('/:id/delete', authMiddleware, deleteApiKey);

export default router;