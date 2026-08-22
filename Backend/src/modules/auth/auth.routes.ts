import { Router } from "express";
import { registerController, loginController, logoutController, getMeController, refreshTokenController } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();



router.post("/login" , loginController);
router.post("/register", registerController);
router.get('/me', authMiddleware, getMeController);
router.post('/logout', authMiddleware, logoutController);
router.post('/refresh-token',authMiddleware, refreshTokenController);

export default router;
