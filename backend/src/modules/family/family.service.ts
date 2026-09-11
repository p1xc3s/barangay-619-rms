import { FamilyRepository } from "./family.repository.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";
import { ResidentRepository } from "../residents/resident.repository.js";

export class FamilyService {
  private static getFamilyLabelFromIndex(index: number): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let value = Math.max(0, index);
    let label = "";

    do {
      label = letters[value % 26] + label;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);

    return `Family ${label}`;
  }

  //Assign initial household head
  static async assignHouseholdHead(
    householdId: number,
    residentId: number,
    userId: number,
  ) {
    if (!Number.isInteger(householdId) || householdId <= 0) {
      throw {
        status: 400,
        message: "Invalid household ID!",
      };
    }

    if (!Number.isInteger(residentId) || residentId <= 0) {
      throw {
        status: 400,
        message: "Invalid resident ID!",
      };
    }

    // Check if resident already belongs to a family
    const existingMembership =
      await FamilyRepository.getExistingMembership(residentId);
    if (existingMembership.isHead) {
      throw {
        status: 400,
        message: "Resident is already a family head!",
      };
    }
    if (existingMembership.isMember) {
      throw {
        status: 400,
        message:
          "Resident is already a member of another family. Remove them first before assigning as head.",
      };
    }

    const existingCount =
      await FamilyRepository.getPrimaryHeadCount(householdId);
    const familyLabel = FamilyService.getFamilyLabelFromIndex(existingCount);

    await FamilyRepository.assignPrimaryHeadWithLabel(
      householdId,
      residentId,
      familyLabel,
    );

    await AuditTrailRepository.log({
      userId,
      action: "ASSIGN_FAMILY_HEAD",
      newValue: JSON.stringify({ householdId, residentId }),
    });
  }

  //Add family member
  static async addFamilyMember(
    familyHeadId: number,
    residentId: number,
    relationship: string,
    userId: number,
  ) {
    if (!Number.isInteger(familyHeadId) || familyHeadId <= 0) {
      throw {
        status: 400,
        message: "Invalid family head ID!",
      };
    }

    if (!Number.isInteger(residentId) || residentId <= 0) {
      throw {
        status: 400,
        message: "Invalid resident ID!",
      };
    }

    const cleanedRelationship =
      typeof relationship === "string" ? relationship.trim() : "";

    if (!cleanedRelationship) {
      throw {
        status: 400,
        message: "Relationship to family head is required!",
      };
    }

    // Check if resident already belongs to a family
    const existing = await FamilyRepository.getExistingMembership(residentId);

    if (existing.isHead) {
      throw {
        status: 400,
        message:
          "Resident is already a family head and cannot be added as a member!",
      };
    }

    if (existing.isMember) {
      // If already a member of the SAME family head, update the relationship instead of rejecting duplicate
      if (Number(existing.isMember.FamilyHeadID) === familyHeadId) {
        await FamilyRepository.updateFamilyMemberRelationship(
          familyHeadId,
          residentId,
          cleanedRelationship,
        );

        const oldRelationship = existing.isMember.RelationshipToFamilyHead;

        await AuditTrailRepository.log({
          userId,
          action: "UPDATE_FAMILY_MEMBER_RELATIONSHIP",
          oldValue: JSON.stringify({ Relationship: oldRelationship }),
          newValue: JSON.stringify({ Relationship: cleanedRelationship }),
        });

        return; // Exit successfully after updating
      }

      // Remove from old family before adding to new one
      await FamilyRepository.removeFamilyMembership(
        residentId,
        Number(existing.isMember.FamilyHeadID),
      );
    }

    await FamilyRepository.addFamilyMember(
      familyHeadId,
      residentId,
      cleanedRelationship,
    );

    await AuditTrailRepository.log({
      userId,
      action: "ADD_FAMILY_MEMBER",
      newValue: JSON.stringify({
        familyHeadId,
        residentId,
        relationship: cleanedRelationship,
      }),
    });
  }

  //Change household head
  static async changeHouseholdHead(
    householdId: number,
    currentHeadId: number,
    userId: number,
  ) {
    if (!Number.isInteger(householdId) || householdId <= 0) {
      throw {
        status: 400,
        message: "Invalid household ID!",
      };
    }

    if (!Number.isInteger(currentHeadId) || currentHeadId <= 0) {
      throw {
        status: 400,
        message: "Invalid current head ID!",
      };
    }

    const currentHead = await FamilyRepository.getFamilyHeadById(currentHeadId);

    if (!currentHead || Number(currentHead.HouseholdID) !== householdId) {
      throw {
        status: 404,
        message: "Current household head not found!",
      };
    }

    const currentHeadResidentId = Number(currentHead.ResidentID);
    const eligible = await FamilyRepository.getEligibleNextOldestByFamilyHead(
      currentHeadId,
      currentHeadResidentId,
    );

    if (!eligible.length) {
      throw {
        status: 400,
        message: "No eligible next-oldest member found!",
      };
    }

    //Next oldest = first result (ordered by DOB ASC)
    const nextOldest = eligible[0];
    const nextOldestResidentId = Number(nextOldest.ResidentID);

    await FamilyRepository.replaceFamilyHeadWithinGroup(
      currentHeadId,
      nextOldestResidentId,
    );

    const oldHeadResident = await ResidentRepository.getResidentById(
      currentHeadResidentId,
    );
    const newHeadResident =
      await ResidentRepository.getResidentById(nextOldestResidentId);

    await AuditTrailRepository.log({
      userId,
      action: "CHANGE_FAMILY_HEAD",
      oldValue: JSON.stringify({
        "Family Head": `${oldHeadResident?.FirstName} ${oldHeadResident?.LastName}`,
      }),
      newValue: JSON.stringify({
        "Family Head": `${newHeadResident?.FirstName} ${newHeadResident?.LastName}`,
      }),
    });
  }

  //Demote a primary head and auto-assign next oldest member in the family group
  static async demoteHouseholdHead(residentId: number, userId: number) {
    if (!Number.isInteger(residentId) || residentId <= 0) {
      throw { status: 400, message: "Invalid resident ID!" };
    }

    const currentHead =
      await FamilyRepository.getPrimaryHeadByResident(residentId);

    if (!currentHead) {
      throw { status: 404, message: "Primary family head not found!" };
    }

    const familyHeadId = Number(currentHead.FamilyHeadID);
    const eligible = await FamilyRepository.getEligibleNextOldestByFamilyHead(
      familyHeadId,
      residentId,
    );

    if (!eligible.length) {
      throw {
        status: 400,
        message: "No eligible member found to assign as new head.",
      };
    }

    const nextOldest = eligible[0];
    const nextOldestResidentId = Number(nextOldest.ResidentID);

    await FamilyRepository.replaceFamilyHeadWithinGroup(
      familyHeadId,
      nextOldestResidentId,
    );

    const oldHeadResident =
      await ResidentRepository.getResidentById(residentId);
    const newHeadResident =
      await ResidentRepository.getResidentById(nextOldestResidentId);

    await AuditTrailRepository.log({
      userId,
      action: "DEMOTE_FAMILY_HEAD",
      oldValue: JSON.stringify({
        "Family Head": `${oldHeadResident?.FirstName} ${oldHeadResident?.LastName}`,
      }),
      newValue: JSON.stringify({
        "Family Head": `${newHeadResident?.FirstName} ${newHeadResident?.LastName}`,
      }),
    });
  }

  //View family by household
  static async getFamilyByHousehold(householdId: number) {
    return await FamilyRepository.getFamilyByHousehold(householdId);
  }

  //Ensure at least one primary head exists (legacy - kept for backward compatibility)
  static async ensurePrimaryHeadForHousehold(
    householdId: number,
    residentId: number,
    userId: number,
  ) {
    const existingHead =
      await FamilyRepository.getPrimaryHeadByHousehold(householdId);

    if (!existingHead) {
      await FamilyRepository.assignPrimaryHead(householdId, residentId);

      await AuditTrailRepository.log({
        userId,
        action: "AUTO_CREATE_FAMILY_HEAD",
        newValue: JSON.stringify({ householdId, residentId }),
      });
    }
  }

  /**
   * Create a family head for a resident in a household.
   * Auto-generates a family label from the resident's last name,
   * appending a number if duplicates exist (e.g. "Garcia Family", "Garcia Family 2").
   */
  static async createFamilyHead(
    householdId: number,
    residentId: number,
    lastName: string,
    userId: number,
  ) {
    // Check if resident already belongs to a family
    const existingMembership =
      await FamilyRepository.getExistingMembership(residentId);
    if (existingMembership.isHead) {
      throw {
        status: 400,
        message: "Resident is already a family head!",
      };
    }
    if (existingMembership.isMember) {
      throw {
        status: 400,
        message:
          "Resident is already a member of another family. Remove them first before creating as head.",
      };
    }

    // Get existing family heads for this household to check for duplicate surnames
    const existingHeads =
      await FamilyRepository.getFamilyHeadsByHousehold(householdId);

    const baseLabel = `${lastName} Family`;

    // Check how many existing labels match the base pattern
    const matchingLabels = existingHeads
      .map((h: any) => h.FamilyLabel as string)
      .filter((label: string) => {
        if (!label) return false;
        // Match "LastName Family" or "LastName Family N"
        return label === baseLabel || label.startsWith(`${baseLabel} `);
      });

    let familyLabel: string;

    if (matchingLabels.length === 0) {
      // First family with this surname
      familyLabel = baseLabel;
    } else if (
      matchingLabels.length === 1 &&
      matchingLabels.includes(baseLabel)
    ) {
      // There's already one "LastName Family", so this becomes "LastName Family 2"
      familyLabel = `${baseLabel} 2`;
    } else {
      // Find the highest number suffix
      const numbers = matchingLabels
        .map((label: string) => {
          if (label === baseLabel) return 1;
          const match = label.match(/\s(\d+)$/);
          return match && match[1] ? parseInt(match[1], 10) : 1;
        })
        .filter((n: number) => !isNaN(n));

      const maxNumber = Math.max(...numbers, 1);
      familyLabel = `${baseLabel} ${maxNumber + 1}`;
    }

    await FamilyRepository.assignPrimaryHeadWithLabel(
      householdId,
      residentId,
      familyLabel,
    );

    await AuditTrailRepository.log({
      userId,
      action: "CREATE_FAMILY_HEAD",
      newValue: JSON.stringify({ householdId, residentId, familyLabel }),
    });

    return familyLabel;
  }

  /**
   * Link a resident as a family member under an existing family head.
   */
  static async addMemberToFamilyHead(
    familyHeadId: number,
    residentId: number,
    relationship: string,
    userId: number,
  ) {
    // Verify the family head exists
    const head = await FamilyRepository.getFamilyHeadById(familyHeadId);
    if (!head) {
      throw { status: 404, message: "Family head not found!" };
    }

    // Check if resident already belongs to a family
    const existing = await FamilyRepository.getExistingMembership(residentId);

    if (existing.isHead) {
      throw {
        status: 400,
        message:
          "Resident is already a family head and cannot be added as a member!",
      };
    }

    if (existing.isMember) {
      // If already a member of the SAME family head, update the relationship instead of rejecting duplicate
      if (Number(existing.isMember.FamilyHeadID) === familyHeadId) {
        await FamilyRepository.updateFamilyMemberRelationship(
          familyHeadId,
          residentId,
          relationship,
        );

        await AuditTrailRepository.log({
          userId,
          action: "UPDATE_FAMILY_MEMBER_RELATIONSHIP",
          newValue: JSON.stringify({
            familyHeadId,
            residentId,
            relationship,
          }),
        });

        return; // Exit successfully after updating
      }

      // Remove from old family before adding to new one
      await FamilyRepository.removeFamilyMembership(
        residentId,
        Number(existing.isMember.FamilyHeadID),
      );
    }

    // Link the resident to the household
    await FamilyRepository.addFamilyMember(
      familyHeadId,
      residentId,
      relationship,
    );

    // Also update the resident's HouseholdID to match the family head's household
    const { pool } = await import("../../config/database.js");
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `UPDATE Resident SET HouseholdID = ? WHERE ResidentID = ? AND (HouseholdID IS NULL OR HouseholdID != ?)`,
        [head.HouseholdID, residentId, head.HouseholdID],
      );
    } finally {
      conn.release();
    }

    await AuditTrailRepository.log({
      userId,
      action: "ADD_FAMILY_MEMBER",
      newValue: JSON.stringify({
        familyHeadId,
        residentId,
        relationship,
      }),
    });
  }

  /**
   * Try to assign a resident as the primary head of a household.
   * Returns true if assigned, false if the household already has a primary head.
   */
  static async tryAssignPrimaryHead(
    householdId: number,
    residentId: number,
    userId: number,
  ) {
    if (!Number.isInteger(householdId) || householdId <= 0) {
      throw {
        status: 400,
        message: "Invalid household ID!",
      };
    }

    if (!Number.isInteger(residentId) || residentId <= 0) {
      throw {
        status: 400,
        message: "Invalid resident ID!",
      };
    }

    // Check if resident already belongs to a family
    const existingMembership =
      await FamilyRepository.getExistingMembership(residentId);
    if (existingMembership.isHead || existingMembership.isMember) {
      return false;
    }

    const existingCount =
      await FamilyRepository.getPrimaryHeadCount(householdId);
    if (existingCount > 0) {
      return false;
    }

    const familyLabel = FamilyService.getFamilyLabelFromIndex(existingCount);
    await FamilyRepository.assignPrimaryHeadWithLabel(
      householdId,
      residentId,
      familyLabel,
    );

    await AuditTrailRepository.log({
      userId,
      action: "ASSIGN_FAMILY_HEAD",
      newValue: JSON.stringify({ householdId, residentId }),
    });

    return true;
  }

  static async getPrimaryHeads() {
    return await FamilyRepository.getPrimaryHeads();
  }
}
