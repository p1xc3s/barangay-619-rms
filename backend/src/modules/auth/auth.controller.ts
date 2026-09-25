import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { UserService } from "../users/user.service.js";
import { ENV } from "../../config/env.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

export const AuthController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      const user = await UserService.validateUser(username, password);
      if (!user) {
        return res.status(401).json({
          message: "Invalid credentials!",
        });
      }

      const token = jwt.sign(
        {
          userId: user.UserID,
          role: user.Role,
          isFirstLogin: user.IsFirstLogin === 1,
        },
        ENV.JWT_SECRET,
        { expiresIn: "1h" },
      );

      try {
        await AuditTrailRepository.log({
          userId: user.UserID,
          action: "USER_LOGIN",
          newValue: JSON.stringify({
            loggedInAt: new Date().toISOString(),
          }),
        });
      } catch (auditErr) {
        console.error("Failed to write USER_LOGIN audit log:", auditErr);
      }

      res.json({ token });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;

      await AuditTrailRepository.log({
        userId,
        action: "USER_LOGOUT",
        newValue: JSON.stringify({ loggedOutAt: new Date().toISOString() }),
      });

      res.json({ success: true, message: "Logged out successfully!" });
    } catch (err) {
      next(err);
    }
  },

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const userToken = (req as any).user;
      const user = await UserService.getUserById(userToken.userId);

      res.json({
        success: true,
        data: {
          userId: user.UserID,
          role: user.Role,
          isFirstLogin: user.IsFirstLogin === 1,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({
          message: "New password is required!",
        });
      }
      
      // Update password and clear the first login flag
      await UserService.updateUser(userId, {
        password: newPassword,
        isFirstLogin: false,
      });

      res.json({
        success: true,
        message: "Password updated successfully!",
      });
    } catch (err) {
      next(err);
    }
  },
};
