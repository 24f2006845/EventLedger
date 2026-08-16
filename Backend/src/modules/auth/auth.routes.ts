import { Router } from "express";
const router = Router();



router.post("/login");
router.post("/register");
router.get('/me')
router.post('/logout')

export default router;