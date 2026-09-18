import { pool } from "../../config/database.js";

const toNumber = (value: unknown): number => {
    if (typeof value === "bigint") return Number(value);

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    if (typeof value === "number") return value;

    return 0;
}

export class DashboardRepository {
  // STAT CARDS - Matches the 6 StatCard components
  //Total active population
  static async getTotalPopulation(filterDate?: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as count FROM Resident WHERE ResidentStatus = 'Active'`,
      );
      return toNumber(rows[0]?.count);
    } finally {
      conn.release();
    }
  }

  //Registered voters (from Voter table joined with active residents)
  static async getRegisteredVoters(filterDate?: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as count FROM Voter v 
                JOIN Resident r ON v.ResidentID = r.ResidentID 
                WHERE r.ResidentStatus = 'Active'`,
      );
      return toNumber(rows[0]?.count);
    } finally {
      conn.release();
    }
  }

  //Gender count (Male/Female)
  static async getGenderCount(filterDate?: string): Promise<{ male: number; female: number }> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT Sex, COUNT(*) as count FROM Resident 
                WHERE ResidentStatus = 'Active' 
                GROUP BY Sex`,
      );
      let male = 0,
        female = 0;
      for (const row of rows) {
        if (row.Sex === "Male") male = toNumber(row.count);
        if (row.Sex === "Female") female = toNumber(row.count);
      }
      return { male, female };
    } finally {
      conn.release();
    }
  }

  //Total households
  static async getTotalHouseholds(filterDate?: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as count FROM Household ${filterDate ? 'WHERE CreatedAt <= LAST_DAY(CONCAT(?, \'-01\')) + INTERVAL 1 DAY - INTERVAL 1 SECOND' : ''}`,
        filterDate ? [filterDate] : []
      );
      return toNumber(rows[0]?.count);
    } finally {
      conn.release();
    }
  }

  //Total families (count of family heads)
  static async getTotalFamilies(filterDate?: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as count FROM FamilyHead ${filterDate ? 'WHERE CreatedAt <= LAST_DAY(CONCAT(?, \'-01\')) + INTERVAL 1 DAY - INTERVAL 1 SECOND' : ''}`,
        filterDate ? [filterDate] : []
      );
      return toNumber(rows[0]?.count);
    } finally {
      conn.release();
    }
  }

  // PIE CHART - "Resident Classification" categories
  //Age-based classifications (Children, Youth, Senior)
  static async getAgeClassification(filterDate?: string): Promise<{
    children: number;
    youth: number;
    seniorCitizen: number;
  }> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT 
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) < 15 THEN 1 ELSE 0 END) as children,
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 15 AND 30 THEN 1 ELSE 0 END) as youth,
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) >= 60 THEN 1 ELSE 0 END) as seniorCitizen
                FROM Resident
                WHERE ResidentStatus = 'Active'`,
      );
      return {
        children: toNumber(rows[0]?.children),
        youth: toNumber(rows[0]?.youth),
        seniorCitizen: toNumber(rows[0]?.seniorCitizen),
      };
    } finally {
      conn.release();
    }
  }

  //PWD count (from ResidentCategory + SpecialCategory)
  static async getPWDCount(filterDate?: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(DISTINCT rc.ResidentID) as count 
                FROM ResidentCategory rc
                JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                JOIN Resident r ON rc.ResidentID = r.ResidentID
                WHERE sc.CategoryName = 'PWD' AND r.ResidentStatus = 'Active'`,
      );
      return toNumber(rows[0]?.count);
    } finally {
      conn.release();
    }
  }

  //Employment count
  static async getEmploymentCount(filterDate?: string): Promise<{
    employed: number;
    unemployed: number;
  }> {
    const conn = await pool.getConnection();
    try {
      const employedRows = await conn.query(
        `SELECT COUNT(DISTINCT e.ResidentID) as count FROM Employment e JOIN Resident r ON e.ResidentID = r.ResidentID WHERE e.EmploymentStatus IN ('Employed', 'Self-Employed') AND r.ResidentStatus = 'Active'`,
      );
      const employed = toNumber(employedRows[0]?.count);

      const totalRows = await conn.query(
        `SELECT COUNT(*) as count FROM Resident WHERE ResidentStatus = 'Active'`,
      );
      const total = toNumber(totalRows[0]?.count);

      const unemployed = Math.max(0, total - employed);
      return { employed, unemployed };
    } finally {
      conn.release();
    }
  }

  // LOG CARDS - New, Moved Out, Deceased (Monthly/Yearly)
  // New residents this month/year (from AuditTrail CREATE_RESIDENT action)
  static async getNewResidents(): Promise<{ monthly: number; yearly: number }> {
    const conn = await pool.getConnection();
    try {
      const monthlyRows = await conn.query(
        `SELECT COUNT(*) as count
       FROM AuditTrail a
       WHERE a.Action = 'CREATE_RESIDENT'
       AND MONTH(a.Timestamp) = MONTH(CURDATE())
       AND YEAR(a.Timestamp) = YEAR(CURDATE())`,
      );

      const yearlyRows = await conn.query(
        `SELECT COUNT(*) as count
       FROM AuditTrail a
       WHERE a.Action = 'CREATE_RESIDENT'
       AND YEAR(a.Timestamp) = YEAR(CURDATE())`,
      );

      return {
        monthly: toNumber(monthlyRows[0]?.count),
        yearly: toNumber(yearlyRows[0]?.count),
      };
    } finally {
      conn.release();
    }
  }

  //Moved out residents this month/year
  static async getMovedOutResidents(): Promise<{
    monthly: number;
    yearly: number;
  }> {
    const conn = await pool.getConnection();
    try {
      const monthlyRows = await conn.query(
        `SELECT COUNT(*) as count FROM ResidentHistory 
                WHERE ChangeType = 'MovedOut' 
                AND MONTH(ChangeDate) = MONTH(CURDATE()) 
                AND YEAR(ChangeDate) = YEAR(CURDATE())`,
      );
      const yearlyRows = await conn.query(
        `SELECT COUNT(*) as count FROM ResidentHistory 
                WHERE ChangeType = 'MovedOut' 
                AND YEAR(ChangeDate) = YEAR(CURDATE())`,
      );
      return {
        monthly: toNumber(monthlyRows[0]?.count),
        yearly: toNumber(yearlyRows[0]?.count),
      };
    } finally {
      conn.release();
    }
  }

  //Deceased residents this month/year
  static async getDeceasedResidents(): Promise<{
    monthly: number;
    yearly: number;
  }> {
    const conn = await pool.getConnection();
    try {
      const monthlyRows = await conn.query(
        `SELECT COUNT(*) as count FROM Deceased 
                WHERE MONTH(DateofDeath) = MONTH(CURDATE()) 
                AND YEAR(DateofDeath) = YEAR(CURDATE())`,
      );
      const yearlyRows = await conn.query(
        `SELECT COUNT(*) as count FROM Deceased 
                WHERE YEAR(DateofDeath) = YEAR(CURDATE())`,
      );
      return {
        monthly: toNumber(monthlyRows[0]?.count),
        yearly: toNumber(yearlyRows[0]?.count),
      };
    } finally {
      conn.release();
    }
  }
}