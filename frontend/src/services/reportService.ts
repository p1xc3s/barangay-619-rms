import api from "./api";
import type {
  ReportDemographicsSummary,
  ReportDemographicsCategoryResponse,
  ReportFormAExportFormat,
  ReportFormAPreviewResponse,
  ReportFormARecord,
  ReportFormCData,
} from "../types";

interface CategoryQuery {
  search?: string;
  page?: number;
  limit?: number;
}

interface FormAPreviewQuery {
  householdId?: number;
  page?: number;
  limit?: number;
}

const extractFileName = (
  contentDisposition: string | undefined,
  fallback: string,
): string => {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || fallback;
};

export const reportService = {
  async getDemographicsSummary(): Promise<ReportDemographicsSummary> {
    const response = await api.get("/reports/demographics");
    return response.data.data;
  },

  async getDemographicsByCategory(
    category: string,
    query: CategoryQuery,
  ): Promise<ReportDemographicsCategoryResponse> {
    const response = await api.get(`/reports/demographics/${category}`, {
      params: query,
    });
    return response.data.data;
  },

  async getFormAData(householdId?: number): Promise<ReportFormARecord[]> {
    const params: FormAPreviewQuery = { page: 1, limit: 200 };
    if (householdId !== undefined) {
      params.householdId = householdId;
    }

    const response = await api.get("/reports/rbi/form-a", {
      params,
    });

    const payload = response.data.data as ReportFormAPreviewResponse;
    return payload.data;
  },

  async getFormAPreview(
    query: FormAPreviewQuery,
  ): Promise<ReportFormAPreviewResponse> {
    const params: FormAPreviewQuery = {};

    if (query.householdId !== undefined) {
      params.householdId = query.householdId;
    }
    if (query.page !== undefined) {
      params.page = query.page;
    }
    if (query.limit !== undefined) {
      params.limit = query.limit;
    }

    const response = await api.get("/reports/rbi/form-a", {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data.data as ReportFormAPreviewResponse;
  },

  async exportFormA(
    format: ReportFormAExportFormat,
    householdId?: number,
  ): Promise<{ blob: Blob; fileName: string }> {
    const params: Record<string, string | number> = { format };
    if (householdId !== undefined) {
      params.householdId = householdId;
    }

    const response = await api.get("/reports/rbi/form-a/export", {
      params,
      responseType: "blob",
    });

    const fallbackName = `form_a_export.${format}`;
    const fileName = extractFileName(
      response.headers["content-disposition"] as string | undefined,
      fallbackName,
    );

    return {
      blob: response.data as Blob,
      fileName,
    };
  },

  async getFormCData(): Promise<ReportFormCData> {
    const response = await api.get("/reports/rbi/form-c");
    return response.data.data;
  },

  async logExportAudit(
    type: "FORM_C" | "BARANGAY_CERTIFICATION",
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await api.post("/reports/exports/audit", { type, metadata });
  },

  async downloadResidentPdf(residentId: number): Promise<Blob> {
    const response = await api.get(`/reports/residents/${residentId}/pdf`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  async getDynamicDemographics(filters: {
    ageMin?: number;
    ageMax?: number;
    sex?: string;
    civilStatus?: string;
    employmentStatus?: string;
    categories?: string[];
    street?: string;
  }): Promise<any> {
    const response = await api.post("/reports/dynamic-demographics", filters);
    return response.data;
  },
};
