import { ReportRepository } from "./report.repository.js";
import {
  FormAExportService,
  type FormAExportFormat,
} from "./formA-export.service.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

export class ReportService {
  private static readonly FORM_A_EXPORT_MAX_ROWS = 10000;
  private static readonly EXPORT_ACTIONS = {
    FORM_C: "EXPORT_FORM_C",
    BARANGAY_CERTIFICATION: "EXPORT_BARANGAY_CERTIFICATION",
  } as const;

  //Get demographics summary (all 8 stat cards + chart data)
  static async getDemographicsSummary() {
    const [
      inhabitants,
      households,
      families,
      voters,
      seniors,
      pwd,
      soloParent,
      indigent,
      ageGroups,
      employment,
    ] = await Promise.all([
      ReportRepository.getTotalInhabitants(),
      ReportRepository.getTotalHouseholds(),
      ReportRepository.getTotalFamilies(),
      ReportRepository.getRegisteredVoters(),
      ReportRepository.getSeniorCitizens(),
      ReportRepository.getCategoryCount("PWD"),
      ReportRepository.getCategoryCount("Solo Parent"),
      ReportRepository.getCategoryCount("4Ps"),
      ReportRepository.getAgeGroupDistribution(),
      ReportRepository.getEmploymentBreakdown(),
    ]);

    return {
      stats: {
        inhabitants,
        households,
        families,
        voters,
        seniors,
        pwd,
        soloParent,
        indigent,
      },
      charts: {
        ageGroups,
        employment,
      },
    };
  }

  //Get detailed resident list by category
  static async getDemographicsByCategory(
    category: string,
    search: string = "",
    page: number = 1,
    limit: number = 10,
  ) {
    return ReportRepository.getResidentsByCategory(
      category,
      search,
      page,
      limit,
    );
  }

  //Get RBI Form A data
  static async getFormAData(
    householdId?: number,
    page: number = 1,
    limit: number = 25,
  ) {
    if (householdId) {
      return ReportRepository.getFormAData({ householdId, page, limit });
    }

    return ReportRepository.getFormAData({ page, limit });
  }

  //Export RBI Form A in CSV/XLSX/PDF format
  static async exportFormA(
    format: FormAExportFormat,
    userId: number,
    householdId?: number,
  ) {
    const formAResult = householdId
      ? await ReportRepository.getFormAData({
          householdId,
          disablePagination: true,
        })
      : await ReportRepository.getFormAData({ disablePagination: true });

    if (formAResult.total > this.FORM_A_EXPORT_MAX_ROWS) {
      throw {
        status: 413,
        message: `Form A export exceeds the maximum allowed ${this.FORM_A_EXPORT_MAX_ROWS.toLocaleString()} rows per request.`,
      };
    }

    const exportFile = await FormAExportService.generate(
      format,
      formAResult.data,
    );

    try {
      await AuditTrailRepository.log({
        userId,
        action: "EXPORT_FORM_A",
        newValue: JSON.stringify({
          format,
          totalRows: formAResult.total,
          householdId: householdId ?? null,
        }),
      });
    } catch (auditError) {
      console.error("Failed to write EXPORT_FORM_A audit log:", auditError);
    }

    return {
      ...exportFile,
      totalRows: formAResult.total,
    };
  }

  //Get RBI Form C data
  static async getFormCData() {
    return ReportRepository.getFormCData();
  }

  static async logExport(
    type: keyof typeof ReportService.EXPORT_ACTIONS,
    userId: number,
    metadata: Record<string, unknown> = {},
  ) {
    const action = ReportService.EXPORT_ACTIONS[type];

    try {
      await AuditTrailRepository.log({
        userId,
        action,
        newValue: JSON.stringify(metadata),
      });
    } catch (auditError) {
      console.error(`Failed to write ${action} audit log:`, auditError);
    }
  }

  static async getDynamicDemographics(filters: any) {
    return await ReportRepository.getDynamicDemographics(filters);
  }
}

export type { FormAExportFormat };
