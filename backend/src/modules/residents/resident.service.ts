import { ResidentRepository } from "./resident.repository.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

const isNonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const isValidOccupancyStatus = (value: unknown): boolean =>
  typeof value === "string" &&
  ["Owner", "Renter", "Sharer", "Boarder"].includes(value.trim());

export class ResidentService {
  static async checkDuplicate(firstName: string, lastName: string, middleName: string | undefined, dob: string): Promise<boolean> {
    return ResidentRepository.checkIfDuplicate(firstName, lastName, middleName, dob);
  }

  static async createResident(data: any, userId: number) {
    //Resident data validation
    if (!data.firstName || !data.lastName || !data.sex) {
      throw { status: 400, message: "Missing required resident fields!" };
    }

    if (data.dob) {
      const isDuplicate = await ResidentService.checkDuplicate(data.firstName, data.lastName, data.middleName, data.dob);
      if (isDuplicate) {
        throw { status: 400, message: "A resident with the same First Name, Last Name, and Date of Birth is already registered." };
      }
    }

    const address =
      typeof data.address === "object" && data.address !== null
        ? (data.address as Record<string, unknown>)
        : null;

    if (!address) {
      throw {
        status: 400,
        message: "Address details are required!",
      };
    }

    const hasCompleteAddress =
      isNonEmptyString(address.houseNumber) &&
      isNonEmptyString(address.street) &&
      isNonEmptyString(address.barangay) &&
      isNonEmptyString(address.municipality);

    if (!hasCompleteAddress) {
      throw {
        status: 400,
        message:
          "Address fields houseNumber, street, barangay, and municipality are required!",
      };
    }

    if (
      data.householdId !== undefined &&
      data.householdId !== null &&
      data.householdId !== ""
    ) {
      const householdId = toPositiveInteger(data.householdId);

      if (!householdId) {
        throw {
          status: 400,
          message: "Invalid household ID!",
        };
      }

      data.householdId = householdId;
    }

    if (
      data.occupancyStatus !== undefined &&
      data.occupancyStatus !== null &&
      data.occupancyStatus !== "" &&
      !isValidOccupancyStatus(data.occupancyStatus)
    ) {
      throw {
        status: 400,
        message: "Invalid occupancy status!",
      };
    }

    //Duplicate resident validation
    if (data.dateOfBirth) {
      const duplicate = await ResidentRepository.findDuplicate(
        data.firstName,
        data.lastName,
        data.dateOfBirth,
      );

      if (duplicate) {
        throw {
          status: 409,
          message: `Duplicate resident found: ${duplicate.FirstName} ${duplicate.LastName} (ID: ${duplicate.ResidentID}, Status: ${duplicate.ResidentStatus})`,
        };
      }
    }

    let residentId: number;
    try {
      residentId = await ResidentRepository.createResident(data);
    } catch (error: any) {
      if (error?.errno === 1452 || error?.code === "ER_NO_REFERENCED_ROW_2") {
        throw {
          status: 400,
          message: "Invalid household ID!",
        };
      }

      throw error;
    }

    //Audit Log
    await AuditTrailRepository.log({
      userId,
      action: "CREATE_RESIDENT",
      newValue: JSON.stringify({
        residentId,
        name: `${data.firstName} ${data.lastName}`,
      }),
    });

    return residentId;
  }

  static async getAllResidents() {
    return ResidentRepository.getAllResidents();
  }

  static async getResidentById(id: number) {
    const resident = await ResidentRepository.getResidentById(id);

    if (!resident) {
      throw { status: 404, message: "Resident not found!" };
    }

    return resident;
  }

  static async updateResident(id: number, data: any, userId: number) {
    const existing = await ResidentRepository.getResidentById(id);

    if (!existing) {
      throw { status: 404, message: "Resident not found!" };
    }

    // ! Example Rule
    if (
      data.residentStatus &&
      !["Active", "MovedOut", "Deceased"].includes(data.residentStatus)
    ) {
      throw { status: 400, message: "Invalid resident status!" };
    }

    if (
      data.occupancyStatus !== undefined &&
      data.occupancyStatus !== null &&
      data.occupancyStatus !== "" &&
      !isValidOccupancyStatus(data.occupancyStatus)
    ) {
      throw { status: 400, message: "Invalid occupancy status!" };
    }

    const updated = await ResidentRepository.updateResident(id, data);

    if (!updated) {
      throw { status: 400, message: "No changes applied!" };
    }

        // Standardize both payloads to have identical, human-readable keys
    const mapToReadable = (res: any) => ({
      "First Name": res.FirstName || res.firstName,
      "Middle Name": res.MiddleName || res.middleName,
      "Last Name": res.LastName || res.lastName,
      "Sex": res.Sex || res.sex,
      "Date of Birth": res.DateOfBirth || res.dateOfBirth,
      "Place of Birth": res.PlaceOfBirth || res.placeOfBirth,
      "Civil Status": res.CivilStatus || res.civilStatus,
      "Citizenship": res.Citizenship || res.citizenship,
      "Religion": res.Religion || res.religion,
      "Contact Number": res.RContactNumber || res.rContactNumber || res.contactNumber,
      "Email": res.REmail || res.rEmail || res.email,
      "Resident Status": res.ResidentStatus || res.residentStatus,
      "Inhabitant Type": res.InhabitantType || res.inhabitantType,
      "Occupancy Status": res.OccupancyStatus || res.occupancyStatus,
    });

    await AuditTrailRepository.log({
      userId,
      action: "UPDATE_RESIDENT",
      oldValue: JSON.stringify(mapToReadable(existing)),
      newValue: JSON.stringify(mapToReadable(data)),
    });

    return true;
  }

  static async searchResidents(filters: any) {
    if (!filters || Object.keys(filters).length === 0) {
      throw { status: 400, message: "Search filters required!" };
    }

    return ResidentRepository.searchResidents(filters);
  }
}
