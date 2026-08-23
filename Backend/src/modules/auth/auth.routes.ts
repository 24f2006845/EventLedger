import { Router } from "express";
import { registerController, loginController, logoutController, getMeController, refreshTokenController } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validateRegister, validateLogin } from "./auth.validation.js";
const router = Router();



router.post("/login" , validateLogin, loginController);
router.post("/register", validateRegister, registerController);
router.get('/me', authMiddleware, getMeController);
router.post('/logout', authMiddleware, logoutController);
router.post('/refresh-token', refreshTokenController);

export default router;
