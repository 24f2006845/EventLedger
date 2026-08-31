import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { adminMiddleware } from "../../middlewares/role.middleware.js";
import { getAllProjectsController, getAllUsersController, getProjectByIdController, getUserByIdController } from "./admin.controller.js";
const router = Router();


// User Management Routes
router.get('/users',authMiddleware, adminMiddleware, getAllUsersController)
router.get('/users/:userId',authMiddleware, adminMiddleware, getUserByIdController)
// Api Key Management Routes


// Project Management Routes
router.get('/projects',authMiddleware, adminMiddleware, getAllProjectsController)
router.get('/projects/:projectId',authMiddleware, adminMiddleware, getProjectByIdController)
// Admin Management Routes
export default router;