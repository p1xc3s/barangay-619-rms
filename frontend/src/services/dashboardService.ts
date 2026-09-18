import api from "./api";
import type { DashboardStats, Official } from "../types";

export const dashboardService = {
  /** Fetch all dashboard statistics (stat cards, classification, logs) */
  async getStats(dateFilter?: string): Promise<DashboardStats> {
    const params = dateFilter ? { dateFilter } : undefined;
    const response = await api.get("/dashboard/stats", { params });
    // Backend wraps in { success: true, data: ... }
    return response.data.data;
  },

  /** Fetch all barangay officials for the sidebar list */
  async getOfficials(): Promise<Official[]> {
    const response = await api.get("/officials/active");
    // Backend wraps in { success: true, data: [...] }
    return response.data.data;
  },
};
