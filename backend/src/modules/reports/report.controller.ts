import type { Request, Response, NextFunction } from "express";
import { ReportService, type FormAExportFormat } from "./report.service.js";
import { ReportRepository } from "./report.repository.js";
import { ProfilePdfService } from "./profile-pdf.service.js";

export class ReportController {
  //GET /api/reports/demographics - Summary stats + chart data
  static async getDemographicsSummary(
    _req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const data = await ReportService.getDemographicsSummary();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  //GET /api/reports/demographics/:category - Detailed breakdown
  static async getDemographicsByCategory(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const category = req.params.category as string;
      const search = String(req.query.search || "");
      const rawPage = Number(req.query.page);
      const rawLimit = Number(req.query.limit);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10;

      const data = await ReportService.getDemographicsByCategory(
        category,
        search,
        page,
        limit,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  //GET /api/reports/rbi/form-a - Form A data
  static async getFormAData(req: Request, res: Response, next: NextFunction) {
    try {
      const rawHouseholdId = req.query.householdId;
      let householdId: number | undefined;

      if (rawHouseholdId !== undefined) {
        const parsedHouseholdId = Number(rawHouseholdId);
        if (!Number.isFinite(parsedHouseholdId) || parsedHouseholdId <= 0) {
          throw { status: 400, message: "Invalid householdId parameter." };
        }
        householdId = Math.floor(parsedHouseholdId);
      }

      const rawPage = Number(req.query.page);
      const rawLimit = Number(req.query.limit);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 25;

      const data = await ReportService.getFormAData(householdId, page, limit);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  //GET /api/reports/rbi/form-a/export - Export Form A as CSV/XLSX/PDF
  static async exportFormA(req: Request, res: Response, next: NextFunction) {
    try {
      const rawFormat = String(req.query.format || "")
        .trim()
        .toLowerCase();

      if (rawFormat !== "csv" && rawFormat !== "xlsx" && rawFormat !== "pdf") {
        throw {
          status: 400,
          message: "Invalid format. Supported values are csv, xlsx, and pdf.",
        };
      }

      const format = rawFormat as FormAExportFormat;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const rawHouseholdId = req.query.householdId;
      let householdId: number | undefined;

      if (rawHouseholdId !== undefined) {
        const parsedHouseholdId = Number(rawHouseholdId);
        if (!Number.isFinite(parsedHouseholdId) || parsedHouseholdId <= 0) {
          throw { status: 400, message: "Invalid householdId parameter." };
        }
        householdId = Math.floor(parsedHouseholdId);
      }

      const exportResult = householdId
        ? await ReportService.exportFormA(format, userId, householdId)
        : await ReportService.exportFormA(format, userId);

      res.setHeader("Content-Type", exportResult.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportResult.fileName}"`,
      );
      res.setHeader("Content-Length", String(exportResult.buffer.length));
      res.send(exportResult.buffer);
    } catch (error) {
      next(error);
    }
  }

  //GET /api/reports/rbi/form-c - Form C data
  static async getFormCData(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getFormCData();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  //POST /api/reports/exports/audit - Log Form C/Certification exports
  static async logExportAudit(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { type, metadata } = req.body as {
        type?: "FORM_C" | "BARANGAY_CERTIFICATION";
        metadata?: Record<string, unknown>;
      };

      if (type !== "FORM_C" && type !== "BARANGAY_CERTIFICATION") {
        throw {
          status: 400,
          message:
            "Invalid export type. Supported values are FORM_C and BARANGAY_CERTIFICATION.",
        };
      }

      await ReportService.logExport(type, userId, metadata ?? {});
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  //GET /api/reports/residents/:id/pdf - Download resident profile PDF (FR4)
  static async downloadResidentPdf(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid resident ID" });
        return;
      }

      const resident = await ReportRepository.getResidentFullProfile(id);
      if (!resident) {
        res.status(404).json({ success: false, message: "Resident not found" });
        return;
      }

      ProfilePdfService.generate(resident, res);
    } catch (error) {
      next(error);
    }
  }

  static async getDynamicDemographics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = req.body;
      const data = await ReportService.getDynamicDemographics(filters);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
