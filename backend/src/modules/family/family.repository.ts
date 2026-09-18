import { pool } from "../../config/database.js";

export class FamilyRepository {
  static async getFamilyHeadById(familyHeadId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT FamilyHeadID, HouseholdID, ResidentID, HeadType, FamilyLabel
                 FROM FamilyHead
                 WHERE FamilyHeadID = ?
                 LIMIT 1`,
        [familyHeadId],
      );

      return rows[0] ?? null;
    } finally {
      conn.release();
    }
  }

  //Check if household already has a primary head
  static async getPrimaryHeadByHousehold(householdId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT * FROM FamilyHead WHERE HouseholdID = ? AND HeadType = 'Primary'`,
        [householdId],
      );

      return rows[0] ?? null;
    } finally {
      conn.release();
    }
  }

  static async getPrimaryHeadCount(householdId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) AS total
         FROM FamilyHead
         WHERE HouseholdID = ? AND HeadType = 'Primary'`,
        [householdId],
      );

      return Number(rows[0]?.total ?? 0);
    } finally {
      conn.release();
    }
  }

  static async getPrimaryHeadByResident(residentId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT FamilyHeadID, HouseholdID, ResidentID, HeadType, FamilyLabel
         FROM FamilyHead
         WHERE ResidentID = ? AND HeadType = 'Primary'
         LIMIT 1`,
        [residentId],
      );

      return rows[0] ?? null;
    } finally {
      conn.release();
    }
  }

  //Check if a resident is the primary household head
  static async isHouseholdHead(residentId: number): Promise<boolean> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT FamilyHeadID FROM FamilyHead WHERE ResidentID = ? AND HeadType = 'Primary'`,
        [residentId],
      );
      return rows.length > 0;
    } finally {
      conn.release();
    }
  }

  /**
   * Get all family heads for a specific household.
   * Used for generating family labels based on existing surnames.
   */
  static async getFamilyHeadsByHousehold(householdId: number): Promise<any[]> {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT
           fh.FamilyHeadID AS FamilyHeadID,
           r.ResidentID AS ResidentID,
           CONCAT_WS(' ', r.FirstName, r.MiddleName, r.LastName) AS Name,
           hh.HouseholdID AS HouseholdID,
           hn.HouseholdNumberName AS HouseholdNumber,
           hn.StreetName AS Street,
           fh.FamilyLabel AS FamilyLabel
         FROM FamilyHead fh
         JOIN Resident r ON r.ResidentID = fh.ResidentID
         JOIN Household hh ON hh.HouseholdID = fh.HouseholdID
         JOIN HouseholdNumber hn ON hn.HouseID = hh.HouseID
         WHERE fh.HouseholdID = ?
         ORDER BY fh.FamilyLabel`,
        [householdId],
      );
      return rows as any[];
    } finally {
      conn.release();
    }
  }

  //Assign a primary family head
  static async assignPrimaryHead(householdId: number, residentId: number) {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `INSERT INTO FamilyHead (HouseholdID, ResidentID, HeadType, FamilyLabel) VALUES (?, ?, 'Primary', ?)`,
        [householdId, residentId, null],
      );
    } finally {
      conn.release();
    }
  }

  static async assignPrimaryHeadWithLabel(
    householdId: number,
    residentId: number,
    familyLabel: string,
  ) {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `INSERT INTO FamilyHead (HouseholdID, ResidentID, HeadType, FamilyLabel) VALUES (?, ?, 'Primary', ?)`,
        [householdId, residentId, familyLabel],
      );
    } finally {
      conn.release();
    }
  }

  /**
   * Check if a resident already has a family membership.
   * Returns the FamilyHeadID if they are a HEAD or a MEMBER of any family.
   */
  static async getExistingMembership(residentId: number) {
    const conn = await pool.getConnection();
    try {
      const headRows = await conn.query(
        `SELECT FamilyHeadID, HouseholdID, FamilyLabel
         FROM FamilyHead
         WHERE ResidentID = ?
         LIMIT 1`,
        [residentId],
      );

      const memberRows = await conn.query(
        `SELECT f.FamilyID, f.FamilyHeadID, fh.FamilyLabel
         FROM Family f
         JOIN FamilyHead fh ON f.FamilyHeadID = fh.FamilyHeadID
         WHERE f.ResidentID = ?
         LIMIT 1`,
        [residentId],
      );

      return {
        isHead: headRows[0] ?? null,
        isMember: memberRows[0] ?? null,
      };
    } finally {
      conn.release();
    }
  }

  /**
   * Remove a resident from a specific family (Family table).
   */
  static async removeFamilyMembership(
    residentId: number,
    familyHeadId: number,
  ) {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `DELETE FROM Family WHERE ResidentID = ? AND FamilyHeadID = ?`,
        [residentId, familyHeadId],
      );
    } finally {
      conn.release();
    }
  }

  //Add family member
  static async addFamilyMember(
    familyHeadId: number,
    residentId: number,
    relationship: string,
  ) {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `INSERT INTO Family (FamilyHeadID, ResidentID, RelationshipToFamilyHead) VALUES (?, ?, ?)`,
        [familyHeadId, residentId, relationship],
      );
    } finally {
      conn.release();
    }
  }

  // Update family member relationship
  static async updateFamilyMemberRelationship(
    familyHeadId: number,
    residentId: number,
    relationship: string,
  ) {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `UPDATE Family SET RelationshipToFamilyHead = ? WHERE FamilyHeadID = ? AND ResidentID = ?`,
        [relationship, familyHeadId, residentId],
      );
    } finally {
      conn.release();
    }
  }

  //Get all family members of a household
  static async getFamilyByHousehold(householdId: number) {
    const conn = await pool.getConnection();
    try {
      return await conn.query(
        `SELECT
           fh.FamilyHeadID,
           fh.HeadType,
           fh.FamilyLabel,
           head.ResidentID,
           head.FirstName,
           head.LastName,
           head.DateOfBirth,
           NULL AS RelationshipToFamilyHead
         FROM FamilyHead fh
         JOIN Resident head ON fh.ResidentID = head.ResidentID
         WHERE fh.HouseholdID = ?

         UNION ALL

         SELECT
           fh.FamilyHeadID,
           fh.HeadType,
          fh.FamilyLabel,
           member.ResidentID,
           member.FirstName,
           member.LastName,
           member.DateOfBirth,
           f.RelationshipToFamilyHead
         FROM FamilyHead fh
         JOIN Family f ON fh.FamilyHeadID = f.FamilyHeadID
         JOIN Resident member ON f.ResidentID = member.ResidentID
         WHERE fh.HouseholdID = ?

         ORDER BY FamilyLabel ASC, FamilyHeadID ASC`,
        [householdId, householdId],
      );
    } finally {
      conn.release();
    }
  }

  //Get eligible next-oldest members (excluding current head)
  static async getEligibleNextOldestByFamilyHead(
    familyHeadId: number,
    currentHeadResidentId: number,
  ) {
    const conn = await pool.getConnection();
    try {
      return await conn.query(
        `SELECT r.ResidentID, r.DateOfBirth
         FROM Family f
         JOIN Resident r ON f.ResidentID = r.ResidentID
         WHERE f.FamilyHeadID = ?
           AND r.ResidentID != ?
           AND r.ResidentStatus = 'Active'
         ORDER BY r.DateOfBirth ASC`,
        [familyHeadId, currentHeadResidentId],
      );
    } finally {
      conn.release();
    }
  }

  //Replace family head for a single family group
  static async replaceFamilyHeadWithinGroup(
    familyHeadId: number,
    newResidentId: number,
  ) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const headRows = await conn.query(
        `SELECT ResidentID FROM FamilyHead WHERE FamilyHeadID = ? LIMIT 1`,
        [familyHeadId],
      );

      const currentHeadResidentId = Number(headRows[0]?.ResidentID ?? 0);

      // 1. Remove new head from Family table if they are a current member
      await conn.query(
        `DELETE FROM Family WHERE ResidentID = ? AND FamilyHeadID = ?`,
        [newResidentId, familyHeadId],
      );

      // 2. Update the family head to the new resident
      await conn.query(
        `UPDATE FamilyHead SET ResidentID = ? WHERE FamilyHeadID = ?`,
        [newResidentId, familyHeadId],
      );

      // 3. Demote the previous head into the family member list if needed
      if (currentHeadResidentId && currentHeadResidentId !== newResidentId) {
        await conn.query(
          `INSERT INTO Family (FamilyHeadID, ResidentID, RelationshipToFamilyHead)
           SELECT ?, ?, 'Relative'
           WHERE NOT EXISTS (
             SELECT 1 FROM Family WHERE FamilyHeadID = ? AND ResidentID = ?
           )`,
          [
            familyHeadId,
            currentHeadResidentId,
            familyHeadId,
            currentHeadResidentId,
          ],
        );
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async getPrimaryHeads() {
    const conn = await pool.getConnection();
    try {
      return await conn.query(
        `SELECT
           fh.FamilyHeadID,
           fh.HouseholdID,
           fh.ResidentID,
           fh.FamilyLabel,
           r.FirstName,
           r.LastName,
           hn.HouseholdNumberName AS HouseholdNumber,
           hn.StreetName AS Street_Alley_Zone,
           a.Unit_RoomNo_Floor,
           a.Building_Name,
           a.Lot_Block_Phase_Num,
           a.Barangay,
           a.Municipality
         FROM FamilyHead fh
         JOIN Resident r ON fh.ResidentID = r.ResidentID
         JOIN Household h ON fh.HouseholdID = h.HouseholdID
         JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
         LEFT JOIN Address a ON h.AddressID = a.AddressID
        WHERE fh.HeadType = 'Primary'
          AND r.ResidentStatus = 'Active'
         ORDER BY fh.HouseholdID, fh.FamilyLabel, fh.FamilyHeadID`,
      );
    } finally {
      conn.release();
    }
  }
}