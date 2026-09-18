import api from "./api";
import type {
  HouseholdListItem,
  HouseholdDetail,
  HouseholdAddressOption,
  HouseholdNumber,
} from "../types";
import { broadcastHouseholdDataUpdated } from "../hooks/useHouseholdDataSync";

export const householdService = {
  /** List all households */
  async getAll(): Promise<HouseholdListItem[]> {
    const response = await api.get("/households");
    return response.data.data;
  },

  /** Get a single household with its residents */
  async getById(id: number): Promise<HouseholdDetail> {
    const response = await api.get(`/households/${id}`);
    return response.data.data;
  },

  /** Create a new household (Admin only) */
  async create(data: { addressId: number }): Promise<{ householdId: number }> {
    const response = await api.post("/households", data);
    broadcastHouseholdDataUpdated();
    return response.data.data;
  },

  /** Update a household (Admin only) */
  async update(id: number, data: { addressId?: number }): Promise<void> {
    await api.put(`/households/${id}`, data);
    broadcastHouseholdDataUpdated();
  },

  /** Update household number status */
  async updateStatus(
    houseId: number,
    status: "Available" | "Assigned" | "Inactive",
  ): Promise<void> {
    await api.put(`/households/${houseId}/status`, { status });
    broadcastHouseholdDataUpdated();
  },

  /** Get all household numbers (house plates) */
  async getAllNumbers(): Promise<HouseholdNumber[]> {
    const response = await api.get("/household-numbers");
    return response.data.data;
  },

  /** Get address options for linking a household number to a street */
  async getAllAddresses(): Promise<HouseholdAddressOption[]> {
    const response = await api.get("/household-numbers/addresses");
    return response.data.data;
  },

  /** Create a new household number (Admin only) */
  async createNumber(data: {
    householdNumberName: string;
    streetName: string;
  }): Promise<{ houseId: number }> {
    const response = await api.post("/household-numbers", data);
    broadcastHouseholdDataUpdated();
    return response.data.data;
  },

  /** Update household number name (Admin only) */
  async updateNumberName(houseId: number, newName: string): Promise<void> {
    await api.put(`/household-numbers/${houseId}/name`, { name: newName });
    broadcastHouseholdDataUpdated();
  },
};
