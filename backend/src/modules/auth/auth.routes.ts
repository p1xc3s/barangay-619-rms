import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", AuthController.login);
router.post("/logout", authenticate, AuthController.logout);

//GET /api/auth/verify - Verify token validity
router.get("/verify", authenticate, AuthController.verify);
router.put("/change-password", authenticate, AuthController.changePassword);

export default router;
