import { Router } from "express";
import { ReportController } from "./report.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRole } from "../../middlewares/role.middleware.js";

const router = Router();

//All routes require authentication + Admin/Staff access
router.use(authenticate);
router.use(authorizeRole("Admin", "Staff"));

//GET /api/reports/demographics - Summary stats + charts
router.get("/demographics", ReportController.getDemographicsSummary);

//GET /api/reports/demographics/:category - Detailed breakdown by category
router.get(
  "/demographics/:category",
  ReportController.getDemographicsByCategory,
);

//GET /api/reports/rbi/form-a - RBI Form A data (by household)
router.get("/rbi/form-a", ReportController.getFormAData);

//GET /api/reports/rbi/form-a/export - Export Form A as CSV/XLSX/PDF
router.get("/rbi/form-a/export", ReportController.exportFormA);

//GET /api/reports/rbi/form-c - RBI Form C population monitoring data
router.get("/rbi/form-c", ReportController.getFormCData);

//POST /api/reports/exports/audit - Audit export actions
router.post("/exports/audit", ReportController.logExportAudit);

//GET /api/reports/residents/:id/pdf - Download resident profile PDF (FR4)
router.get("/residents/:id/pdf", ReportController.downloadResidentPdf);

router.post("/dynamic-demographics", ReportController.getDynamicDemographics);

export default router;
