import type { LucideIcon } from "lucide-react";

// ==========================================
// API Response Wrapper
// ==========================================
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ==========================================
// Auth
// ==========================================
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface AuthUser {
  userId: number;
  role: "Admin" | "Staff";
}

// ==========================================
// User Account
// ==========================================
export interface User {
  UserID: number;
  Username: string;
  Role: "Admin" | "Staff";
  Status: "Active" | "Inactive";
  CreatedAt?: string;
}

// ==========================================
// Resident
// ==========================================
export interface Resident {
  ResidentID: number;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
  Suffix?: string;
  Sex: "Male" | "Female";
  DateOfBirth: string;
  PlaceOfBirth?: string;
  CivilStatus: string;
  Citizenship: string;
  Religion?: string;
  RContactNumber?: string;
  REmail?: string;
  InhabitantType?: string;
  ResidentStatus: "Active" | "Deceased" | "MovedOut";
  Mothers_Maiden_Surname?: string;
  Mothers_Maiden_FirstName?: string;
  Mothers_Maiden_MiddleName?: string;
  HouseholdID?: number;
  householdId?: number;
  HouseholdNumber?: string | null;
  UnitRoomFloor?: string | null;
  BuildingName?: string | null;
  LotBlockPhase?: string | null;
  HouseNumber?: string | null;
  Street?: string | null;
  Barangay?: string | null;
  Municipality?: string | null;
  HouseholdRole?: "head" | "member" | null;
  HouseholdHeadName?: string | null;
  OccupancyStatus?: "Owner" | "Renter" | "Sharer" | "Boarder" | null;
  Categories?: string | null;
  EducationLevel?: string | null;
  EducationStatus?: string | null;
  Occupation?: string | null;
  EmploymentStatus?: string | null;
  PrecinctNumber?: string | null;
  VoterID?: string | null;
}

// Slim version returned by getAllResidents
export interface ResidentListItem {
  ResidentID: number;
  FirstName: string;
  LastName: string;
  Sex: string;
  DateOfBirth?: string;
  CivilStatus?: string;
  ResidentStatus: string;
  HouseholdID?: number;
  Categories?: string | null;
}

export interface CreateResidentData {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  sex: string;
  dateOfBirth: string;
  placeOfBirth: string;
  civilStatus: string;
  citizenship: string;
  religion?: string;
  contactNumber?: string;
  email?: string;
  inhabitantType: string;
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
  householdHeadId?: string;
  familyRole?: string;
  address: {
    unitRoomFloor?: string;
    buildingName?: string;
    lotBlockPhase?: string;
    houseNumber: string;
    street: string;
    barangay: string;
    municipality: string;
  };
}

// ==========================================
// Household & Family
// ==========================================

/** Shape returned by GET /api/households */
export interface HouseholdListItem {
  HouseholdID: number;
  householdNumber: string;
  householdStatus: string;
  HouseNumber?: string;
  Street_Alley_Zone?: string;
  Barangay?: string;
  Unit_RoomNo_Floor?: string;
  Building_Name?: string;
  Lot_Block_Phase_Num?: string;
  Municipality?: string;
  memberCount: number;
  familyCount: number;
}

/** Shape returned by GET /api/households/:id */
export interface HouseholdDetail {
  HouseholdID: number;
  householdNumber: string;
  householdStatus: string;
  AddressID: number;
  HouseNumber: string;
  Street_Alley_Zone: string;
  Barangay: string;
  Municipality: string;
  residents: {
    ResidentID: number;
    FirstName: string;
    LastName: string;
    Sex: string;
    ResidentStatus: string;
  }[];
}

export interface HouseholdNumber {
  HouseID: number;
  HouseholdNumberName: string;
  Status: string;
  StreetName?: string | null;
}

export interface HouseholdAddressOption {
  AddressID: number;
  HouseNumber: string;
  Street_Alley_Zone: string;
  Barangay: string;
  Municipality: string;
}

/** Shape returned by GET /api/families/household/:id */
export interface FamilyRecord {
  FamilyHeadID: number;
  HeadType: "Primary" | "Secondary";
  FamilyLabel?: string | null;
  ResidentID: number;
  FirstName: string;
  LastName: string;
  DateOfBirth: string;
  RelationshipToFamilyHead: string | null;
}

export interface FamilyHeadOption {
  id: string;
  name: string;
  householdId: number;
  householdNumber: string;
  street: string;
  unitRoom?: string;
  building?: string;
  lotBlock?: string;
  barangay?: string;
  city?: string;
  familyLabel: string;
}

// Keep backward-compat alias
export interface Household {
  HouseholdID: number;
  HouseholdNumber?: string;
  Address?: string;
  Status?: string;
}

