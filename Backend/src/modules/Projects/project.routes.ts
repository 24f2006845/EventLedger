import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
const router = express.Router();


router.get('/', authMiddleware)
router.post('/create', authMiddleware)
router.get('/:id', authMiddleware)
router.delete('/:id', authMiddleware)

export default router;