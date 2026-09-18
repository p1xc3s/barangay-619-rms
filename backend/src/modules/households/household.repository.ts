import { pool } from "../../config/database.js";

const toNumber = (value: unknown): number => {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export class HouseholdRepository {
  static async createHousehold(data?: any) {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Find available household number
      const houseRows = await conn.query(
        `SELECT HouseID, StreetName FROM HouseholdNumber
         WHERE Status = 'Available'
         LIMIT 1`,
      );

      if (houseRows.length === 0) {
        throw new Error("No available household numbers!");
      }

      const houseId = houseRows[0].HouseID;

      // Create household with a NULL AddressID initially
      // The specific Address row will be created on-demand when a Resident is added
      const result = await conn.query(
        `INSERT INTO Household (HouseID, AddressID)
         VALUES (?, NULL)`,
        [houseId],
      );

      // Mark household number as assigned
      await conn.query(
        `UPDATE HouseholdNumber
       SET Status = 'Assigned'
       WHERE HouseID = ?`,
        [houseId],
      );

      await conn.commit();
      return Number(result.insertId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async updateHouseholdNumberStatus(
    houseId: number,
    status: "Available" | "Assigned" | "Inactive",
  ) {
    const conn = await pool.getConnection();
    try {
      const result = await conn.query(
        `UPDATE HouseholdNumber SET Status = ? WHERE HouseID = ?`,
        [status, houseId],
      );

      return result.affectedRows > 0;
    } finally {
      conn.release();
    }
  }

  static async updateHouseholdNumberName(
    houseId: number,
    newName: string,
  ) {
    const conn = await pool.getConnection();
    try {
      const result = await conn.query(
        `UPDATE HouseholdNumber SET HouseholdNumberName = ? WHERE HouseID = ?`,
        [newName, houseId],
      );

      return result.affectedRows > 0;
    } finally {
      conn.release();
    }
  }

  static async getHouseholdById(householdId: number) {
    const conn = await pool.getConnection();

    try {
      const householdRows = await conn.query(
        `SELECT 
                    h.HouseholdID,
                    hn.HouseholdNumberName AS householdNumber,
                    hn.Status AS householdStatus,
                    
                    a.AddressID,
                    a.HouseNumber,
                    a.Street_Alley_Zone,
                    a.Barangay,
                    a.Municipality
                FROM Household h
                JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
                JOIN Address a ON h.AddressID = a.AddressID
                WHERE h.HouseholdID = ?`,
        [householdId],
      );

      if (householdRows.length === 0) return null;

      const residents = await conn.query(
        `SELECT
                    r.ResidentID,
                    r.FirstName,
                    r.LastName,
                    r.Sex,
                    r.ResidentStatus
                FROM Resident r WHERE r.HouseholdID = ?`,
        [householdId],
      );

      const household = householdRows[0];

      return {
        ...household,
        HouseholdID: toNumber(household.HouseholdID),
        AddressID: toNumber(household.AddressID),
        residents: residents.map((resident: any) => ({
          ...resident,
          ResidentID: toNumber(resident.ResidentID),
        })),
      };
    } finally {
      conn.release();
    }
  }

  static async getAllHouseholds() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT
          h.HouseholdID,
          hn.HouseholdNumberName AS householdNumber,
          hn.Status AS householdStatus,
          
          a.HouseNumber,
          a.Street_Alley_Zone,
          a.Barangay,
          a.Unit_RoomNo_Floor,
          a.Building_Name,
          a.Lot_Block_Phase_Num,
          a.Municipality,
          (SELECT COUNT(*) FROM Resident r WHERE r.HouseholdID = h.HouseholdID AND r.ResidentStatus = 'Active')
            AS memberCount,
            (SELECT COUNT(*) FROM FamilyHead fh WHERE fh.HouseholdID = h.HouseholdID AND fh.HeadType = 'Primary')
            AS familyCount
            FROM Household h
          JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
          LEFT JOIN Address a ON h.AddressID = a.AddressID
          ORDER BY h.HouseholdID`,
      );

      return rows.map((row: any) => ({
        ...row,
        HouseholdID: toNumber(row.HouseholdID),
        memberCount: toNumber(row.memberCount),
        familyCount: toNumber(row.familyCount),
      }));
    } finally {
      conn.release();
    }
  }

  static async getAllHouseholdAddresses() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT AddressID, HouseNumber, Street_Alley_Zone, Barangay, Municipality
         FROM Address
         ORDER BY Street_Alley_Zone, HouseNumber, AddressID`,
      );

      return rows.map((row: any) => ({
        ...row,
        AddressID: toNumber(row.AddressID),
      }));
    } finally {
      conn.release();
    }
  }

  static async getAddressById(addressId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT AddressID, HouseNumber, Street_Alley_Zone, Barangay, Municipality
         FROM Address WHERE AddressID = ? LIMIT 1`,
        [addressId],
      );

      if (!rows || rows.length === 0) return null;
      const row: any = rows[0];
      return {
        ...row,
        AddressID: toNumber(row.AddressID),
      };
    } finally {
      conn.release();
    }
  }

  static async updateHousehold(
    householdId: number,
    data: { addressId?: number },
  ) {
    const conn = await pool.getConnection();
    try {
      if (data.addressId) {
        const result = await conn.query(
          `UPDATE Household SET AddressID = ? WHERE HouseholdID = ?`,
          [data.addressId, householdId],
        );
        return result.affectedRows > 0;
      }
      return false;
    } finally {
      conn.release();
    }
  }
  /**
   * Resolve a HouseID (from HouseholdNumber) to a HouseholdID.
   * If no Household row exists for the HouseID, create one automatically
   * using the address from the HouseholdNumber record.
   */
  static async resolveOrCreateHousehold(
    conn: Awaited<ReturnType<typeof pool.getConnection>>,
    houseId: number,
  ): Promise<number> {
    // Check if Household already exists for this HouseID
    const existing = await conn.query(
      `SELECT HouseholdID FROM Household WHERE HouseID = ? LIMIT 1`,
      [houseId],
    );

    if (existing.length > 0) {
      return toNumber(existing[0].HouseholdID);
    }

    // We no longer query the street or create the Address row here.
    // We just create the Household row with a NULL AddressID.
    // The Address row will be created when a Resident is added.
    const result = await conn.query(
      `INSERT INTO Household (HouseID, AddressID) VALUES (?, NULL)`,
      [houseId],
    );

    // Mark household number as Assigned
    await conn.query(
      `UPDATE HouseholdNumber SET Status = 'Assigned' WHERE HouseID = ? AND Status = 'Available'`,
      [houseId],
    );

    return toNumber(result.insertId);
  }

  /**
   * Find a HouseholdID by HouseID (from HouseholdNumber).
   * Returns null if no Household row exists.
   */
  static async findHouseholdIdByHouseId(
    houseId: number,
  ): Promise<number | null> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT HouseholdID FROM Household WHERE HouseID = ? LIMIT 1`,
        [houseId],
      );
      return rows.length > 0 ? toNumber(rows[0].HouseholdID) : null;
    } finally {
      conn.release();
    }
  }

  // HouseholdNumber methods
  static async getAllHouseholdNumbers() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT
          hn.HouseID,
          hn.HouseholdNumberName,
          hn.Status,
          hn.StreetName
         FROM HouseholdNumber hn
         ORDER BY hn.HouseID`,
      );
      return rows.map((row: any) => ({
        ...row,
        HouseID: toNumber(row.HouseID)
      }));
    } finally {
      conn.release();
    }
  }
  static async createHouseholdNumber(data: {
    householdNumberName: string;
    streetName: string;
  }) {
    const conn = await pool.getConnection();

    try {
      const result = await conn.query(
        `INSERT INTO HouseholdNumber (HouseholdNumberName, StreetName)
         VALUES (?, ?)`,
        [data.householdNumberName, data.streetName],
      );
      return Number(result.insertId);
    } catch (err: any) {
      if (err.errno === 1062) {
        throw { status: 409, message: "Household number already exists!" };
      }
      throw err;
    } finally {
      conn.release();
    }
  }
}
