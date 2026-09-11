import { HouseholdRepository } from "./household.repository.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

export class HouseholdService {
  static async createHousehold(data: any, userId: number) {
    const addressId = Number(data?.addressId);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      throw { status: 400, message: "Valid addressId is required!" };
    }

    let householdId: number;
    try {
      householdId = await HouseholdRepository.createHousehold({ addressId });
    } catch (error: any) {
      if (error?.errno === 1452 || error?.code === "ER_NO_REFERENCED_ROW_2") {
        throw { status: 400, message: "Invalid addressId!" };
      }

      throw error;
    }

    await AuditTrailRepository.log({
      userId,
      action: "CREATE_HOUSEHOLD",
      newValue: JSON.stringify({ householdId }),
    });

    return householdId;
  }

  static async updateHouseholdNumber(
    houseId: number,
    status: "Available" | "Assigned" | "Inactive",
    userId: number,
  ) {
    if (!["Available", "Assigned", "Inactive"].includes(status)) {
      throw { status: 400, message: "Invalid household status!" };
    }

    const updated = await HouseholdRepository.updateHouseholdNumberStatus(
      houseId,
      status,
    );

    if (!updated) {
      throw { status: 404, message: "Household number not found!" };
    }

    await AuditTrailRepository.log({
      userId,
      action: "UPDATE_HOUSEHOLD_STATUS",
      newValue: JSON.stringify({ houseId, status }),
    });

    return true;
  }

  static async getHouseholdById(householdId: number) {
    const household = await HouseholdRepository.getHouseholdById(householdId);

    if (!household) {
      throw { status: 404, message: "Household not found!" };
    }

    return household;
  }

  static async getAllHouseholds() {
    return HouseholdRepository.getAllHouseholds();
  }

  static async getAllHouseholdAddresses() {
    return HouseholdRepository.getAllHouseholdAddresses();
  }

  static async updateHousehold(householdId: number, data: any, userId: number) {
    const existing = await HouseholdRepository.getHouseholdById(householdId);
    if (!existing) {
      throw { status: 404, message: "Household not found!" };
    }
    const updated = await HouseholdRepository.updateHousehold(
      householdId,
      data,
    );
    if (!updated) {
      throw { status: 400, message: "No changes applied!" };
    }

    await AuditTrailRepository.log({
      userId,
      action: "UPDATE_HOUSEHOLD",
      oldValue: JSON.stringify({ "Address ID": existing.AddressID }),
      newValue: JSON.stringify({ "Address ID": data.addressId }),
    });

    return true;
  }

  static async getAllHouseholdNumbers() {
    return HouseholdRepository.getAllHouseholdNumbers();
  }

  static async renameHouseholdNumber(
    houseId: number,
    newName: string,
    userId: number,
  ) {
    if (!newName || !newName.trim()) {
      throw { status: 400, message: "Household number name is required!" };
    }

    const updated = await HouseholdRepository.updateHouseholdNumberName(
      houseId,
      newName.trim(),
    );

    if (!updated) {
      throw { status: 404, message: "Household number not found!" };
    }

    await AuditTrailRepository.log({
      userId,
      action: "UPDATE_HOUSEHOLD_NUMBER_NAME",
      newValue: JSON.stringify({ houseId, newName: newName.trim() }),
    });

    return true;
  }

  static async createHouseholdNumber(
    data: { householdNumberName: string; addressId?: number },
    userId: number,
  ) {
    if (!data.householdNumberName) {
      throw { status: 400, message: "Household number name is required!" };
    }

    const addressId = Number(data.addressId);
    if (!Number.isInteger(addressId) || addressId <= 0) {
      throw { status: 400, message: "Valid addressId is required!" };
    }

    // Validate that the address exists and belongs to allowed streets
    const allowedStreets = ["Batas", "Katwiran", "Lubiran"];
    const address = await HouseholdRepository.getAddressById(addressId);
    if (!address) {
      throw { status: 400, message: "Invalid addressId!" };
    }

    const street = (address.Street_Alley_Zone || "").trim();
    if (!allowedStreets.includes(street)) {
      throw {
        status: 400,
        message: "Selected street is not allowed for this barangay.",
      };
    }

    const houseId = await HouseholdRepository.createHouseholdNumber(data);
    await AuditTrailRepository.log({
      userId,
      action: "CREATE_HOUSEHOLD_NUMBER",
      newValue: JSON.stringify({ houseId, ...data }),
    });
    return houseId;
  }
}
