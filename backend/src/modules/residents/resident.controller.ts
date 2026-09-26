import type { Request, Response, NextFunction } from "express";
import { ResidentService } from "./resident.service.js";
import { FamilyService } from "../family/family.service.js";
import { HouseholdRepository } from "../households/household.repository.js";

export class ResidentController {
  static async checkDuplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, middleName, dob } = req.body;
      if (!firstName || !lastName || !dob) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }
      const isDuplicate = await ResidentService.checkDuplicate(firstName, lastName, middleName, dob);
      res.json({ success: true, isDuplicate });
    } catch (err) {
      next(err);
    }
  }

  static async createResident(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const residentId = await ResidentService.createResident(req.body, userId);

      // Resolve HouseholdID from req.body.householdId
      // The value could be a HouseholdID or a HouseID from HouseholdNumber
      let householdId: number | null = null;
      const rawHouseholdId = Number(req.body.householdId);
      if (Number.isInteger(rawHouseholdId) && rawHouseholdId > 0) {
        // First try as HouseholdID directly
        const direct = await HouseholdRepository.getHouseholdById(rawHouseholdId);
        if (direct) {
          householdId = direct.HouseholdID;
        } else {
          // Try as HouseID from HouseholdNumber
          householdId = await HouseholdRepository.findHouseholdIdByHouseId(rawHouseholdId);
        }
      }

      const householdRole =
        typeof req.body.householdRole === "string"
          ? req.body.householdRole.trim().toLowerCase()
          : "";

      if (
        householdRole === "head" &&
        householdId &&
        Number.isInteger(householdId) &&
        householdId > 0
      ) {
        // Create a family head with auto-generated label from last name
        const lastName =
          typeof req.body.lastName === "string"
            ? req.body.lastName.trim()
            : "";

        if (lastName) {
          await FamilyService.createFamilyHead(
            householdId,
            residentId,
            lastName,
            userId,
          );
        }
      } else if (
        householdRole === "member" &&
        householdId &&
        Number.isInteger(householdId) &&
        householdId > 0
      ) {
        // Link member under selected family head
        const familyHeadId = Number(req.body.householdHeadId);
        const familyRole =
          typeof req.body.familyRole === "string"
            ? req.body.familyRole.trim()
            : "Relative";

        if (Number.isInteger(familyHeadId) && familyHeadId > 0) {
          await FamilyService.addMemberToFamilyHead(
            familyHeadId,
            residentId,
            familyRole,
            userId,
          );
        }
      }

      res.status(201).json({
        success: true,
        data: { residentId },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAllResidents(
    _req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const residents = await ResidentService.getAllResidents();

      res.json({
        success: true,
        data: residents,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getResidentById(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const id = Number(req.params.id);
      const resident = await ResidentService.getResidentById(id);

      res.json({
        success: true,
        data: resident,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateResident(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const userId = req.user!.userId;

      await ResidentService.updateResident(id, req.body, userId);

      res.json({
        success: true,
        message: "Resident updated successfully!",
      });
    } catch (err) {
      next(err);
    }
  }

  static async searchResidents(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const results = await ResidentService.searchResidents(req.query);

      res.json({
        success: true,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }

    // NEW IMPORT FUNCTION
  static async importData(req: Request, res: Response, next: NextFunction) {
    try {
      const records = req.body.records;
      const userId = (req as any).user.userId;

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ success: false, message: "No records provided." });
      }

      let successCount = 0;
      
      // PASS 1: Create all Family Heads first
      const headRecords = records.filter(r => r.Family_Role === "PrimaryHead" || r.Family_Role === "FamilyHead");
      for (const row of headRecords) {
        const residentData = {
          firstName: row.First_Name,
          middleName: row.Middle_Name,
          lastName: row.Last_Name,
          suffix: row.Suffix,
          sex: row.Sex,
          dateOfBirth: row.Date_Of_Birth,
          placeOfBirth: row.Place_Of_Birth,
          civilStatus: row.Civil_Status,
          citizenship: row.Citizenship,
          religion: row.Religion,
          contactNumber: row.Contact_Number,
          email: row.Email,
          inhabitantType: row.Inhabitant_Type,
          // If they provide a Household Number, we need to map it to the database ID structure
          // Note: Because your architecture resolves Household IDs dynamically in the repository,
          // we pass the raw number string here and let your repository handle it!
          address: {
            houseNumber: row.Household_Number,
            street: row.Street_Name,
            unitRoomFloor: row.Unit_Room_Floor,
            buildingName: row.Building_Name,
            lotBlockPhase: row.Lot_Block_Phase,
          }
        };

        // Create the resident (your service handles the heavy lifting!)
        await ResidentService.createResident(residentData, userId);
        successCount++;
      }

      // (Note: PASS 2 for Members would go here, requiring a bit more logic to find the FamilyHeadID we just created)

      res.status(201).json({ 
        success: true, 
        message: `Successfully imported ${successCount} records.` 
      });
    } catch (error: any) {
      res.status(400).json({ 
        success: false, 
        message: `Import failed: ${error.message}. Please check your CSV data.` 
      });
    }
  }
}
