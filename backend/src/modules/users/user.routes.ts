import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRole } from "../../middlewares/role.middleware.js";
import { UserService } from "./user.service.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

const router = Router();

//All user routes require Admin role
router.use(authenticate);
router.use(authorizeRole("Admin"));

//GET all users
router.get("/", async (req, res, next) => {
  try {
    const users = await UserService.getAllUsers();
    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
});

//POST Create new user
router.post("/", async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    const actorUserId = req.user!.userId;
    const createdUserId = await UserService.createUser(
      username,
      password,
      role,
    );

    await AuditTrailRepository.log({
      userId: actorUserId,
      action: "CREATE_USER",
      newValue: JSON.stringify({
        createdUserId,
        username,
        role,
      }),
    });

    res.status(201).json({
      success: true,
      data: {
        userId: createdUserId,
      },
    });
  } catch (err) {
    next(err);
  }
});

//PUT Update user details
router.put("/:id", async (req, res, next) => {
  try {
    const targetUserId = Number(req.params.id);
    const { username, password, role } = req.body;
    const userId = (req as any).user.userId;

    await UserService.updateUser(targetUserId, { username, password, role });

    await AuditTrailRepository.log({
      userId,
      action: "UPDATE_USER",
      newValue: JSON.stringify({
        updatedUserId: targetUserId,
        username,
        role,
      }),
    });

    res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

//PATCH Activate/Deactivate Users
router.patch("/:id/status", async (req, res, next) => {
  try {
    const targetUserId = Number(req.params.id);
    const { status } = req.body;
    const userId = (req as any).user.userId;

    if (targetUserId === userId && status === "Inactive") {
      return res.status(403).json({ 
        success: false, 
        message: "You cannot deactivate your own account!" 
      });
    }

    await UserService.updateUserStatus(targetUserId, status);

    await AuditTrailRepository.log({
      userId,
      action: status === "Active" ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      newValue: JSON.stringify({
        targetUserId,
        status,
      }),
    });

    res.json({
      success: true,
      message: `User ${status === "Active" ? "activated" : "deactivated"} successfully!`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
