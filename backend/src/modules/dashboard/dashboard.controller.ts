import type { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service.js";

export class DashboardController {

    //GET /api/dashboard/stats
    static async getStats(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const dateFilter = req.query.dateFilter as string | undefined;
            const stats = await DashboardService.getDashboardStats(dateFilter);
            res.json({ success: true, data: stats });
        } catch (error) {
            next(error);
        }
    }
}