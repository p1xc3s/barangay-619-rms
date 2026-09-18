import { pool } from "../../config/database.js";

const toNumber = (value: unknown): number => {
  if (typeof value === "bigint") return Number(value);

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "number") return value;

  return 0;
};

export interface FormADataQueryOptions {
  householdId?: number;
  page?: number;
  limit?: number;
  disablePagination?: boolean;
}

export interface FormADataResult {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ReportRepository {
  //  DEMOGRAPHICS - Summary counts (UC8)
  //Total active inhabitants
  static async getTotalInhabitants(): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as total FROM Resident WHERE ResidentStatus = 'Active'`,
      );
      return Number(rows[0].total);
    } finally {
      conn.release();
    }
  }

  //Total households
  static async getTotalHouseholds(): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(`SELECT COUNT(*) as total FROM Household`);
      return Number(rows[0].total);
    } finally {
      conn.release();
    }
  }

  //Total families (family heads)
  static async getTotalFamilies(): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(`SELECT COUNT(*) as total FROM FamilyHead`);
      return Number(rows[0].total);
    } finally {
      conn.release();
    }
  }

  //Registered voters
  static async getRegisteredVoters(): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as total FROM Voter v
                JOIN Resident r ON v.ResidentID = r.ResidentID
                WHERE r.ResidentStatus = 'Active'`,
      );
      return Number(rows[0].total);
    } finally {
      conn.release();
    }
  }

  //Senior citizens (age >= 60)
  static async getSeniorCitizens(): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as total FROM Resident
                WHERE ResidentStatus = 'Active'
                AND TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) >= 60`,
      );
      return Number(rows[0].total);
    } finally {
      conn.release();
    }
  }

  //Category count (PWD, Solo Parent, Indigent, etc.)
  static async getCategoryCount(categoryName: string): Promise<number> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT COUNT(*) as total FROM ResidentCategory rc
                JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                JOIN Resident r ON rc.ResidentID = r.ResidentID
                WHERE sc.CategoryName = ? AND r.ResidentStatus = 'Active'`,
        [categoryName],
      );
      return Number(rows[0].total);
    } finally {
      conn.release();
    }
  }

  // ═══════════════════════════════════════════
  //  DEMOGRAPHICS - Chart data
  // ═══════════════════════════════════════════

  //Age group distribution (for bar chart)
  static async getAgeGroupDistribution() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 0 AND 14 THEN 1 ELSE 0 END) as '0-14',
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 15 AND 24 THEN 1 ELSE 0 END) as '15-24',
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 25 AND 64 THEN 1 ELSE 0 END) as '25-64',
                    SUM(CASE WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) >= 65 THEN 1 ELSE 0 END) as '65+'
                FROM Resident WHERE ResidentStatus = 'Active'`,
      );
      const row = rows[0];
      return [
        { name: "0-14", value: Number(row["0-14"]) },
        { name: "15-24", value: Number(row["15-24"]) },
        { name: "25-64", value: Number(row["25-64"]) },
        { name: "65+", value: Number(row["65+"]) },
      ];
    } finally {
      conn.release();
    }
  }

  //Employment breakdown (for horizontal bar chart)
  static async getEmploymentBreakdown() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT
                    COALESCE(e.EmploymentStatus, 'Unemployed') as status,
                    COUNT(*) as total
                FROM Resident r
                LEFT JOIN Employment e ON r.ResidentID = e.ResidentID
                WHERE r.ResidentStatus = 'Active'
                GROUP BY COALESCE(e.EmploymentStatus, 'Unemployed')`,
      );
      const colorMap: Record<string, string> = {
        Employed: "#3b82f6",
        "Self-Employed": "#10b981",
        Retired: "#f59e0b",
        Unemployed: "#64748b",
      };
      return rows.map((row: any) => ({
        name: row.status,
        value: Number(row.total),
        color: colorMap[row.status] || "#8b5cf6",
      }));
    } finally {
      conn.release();
    }
  }

  // ═══════════════════════════════════════════
  //  DEMOGRAPHICS - Detailed resident lists
  // ═══════════════════════════════════════════

  //Get residents by category with pagination + search
  static async getResidentsByCategory(
    category: string,
    search: string,
    page: number,
    limit: number,
  ) {
    const conn = await pool.getConnection();
    try {
      let baseQuery = "";
      let countQuery = "";
      const params: any[] = [];
      const countParams: any[] = [];

      const searchClause = search
        ? `AND (r.FirstName LIKE ? OR r.LastName LIKE ? OR hn.HouseholdNumberName LIKE ?)`
        : "";
      const searchParams = search
        ? [`%${search}%`, `%${search}%`, `%${search}%`]
        : [];

      const selectFields = `r.ResidentID, r.LastName, r.FirstName, r.MiddleName,
                TIMESTAMPDIFF(YEAR, r.DateOfBirth, CURDATE()) as Age,
                r.Sex, r.CivilStatus, r.Citizenship,
                hn.HouseholdNumberName as Household,
                hn.StreetName as Street`;

      const baseJoins = `FROM Resident r
                LEFT JOIN Household h ON r.HouseholdID = h.HouseholdID
                LEFT JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
                LEFT JOIN Address a ON h.AddressID = a.AddressID`;

      switch (category) {
        case "inhabitants":
          baseQuery = `SELECT ${selectFields} ${baseJoins}
                        WHERE r.ResidentStatus = 'Active' ${searchClause}`;
          countQuery = `SELECT COUNT(*) as total ${baseJoins}
                        WHERE r.ResidentStatus = 'Active' ${searchClause}`;
          params.push(...searchParams);
          countParams.push(...searchParams);
          break;

        case "household":
          baseQuery = `SELECT ${selectFields} ${baseJoins}
                        WHERE r.ResidentStatus = 'Active' AND r.HouseholdID IS NOT NULL ${searchClause}`;
          countQuery = `SELECT COUNT(*) as total ${baseJoins}
                        WHERE r.ResidentStatus = 'Active' AND r.HouseholdID IS NOT NULL ${searchClause}`;
          params.push(...searchParams);
          countParams.push(...searchParams);
          break;

        case "families":
          baseQuery = `SELECT ${selectFields} ${baseJoins}
                        JOIN FamilyHead fh ON r.ResidentID = fh.ResidentID
                        WHERE r.ResidentStatus = 'Active' ${searchClause}`;
          countQuery = `SELECT COUNT(*) as total ${baseJoins}
                        JOIN FamilyHead fh ON r.ResidentID = fh.ResidentID
                        WHERE r.ResidentStatus = 'Active' ${searchClause}`;
          params.push(...searchParams);
          countParams.push(...searchParams);
          break;

        case "voters":
          baseQuery = `SELECT ${selectFields} ${baseJoins}
                        JOIN Voter v ON r.ResidentID = v.ResidentID
                        WHERE r.ResidentStatus = 'Active' ${searchClause}`;
          countQuery = `SELECT COUNT(*) as total ${baseJoins}
                        JOIN Voter v ON r.ResidentID = v.ResidentID
                        WHERE r.ResidentStatus = 'Active' ${searchClause}`;
          params.push(...searchParams);
          countParams.push(...searchParams);
          break;

        case "seniors":
          baseQuery = `SELECT ${selectFields} ${baseJoins}
                        WHERE r.ResidentStatus = 'Active'
                        AND TIMESTAMPDIFF(YEAR, r.DateOfBirth, CURDATE()) >= 60 ${searchClause}`;
          countQuery = `SELECT COUNT(*) as total ${baseJoins}
                        WHERE r.ResidentStatus = 'Active'
                        AND TIMESTAMPDIFF(YEAR, r.DateOfBirth, CURDATE()) >= 60 ${searchClause}`;
          params.push(...searchParams);
          countParams.push(...searchParams);
          break;

        case "pwd":
        case "solo":
        case "indigent": {
          const catMap: Record<string, string> = {
            pwd: "PWD",
            solo: "Solo Parent",
            indigent: "4Ps",
          };
          baseQuery = `SELECT ${selectFields} ${baseJoins}
                        JOIN ResidentCategory rc ON r.ResidentID = rc.ResidentID
                        JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                        WHERE r.ResidentStatus = 'Active' AND sc.CategoryName = ? ${searchClause}`;
          countQuery = `SELECT COUNT(*) as total ${baseJoins}
                        JOIN ResidentCategory rc ON r.ResidentID = rc.ResidentID
                        JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                        WHERE r.ResidentStatus = 'Active' AND sc.CategoryName = ? ${searchClause}`;
          params.push(catMap[category], ...searchParams);
          countParams.push(catMap[category], ...searchParams);
          break;
        }

        default:
          throw { status: 400, message: `Invalid category: ${category}` };
      }

      //Add pagination
      const safePage = page > 0 ? page : 1;
      const safeLimit = limit > 0 ? limit : 10;
      const offset = (safePage - 1) * safeLimit;
      baseQuery += ` ORDER BY r.LastName, r.FirstName LIMIT ? OFFSET ?`;
      params.push(safeLimit, offset);

      const [data, totalRows] = await Promise.all([
        conn.query(baseQuery, params),
        conn.query(countQuery, countParams),
      ]);

      const normalizedData = data.map((row: any) => ({
        ...row,
        ResidentID: toNumber(row.ResidentID),
        Age: toNumber(row.Age),
      }));

      const total = toNumber(totalRows[0]?.total);

      return {
        data: normalizedData,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      };
    } finally {
      conn.release();
    }
  }

  // ═══════════════════════════════════════════
  //  RBI FORM A - Residents by household (UC9)
  // ═══════════════════════════════════════════

  static async getFormAData(
    options: FormADataQueryOptions = {},
  ): Promise<FormADataResult> {
    const conn = await pool.getConnection();
    try {
      const disablePagination = options.disablePagination === true;
      const safePage =
        Number.isFinite(options.page) && Number(options.page) > 0
          ? Math.floor(Number(options.page))
          : 1;
      const requestedLimit =
        Number.isFinite(options.limit) && Number(options.limit) > 0
          ? Math.floor(Number(options.limit))
          : 25;
      const safeLimit = Math.min(requestedLimit, 200);

      const whereClauses = ["r.ResidentStatus = 'Active'"];
      const baseParams: any[] = [];

      if (options.householdId) {
        whereClauses.push("r.HouseholdID = ?");
        baseParams.push(options.householdId);
      }

      const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

      const baseFrom = `
            FROM Resident r
            LEFT JOIN Household h ON r.HouseholdID = h.HouseholdID
            LEFT JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
            LEFT JOIN Address a ON h.AddressID = a.AddressID
            LEFT JOIN Employment e ON r.ResidentID = e.ResidentID
            LEFT JOIN ResidentCategory rc ON r.ResidentID = rc.ResidentID
            LEFT JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID`;

      const countQuery = `SELECT COUNT(DISTINCT r.ResidentID) as total ${baseFrom} ${whereSql}`;

      let dataQuery = `SELECT
                r.LastName, r.FirstName, r.MiddleName, r.Suffix,
                r.PlaceOfBirth, r.DateOfBirth,
                TIMESTAMPDIFF(YEAR, r.DateOfBirth, CURDATE()) as Age,
                r.Sex, r.CivilStatus, r.Citizenship,
                e.Occupation,
                hn.HouseholdNumberName as Household,
                hn.StreetName as Street,
                a.Barangay,
                GROUP_CONCAT(sc.CategoryName SEPARATOR ', ') as Categories
            ${baseFrom}
            ${whereSql}
            GROUP BY r.ResidentID
            ORDER BY hn.HouseholdNumberName, r.LastName, r.FirstName`;

      const dataParams = [...baseParams];
      if (!disablePagination) {
        const offset = (safePage - 1) * safeLimit;
        dataQuery += ` LIMIT ? OFFSET ?`;
        dataParams.push(safeLimit, offset);
      }

      const [rows, totalRows] = await Promise.all([
        conn.query(dataQuery, dataParams),
        conn.query(countQuery, baseParams),
      ]);

      const normalizedRows = rows.map((row: any) => ({
        ...row,
        Age: toNumber(row.Age),
      }));

      const total = toNumber(totalRows[0]?.total);
      const effectiveLimit = disablePagination
        ? Math.max(normalizedRows.length, 1)
        : safeLimit;

      return {
        data: normalizedRows,
        total,
        page: disablePagination ? 1 : safePage,
        limit: effectiveLimit,
        totalPages: disablePagination
          ? 1
          : Math.max(1, Math.ceil(total / effectiveLimit)),
      };
    } finally {
      conn.release();
    }
  }

  // ═══════════════════════════════════════════
  //  RBI FORM C - Population monitoring (UC9)
  // ═══════════════════════════════════════════

  static async getFormCData() {
    const conn = await pool.getConnection();
    try {
      //Age brackets by sex
      const ageBrackets = await conn.query(
        `SELECT
                    CASE
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 0 AND 4 THEN 'Under 5 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 5 AND 9 THEN '5-9 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 10 AND 14 THEN '10-14 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 15 AND 19 THEN '15-19 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 20 AND 24 THEN '20-24 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 25 AND 29 THEN '25-29 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 30 AND 34 THEN '30-34 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 35 AND 39 THEN '35-39 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 40 AND 44 THEN '40-44 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 45 AND 49 THEN '45-49 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 50 AND 54 THEN '50-54 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 55 AND 59 THEN '55-59 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 60 AND 64 THEN '60-64 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 65 AND 69 THEN '65-69 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 70 AND 74 THEN '70-74 years old'
                        WHEN TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()) BETWEEN 75 AND 79 THEN '75-79 years old'
                        ELSE '80 years old and over'
                    END as bracket,
                    SUM(CASE WHEN Sex = 'Male' THEN 1 ELSE 0 END) as male,
                    SUM(CASE WHEN Sex = 'Female' THEN 1 ELSE 0 END) as female,
                    COUNT(*) as total
                FROM Resident WHERE ResidentStatus = 'Active'
                GROUP BY bracket
                ORDER BY MIN(TIMESTAMPDIFF(YEAR, DateOfBirth, CURDATE()))`,
      );

      //Sector counts (from SpecialCategory)
      const sectors = await conn.query(
        `SELECT sc.CategoryName as sector,
                    SUM(CASE WHEN r.Sex = 'Male' THEN 1 ELSE 0 END) as male,
                    SUM(CASE WHEN r.Sex = 'Female' THEN 1 ELSE 0 END) as female,
                    COUNT(*) as total
                FROM ResidentCategory rc
                JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                JOIN Resident r ON rc.ResidentID = r.ResidentID
                WHERE r.ResidentStatus = 'Active'
                GROUP BY sc.CategoryName`,
      );

      //Civil status counts
      const civilStatus = await conn.query(
        `SELECT CivilStatus as status, Sex,
                    COUNT(*) as total
                FROM Resident WHERE ResidentStatus = 'Active'
                GROUP BY CivilStatus, Sex`,
      );

      //Citizenship counts
      const citizenship = await conn.query(
        `SELECT Citizenship as citizenship, Sex,
                    COUNT(*) as total
                FROM Resident WHERE ResidentStatus = 'Active'
                GROUP BY Citizenship, Sex`,
      );

      //Summary counts
      const totalInhabitants = await conn.query(
        `SELECT COUNT(*) as total FROM Resident WHERE ResidentStatus = 'Active'`,
      );
      const totalHouseholds = await conn.query(
        `SELECT COUNT(*) as total FROM Household`,
      );
      const totalFamilies = await conn.query(
        `SELECT COUNT(*) as total FROM FamilyHead`,
      );

      const normalizedAgeBrackets = ageBrackets.map((row: any) => ({
        ...row,
        male: toNumber(row.male),
        female: toNumber(row.female),
        total: toNumber(row.total),
      }));

      const normalizedSectors = sectors.map((row: any) => ({
        ...row,
        male: toNumber(row.male),
        female: toNumber(row.female),
        total: toNumber(row.total),
      }));

      const normalizedCivilStatus = civilStatus.map((row: any) => ({
        ...row,
        total: toNumber(row.total),
      }));

      const normalizedCitizenship = citizenship.map((row: any) => ({
        ...row,
        total: toNumber(row.total),
      }));

      return {
        ageBrackets: normalizedAgeBrackets,
        sectors: normalizedSectors,
        civilStatus: normalizedCivilStatus,
        citizenship: normalizedCitizenship,
        summary: {
          totalInhabitants: toNumber(totalInhabitants[0].total),
          totalHouseholds: toNumber(totalHouseholds[0].total),
          totalFamilies: toNumber(totalFamilies[0].total),
        },
      };
    } finally {
      conn.release();
    }
  }

  // ═══════════════════════════════════════════
  //  RESIDENT FULL PROFILE - For PDF (FR4)
  // ═══════════════════════════════════════════

  static async getResidentFullProfile(residentId: number) {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT
                    r.ResidentID, r.FirstName, r.MiddleName, r.LastName, r.Suffix,
                    r.Sex, r.DateOfBirth, r.PlaceOfBirth, r.CivilStatus,
                    r.Citizenship, r.Religion, r.RContactNumber, r.REmail,
                    r.InhabitantType, r.ResidentStatus,
                    r.Mothers_Maiden_Surname, r.Mothers_Maiden_FirstName, r.Mothers_Maiden_MiddleName,
                    TIMESTAMPDIFF(YEAR, r.DateOfBirth, CURDATE()) as Age,
                    a.HouseNumber, a.Street_Alley_Zone, a.Barangay, a.Municipality,
                    a.Unit_RoomNo_Floor, a.Building_Name, a.Lot_Block_Phase_Num,
                    hn.HouseholdNumberName,
                    e.Occupation, e.EmploymentStatus,
                    ed.Level as EducationLevel, ed.EducationStatus,
                    v.VoterID, v.PrecinctNumber,
                    GROUP_CONCAT(DISTINCT sc.CategoryName SEPARATOR ', ') as Categories
                FROM Resident r
                LEFT JOIN Household h ON r.HouseholdID = h.HouseholdID
                LEFT JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
                LEFT JOIN Address a ON h.AddressID = a.AddressID
                LEFT JOIN Employment e ON r.ResidentID = e.ResidentID
                LEFT JOIN Education ed ON r.ResidentID = ed.ResidentID
                LEFT JOIN Voter v ON r.ResidentID = v.ResidentID
                LEFT JOIN ResidentCategory rc ON r.ResidentID = rc.ResidentID
                LEFT JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                WHERE r.ResidentID = ?
                GROUP BY r.ResidentID`,
        [residentId],
      );

      return rows[0] || null;
    } finally {
      conn.release();
    }
  }
}