export interface Family {
  FamilyID: number;
  HouseholdID: number;
  HeadResidentID: number;
  HeadName?: string;
  Members?: FamilyMember[];
}

export interface FamilyMember {
  ResidentID: number;
  FirstName: string;
  LastName: string;
  Relationship: string;
}

// ==========================================
// Officials
// ==========================================
export interface Official {
  OfficialID: number;
  ResidentID?: number;
  FirstName: string;
  LastName: string;
  Position: string;
  TermStart?: string;
  TermEnd?: string | null;
  BStatus?: "Active" | "Former";
}

// ==========================================
// Barangay Info
// ==========================================
export interface BarangayInfo {
  InfoID: number;
  BarangayName: string;
  Municipality: string;
  Province: string;
  Region: string;
  ZipCode: string;
  ContactNumber?: string;
  Email?: string;
  Logo?: string;
}

// ==========================================
// Audit Trail
// ==========================================
export interface AuditLog {
  LogID: number;
  UserID: number;
  Username?: string;
  Action: string;
  OldValue?: string;
  NewValue?: string;
  Timestamp: string;
}

export interface AuditPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==========================================
// Backup & Restore
// ==========================================
export interface BackupLog {
  BackupID: number;
  FileName: string;
  FilePath: string;
  DateCreated: string;
  BackupStatus: "Successful" | "Failed" | "Pending";
  BackupType: string;
}

// ==========================================
// Dashboard
// ==========================================
export interface DashboardStats {
  stats: {
    totalPopulation: number;
    registeredVoters: number;
    male: number;
    female: number;
    totalHouseholds: number;
    totalFamilies: number;
  };
  classification: {
    children: number;
    youth: number;
    seniorCitizen: number;
    pwd: number;
    employed: number;
    unemployed: number;
  };
  logs: {
    newResidents: { monthly: number; yearly: number };
    movedOut: { monthly: number; yearly: number };
    deceased: { monthly: number; yearly: number };
  };
}

// ==========================================
// Reports
// ==========================================
export interface ReportDemographicsSummary {
  stats: {
    inhabitants: number;
    households: number;
    families: number;
    voters: number;
    seniors: number;
    pwd: number;
    soloParent: number;
    indigent: number;
  };
  charts: {
    ageGroups: Array<{
      name: string;
      value: number;
    }>;
    employment: Array<{
      name: string;
      value: number;
      color: string;
    }>;
  };
}

export interface ReportDemographicsResident {
  ResidentID: number;
  LastName: string;
  FirstName: string;
  MiddleName?: string | null;
  Age: number;
  Sex: string;
  CivilStatus: string;
  Citizenship: string;
  Household?: string | null;
  Street?: string | null;
}

export interface ReportDemographicsCategoryResponse {
  data: ReportDemographicsResident[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportFormARecord {
  LastName: string;
  FirstName: string;
  MiddleName?: string | null;
  Suffix?: string | null;
  PlaceOfBirth?: string | null;
  DateOfBirth?: string | null;
  Age: number;
  Sex: string;
  CivilStatus: string;
  Citizenship: string;
  Occupation?: string | null;
  Household?: string | null;
  Street?: string | null;
  Barangay?: string | null;
  Categories?: string | null;
}

export type ReportFormAExportFormat = "csv" | "xlsx" | "pdf";

export interface ReportFormAPreviewResponse {
  data: ReportFormARecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportFormCAgeBracket {
  bracket: string;
  male: number;
  female: number;
  total: number;
}

export interface ReportFormCSector {
  sector: string;
  male: number;
  female: number;
  total: number;
}

export interface ReportFormCGroupedCount {
  status?: string;
  citizenship?: string;
  Sex: string;
  total: number;
}

export interface ReportFormCData {
  ageBrackets: ReportFormCAgeBracket[];
  sectors: ReportFormCSector[];
  civilStatus: ReportFormCGroupedCount[];
  citizenship: ReportFormCGroupedCount[];
  summary: {
    totalInhabitants: number;
    totalHouseholds: number;
    totalFamilies: number;
  };
}

// ==========================================
// UI-specific types (used by components)
// ==========================================
export interface StatData {
  id: string;
  title: string;
  value: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}

export interface ChartData {
  name: string;
  value: number;
  color: string;
}

// ==========================================
// Archive
// ==========================================
export interface ArchivedResident {
  ResidentID: number;
  FirstName: string;
  LastName: string;
  Sex: string;
  ResidentStatus: string;
  DateofDeath?: string | null;
  DateArchived?: string | null;
}

export interface ResidentHistoryEntry {
  HistoryID: number;
  ChangeType: string;
  ChangeDate: string;
  PreviousHouseholdID?: number | null;
  NewHouseholdID?: number | null;
  changedBy?: string | null;
}
