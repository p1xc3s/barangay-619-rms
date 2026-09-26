import api from "./api";
import type { ResidentListItem, Resident, CreateResidentData } from "../types";

export interface UpdateResidentData {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  sex: "Male" | "Female";
  dateOfBirth?: string;
  placeOfBirth?: string;
  civilStatus: string;
  citizenship?: string;
  inhabitantType?: string;
  religion?: string;
  contactNumber?: string;
  email?: string;
  residentStatus: "Active" | "Deceased" | "MovedOut";
  mothersMaidenSurname?: string;
  mothersMaidenFirstName?: string;
  mothersMaidenMiddleName?: string;
  hasEducation?: "yes" | "no";
  educationLevel?: string;
  educationStatus?: string;
  isEmployed?: "yes" | "no";
  occupation?: string;
  employmentStatus?: string;
  isVoter?: "yes" | "no";
  precinctNumber?: string;
  categories?: string[];
  householdRole?: "head" | "member";
  occupancyStatus?: "Owner" | "Renter" | "Sharer" | "Boarder";
  householdId?: number;
  address?: {
    unitRoomFloor?: string;
    buildingName?: string;
    lotBlockPhase?: string;
    houseNumber?: string;
    street?: string;
    barangay?: string;
    municipality?: string;
  };
}

export interface ResidentSearchFilters {
  name?: string;
  sex?: string;
  civilStatus?: string;
  status?: string;
  householdId?: string;
  inhabitantType?: string;
  address?: string;
}

export const residentService = {
  /** Check for duplicate resident before creating */
  async checkDuplicate(firstName: string, lastName: string, middleName: string | undefined, dob: string): Promise<boolean> {
    const response = await api.post("/residents/check-duplicate", {
      firstName,
      lastName,
      middleName,
      dob,
    });
    return response.data.isDuplicate;
  },

  /** Fetch all active residents (slim list for the table) */
  async getAll(): Promise<ResidentListItem[]> {
    const response = await api.get("/residents");
    return response.data.data;
  },

  /** Search residents with filters — sends query params to backend */
  async search(filters: ResidentSearchFilters): Promise<ResidentListItem[]> {
    const response = await api.get("/residents/search", { params: filters });
    return response.data.data;
  },

  /** Get one resident's full profile by ID */
  async getById(id: number): Promise<Resident> {
    const response = await api.get(`/residents/${id}`);
    return response.data.data;
  },

  /** Create a new resident (returns the new residentId) */
  async create(data: CreateResidentData): Promise<{ residentId: number }> {
    const response = await api.post("/residents", data);
    return response.data.data;
  },

  /** Update a resident's information */
  async update(id: number, data: UpdateResidentData): Promise<void> {
    await api.put(`/residents/${id}`, data);
  },

  async bulkImport(records: any[]) {
    const response = await api.post("/residents/import", { records });
    return response.data;
  },
};
