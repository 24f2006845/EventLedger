import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { adminMiddleware } from "../../middlewares/role.middleware.js";
import { getAllProjectsController, getAllUsersController, getProjectByIdController, getUserByIdController,getAllApiKeysController ,getAllApiKeysByIdController} from "./admin.controller.js";
const router = Router();
const apiKeyprefix = "/projects/:projectId";


// User Management Routes
router.get('/users',authMiddleware, adminMiddleware, getAllUsersController)
router.get('/users/:userId',authMiddleware, adminMiddleware, getUserByIdController)
// Api Key Management Routes
router.get(`${apiKeyprefix}/apikeys`,authMiddleware, adminMiddleware, getAllApiKeysController)
router.get(`${apiKeyprefix}/apikeys/:apiKeyId`,authMiddleware, adminMiddleware, getAllApiKeysByIdController)
router.delete(`${apiKeyprefix}/apikeys/:apiKeyId`,authMiddleware, adminMiddleware, getAllApiKeysByIdController)




// Project Management Routes
router.get('/projects',authMiddleware, adminMiddleware, getAllProjectsController)
router.get('/projects/:projectId',authMiddleware, adminMiddleware, getProjectByIdController)

// Admin Management Routes
export default router;