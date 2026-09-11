import { ResidentArchiveRepository } from "./residentArchive.repository.js";
import { ResidentRepository } from "./resident.repository.js";
import { FamilyRepository } from "../family/family.repository.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

export class ResidentArchiveService {
  //Archive resident (Deceased or Moved Out)
  static async archiveResident(
    residentId: number,
    status: "Deceased" | "MovedOut",
    dateOfDeath: string | null,
    userId: number,
  ) {
    //Validate resident existence
    const resident = await ResidentRepository.getResidentById(residentId);
    if (!resident) {
      throw { status: 404, message: "Resident not found!" };
    }

    //Validate status
    if (!["Deceased", "MovedOut"].includes(status)) {
      throw { status: 400, message: "Invalid archive status!" };
    }

    //FR14: Prevent archiving household head - must reassign first
    const isHead = await FamilyRepository.isHouseholdHead(residentId);
    if (isHead) {
      throw {
        status: 400,
        message: "Cannot archive household head! Please reassign head first.",
      };
    }

    //Validate dateOfDeath is required for Deceased
    if (status === "Deceased" && !dateOfDeath) {
      throw {
        status: 400,
        message: "Date of death is required for deceased status!",
      };
    }

    //Perform archive
    await ResidentArchiveRepository.archiveResident(
      residentId,
      status,
      dateOfDeath,
      userId,
    );

    //Audit log
    await AuditTrailRepository.log({
      userId,
      action: "ARCHIVE_RESIDENT",
      oldValue: JSON.stringify({
        "Resident Name": `${resident.FirstName} ${resident.LastName}`,
        Status: "Active",
        "Date of Death": "-",
      }),
      newValue: JSON.stringify({
        "Resident Name": `${resident.FirstName} ${resident.LastName}`,
        Status: status,
        "Date of Death": dateOfDeath || "-",
      }),
    });

    return { success: true, message: `Resident archived as ${status}` };
  }

  //Restore archived resident back to Active
  static async restoreResident(residentId: number, userId: number) {
    //Validate resident existence
    const resident = await ResidentRepository.getResidentById(residentId);
    if (!resident) {
      throw { status: 404, message: "Resident not found!" };
    }

    //Only allow restoring archived residents
    if (resident.ResidentStatus === "Active") {
      throw { status: 400, message: "Resident is already active!" };
    }

    //Perform restore
    await ResidentArchiveRepository.restoreResident(residentId, userId);

    //Audit log
    await AuditTrailRepository.log({
      userId,
      action: "RESTORE_RESIDENT",
      oldValue: JSON.stringify({
        "Resident Name": `${resident.FirstName} ${resident.LastName}`,
        Status: resident.ResidentStatus,
      }),
      newValue: JSON.stringify({
        "Resident Name": `${resident.FirstName} ${resident.LastName}`,
        Status: "Active",
      }),
    });

    return { success: true, message: "Resident restored to Active" };
  }

  //Get all archived residents
  static async getArchivedResidents() {
    return ResidentRepository.getArchivedResidents();
  }

  static async getResidentHistory(residentId: number) {
    const resident = await ResidentRepository.getResidentById(residentId);

    if (!resident) {
      throw { status: 404, message: "Resident not found!" };
    }

    return ResidentArchiveRepository.getResidentHistory(residentId);
  }
}
