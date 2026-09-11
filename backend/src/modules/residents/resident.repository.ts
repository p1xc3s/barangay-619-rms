import { pool } from "../../config/database.js";
import { HouseholdRepository } from "../households/household.repository.js";

const normalizeCategoryName = (category: string): string | null => {
  const normalized = category.trim();

  const categoryAliasMap: Record<string, string> = {
    PWD: "PWD",
    "Solo Parent": "Solo Parent",
    "Pregnant Woman": "Pregnant Woman",
    Pregnant: "Pregnant Woman",
    OSY: "OSY",
    "OSY (Out of School Youth)": "OSY",
    OSC: "OSC",
    "4Ps": "4Ps",
    "4Ps Beneficiary": "4Ps",
    OFW: "OFW",
    IP: "IP",
    "Indigenous People": "IP",
    Indigent: "4Ps",
  };

  return categoryAliasMap[normalized] ?? null;
};

const normalizeEducationLevel = (level: unknown): string | null => {
  if (typeof level !== "string") return null;

  const normalized = level.trim();
  const levelAliasMap: Record<string, string> = {
    "Pre-Elementary": "Elementary",
    Elementary: "Elementary",
    "High School": "High School",
    "Senior High School": "High School",
    Vocational: "Vocational",
    College: "College",
    "Post Graduate": "Post Grad",
    "Post Grad": "Post Grad",
    Doctorate: "Post Grad",
  };

  return levelAliasMap[normalized] ?? null;
};

const normalizeEducationStatus = (status: unknown): string | null => {
  if (typeof status !== "string") return null;

  const normalized = status.trim();
  const statusAliasMap: Record<string, string> = {
    Enrolled: "Ongoing",
    Ongoing: "Ongoing",
    Undergraduate: "Undergraduate",
    Graduate: "Graduate",
  };

  return statusAliasMap[normalized] ?? null;
};

const normalizeEmploymentStatus = (status: unknown): string | null => {
  if (typeof status !== "string") return null;

  const normalized = status.trim();
  const statusAliasMap: Record<string, string> = {
    Employed: "Employed",
    Regular: "Employed",
    Contractual: "Employed",
    "Job Order": "Employed",
    Seasonal: "Employed",
    "Self-Employed": "Self-Employed",
    Retired: "Retired",
  };

  return statusAliasMap[normalized] ?? null;
};

const normalizeOccupancyStatus = (
  status: unknown,
): "Owner" | "Renter" | "Sharer" | "Boarder" | null => {
  if (typeof status !== "string") return null;

  const normalized = status.trim().toLowerCase();
  const statusAliasMap: Record<
    string,
    "Owner" | "Renter" | "Sharer" | "Boarder"
  > = {
    owner: "Owner",
    renter: "Renter",
    sharer: "Sharer",
    boarder: "Boarder",
  };

  return statusAliasMap[normalized] ?? null;
};

const normalizeCategoryList = (categories: unknown): string[] => {
  if (!Array.isArray(categories)) {
    return [];
  }

  return [
    ...new Set(
      categories
        .filter(
          (category: unknown): category is string =>
            typeof category === "string",
        )
        .map((category: string) => normalizeCategoryName(category))
        .filter((category: string | null): category is string =>
          Boolean(category),
        ),
    ),
  ];
};

const resolveCategoryId = async (
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
  categoryName: string,
): Promise<number> => {
  const existingCategoryRows = await conn.query(
    `SELECT CategoryID FROM SpecialCategory WHERE CategoryName = ? LIMIT 1`,
    [categoryName],
  );

  const existingCategoryId = Number(existingCategoryRows[0]?.CategoryID);
  if (existingCategoryId) {
    return existingCategoryId;
  }

  const createdCategory = await conn.query(
    `INSERT INTO SpecialCategory (CategoryName) VALUES (?)`,
    [categoryName],
  );

  return Number(createdCategory.insertId);
};

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

export class ResidentRepository {
  static async createResident(data: any) {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      //Add Address fields
      const addressResult = await conn.query(
        `INSERT INTO Address (
          Unit_RoomNo_Floor, 
          Building_Name, 
          Lot_Block_Phase_Num, 
          HouseNumber, 
          Street_Alley_Zone, 
          Barangay, 
          Municipality
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.address?.unitRoomFloor ?? null,
          data.address?.buildingName ?? null,
          data.address?.lotBlockPhase ?? null,
          data.address.houseNumber,
          data.address.street,
          data.address.barangay,
          data.address.municipality,
        ],
      );

      const addressId = Number(addressResult.insertId);

      //Add Household - resolve HouseID → HouseholdID if needed
      let householdId: number | null = null;

      if (data.householdId) {
        // First check if this is a valid HouseholdID
        const directCheck = await conn.query(
          `SELECT HouseholdID FROM Household WHERE HouseholdID = ? LIMIT 1`,
          [data.householdId],
        );

        if (directCheck.length > 0) {
          householdId = data.householdId;

          // Update the Household to point to the new specific Address
          await conn.query(
            `UPDATE Household SET AddressID = ? WHERE HouseholdID = ?`,
            [addressId, householdId],
          );
        } else {
          // It might be a HouseID from HouseholdNumber - resolve it
          try {
            householdId = await HouseholdRepository.resolveOrCreateHousehold(
              conn,
              data.householdId,
            );
            
            // ---> THE MISSING FIX <---
            // We just created the Household, now we MUST point it to the new specific Address!
            await conn.query(
              `UPDATE Household SET AddressID = ? WHERE HouseholdID = ?`,
              [addressId, householdId]
            );
          } catch {
            // If resolution fails, throw a clear error
            throw {
              status: 400,
              message: "Invalid household ID!",
            };
          }
        }
      }

      //Add Resident (all schema fields)
      const residentResult = await conn.query(
        `INSERT INTO Resident (
          FirstName, 
          MiddleName, 
          LastName, 
          Suffix,
          Sex, 
          DateOfBirth, 
          PlaceOfBirth, 
          CivilStatus, 
          Citizenship, 
          Religion,
          HouseholdID, 
          ResidentStatus, 
          RContactNumber,
          REmail,
          InhabitantType,
          Mothers_Maiden_Surname,
          Mothers_Maiden_FirstName,
          Mothers_Maiden_MiddleName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?)`,
        [
          data.firstName,
          data.middleName ?? null,
          data.lastName,
          data.suffix ?? null,
          data.sex,
          data.dateOfBirth,
          data.placeOfBirth,
          data.civilStatus,
          data.citizenship,
          data.religion ?? null,
          householdId,
          data.contactNumber ?? null,
          data.email ?? null,
          data.inhabitantType,
          data.mothersMaidenSurname ?? null,
          data.mothersMaidenFirstName ?? null,
          data.mothersMaidenMiddleName ?? null,
        ],
      );

      const residentId = Number(residentResult.insertId);

      const shouldInsertEducation =
        data.hasEducation === "yes" ||
        Boolean(data.educationLevel) ||
        Boolean(data.educationStatus);

      if (shouldInsertEducation) {
        const educationLevel = normalizeEducationLevel(data.educationLevel);
        const educationStatus = normalizeEducationStatus(data.educationStatus);

        if (educationLevel && educationStatus) {
          await conn.query(
            `INSERT INTO Education (ResidentID, Level, EducationStatus) VALUES (?, ?, ?)`,
            [residentId, educationLevel, educationStatus],
          );
        }
      }

      const shouldInsertEmployment =
        data.isEmployed === "yes" ||
        Boolean(data.occupation) ||
        Boolean(data.employmentStatus);

      if (shouldInsertEmployment) {
        const employmentStatus = normalizeEmploymentStatus(
          data.employmentStatus,
        );
        const occupation =
          typeof data.occupation === "string" && data.occupation.trim().length
            ? data.occupation.trim()
            : null;

        if (employmentStatus) {
          await conn.query(
            `INSERT INTO Employment (ResidentID, Occupation, EmploymentStatus) VALUES (?, ?, ?)`,
            [residentId, occupation, employmentStatus],
          );
        }
      }

      const shouldInsertVoter =
        data.isVoter === "yes" || Boolean(data.precinctNumber);

      if (shouldInsertVoter) {
        const precinctNumber =
          typeof data.precinctNumber === "string" &&
          data.precinctNumber.trim().length
            ? data.precinctNumber.trim()
            : null;

        const voterId =
          `V${residentId}${Date.now().toString().slice(-8)}`.slice(0, 20);

        await conn.query(
          `INSERT INTO Voter (VoterID, ResidentID, PrecinctNumber) VALUES (?, ?, ?)`,
          [voterId, residentId, precinctNumber],
        );
      }

      const requestedCategories = normalizeCategoryList(data.categories);

      for (const categoryName of requestedCategories) {
        const categoryId = await resolveCategoryId(conn, categoryName);

        await conn.query(
          `INSERT INTO ResidentCategory (ResidentID, CategoryID, ExtraInfo)
           VALUES (?, ?, NULL)`,
          [residentId, categoryId],
        );
      }

      const occupancyStatus = normalizeOccupancyStatus(data.occupancyStatus);
      if (occupancyStatus && householdId) {
        await conn.query(
          `INSERT INTO ResidentHouseholdSetup (ResidentID, OccupancyStatus)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE OccupancyStatus = VALUES(OccupancyStatus)`,
          [residentId, occupancyStatus],
        );
      }

      await conn.commit();
      return residentId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  //Get All Residents
  static async getAllResidents() {
    const conn = await pool.getConnection();

    try {
      const rows = await conn.query(
        `SELECT
            r.ResidentID,
            r.FirstName,
            r.LastName,
            r.Sex,
            r.DateOfBirth,
            r.CivilStatus,
            r.ResidentStatus,
            h.HouseholdID,
            GROUP_CONCAT(
              DISTINCT sc.CategoryName
              ORDER BY sc.CategoryName
              SEPARATOR ', '
            ) AS Categories
         FROM Resident r
         LEFT JOIN Household h ON r.HouseholdID = h.HouseholdID
         LEFT JOIN ResidentCategory rc ON r.ResidentID = rc.ResidentID
         LEFT JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
         WHERE r.ResidentStatus = 'Active'
         GROUP BY
            r.ResidentID,
            r.FirstName,
            r.LastName,
            r.Sex,
            r.DateOfBirth,
            r.CivilStatus,
            r.ResidentStatus,
            h.HouseholdID
         ORDER BY r.LastName`,
      );

      return rows;
    } finally {
      conn.release();
    }
  }

  //Get Resident By ID (all fields)
  static async getResidentById(id: number) {
    const conn = await pool.getConnection();

    try {
      const rows = await conn.query(
        `SELECT
          r.ResidentID,
          r.FirstName,
          r.MiddleName,
          r.LastName,
          r.Suffix,
          r.Sex,
          DATE_FORMAT(r.DateOfBirth, '%Y-%m-%d') AS DateOfBirth,
          r.PlaceOfBirth,
          r.CivilStatus,
          r.Citizenship,
          r.Religion,
          r.RContactNumber,
          r.REmail,
          r.InhabitantType,
          r.ResidentStatus,
          r.Mothers_Maiden_Surname,
          r.Mothers_Maiden_FirstName,
          r.Mothers_Maiden_MiddleName,
          r.HouseholdID,
          h.HouseholdID AS householdId,
          hn.HouseholdNumberName AS HouseholdNumber,
          a.Unit_RoomNo_Floor AS UnitRoomFloor,
          a.Building_Name AS BuildingName,
          a.Lot_Block_Phase_Num AS LotBlockPhase,
          a.HouseNumber AS HouseNumber,
          a.Street_Alley_Zone AS Street,
          a.Barangay,
          a.Municipality,
          (
            CASE
              WHEN r.HouseholdID IS NULL THEN NULL
              WHEN EXISTS (
                SELECT 1
                FROM FamilyHead fh
                WHERE fh.HouseholdID = r.HouseholdID
                  AND fh.ResidentID = r.ResidentID
                  AND fh.HeadType = 'Primary'
              ) THEN 'head'
              ELSE 'member'
            END
          ) AS HouseholdRole,
          (
            SELECT CONCAT(headResident.FirstName, ' ', headResident.LastName)
            FROM FamilyHead head
            JOIN Resident headResident ON head.ResidentID = headResident.ResidentID
            WHERE head.FamilyHeadID = COALESCE(
              (
                SELECT fh.FamilyHeadID
                FROM FamilyHead fh
                WHERE fh.ResidentID = r.ResidentID
                  AND fh.HeadType = 'Primary'
                LIMIT 1
              ),
              (
                SELECT f.FamilyHeadID
                FROM Family f
                WHERE f.ResidentID = r.ResidentID
                LIMIT 1
              )
            )
            LIMIT 1
          ) AS HouseholdHeadName,
          rhs.OccupancyStatus AS OccupancyStatus,
          (
            SELECT e.Level
            FROM Education e
            WHERE e.ResidentID = r.ResidentID
            ORDER BY e.EducationID DESC
            LIMIT 1
          ) AS EducationLevel,
          (
            SELECT e.EducationStatus
            FROM Education e
            WHERE e.ResidentID = r.ResidentID
            ORDER BY e.EducationID DESC
            LIMIT 1
          ) AS EducationStatus,
          (
            SELECT em.Occupation
            FROM Employment em
            WHERE em.ResidentID = r.ResidentID
            ORDER BY em.EmploymentID DESC
            LIMIT 1
          ) AS Occupation,
          (
            SELECT em.EmploymentStatus
            FROM Employment em
            WHERE em.ResidentID = r.ResidentID
            ORDER BY em.EmploymentID DESC
            LIMIT 1
          ) AS EmploymentStatus,
          (
            SELECT v.PrecinctNumber
            FROM Voter v
            WHERE v.ResidentID = r.ResidentID
            LIMIT 1
          ) AS PrecinctNumber,
          (
            SELECT v.VoterID
            FROM Voter v
            WHERE v.ResidentID = r.ResidentID
            LIMIT 1
          ) AS VoterID,
          (
            SELECT GROUP_CONCAT(
              DISTINCT sc.CategoryName
              ORDER BY sc.CategoryName
              SEPARATOR ', '
            )
            FROM ResidentCategory rc
            JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
            WHERE rc.ResidentID = r.ResidentID
          ) AS Categories,
          fam.FamilyHeadID AS FamilyHeadID,
          fam.RelationshipToFamilyHead AS RelationshipToFamilyHead
        FROM Resident r
        LEFT JOIN Household h ON r.HouseholdID = h.HouseholdID
        LEFT JOIN HouseholdNumber hn ON h.HouseID = hn.HouseID
        LEFT JOIN Address a ON h.AddressID = a.AddressID
        LEFT JOIN ResidentHouseholdSetup rhs ON rhs.ResidentID = r.ResidentID
        LEFT JOIN Family fam ON fam.ResidentID = r.ResidentID
        WHERE r.ResidentID = ?`,
        [id],
      );

      return rows[0] || null;
    } finally {
      conn.release();
    }
  }

  //Update Resident (all editable fields)
  static async updateResident(id: number, data: any) {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const payload =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : {};

      const result = await conn.query(
        `UPDATE Resident SET 
          FirstName = ?, 
          MiddleName = ?, 
          LastName = ?, 
          Suffix = ?,
          Sex = ?, 
          DateOfBirth = ?,
          PlaceOfBirth = ?,
          CivilStatus = ?, 
          Citizenship = ?,
          InhabitantType = ?,
          Religion = ?,
          RContactNumber = ?,
          REmail = ?,
          ResidentStatus = ?,
          Mothers_Maiden_Surname = ?,
          Mothers_Maiden_FirstName = ?,
          Mothers_Maiden_MiddleName = ?
        WHERE ResidentID = ?`,
        [
          data.firstName,
          data.middleName ?? null,
          data.lastName,
          data.suffix ?? null,
          data.sex,
          data.dateOfBirth ?? null,
          data.placeOfBirth ?? null,
          data.civilStatus,
          data.citizenship ?? null,
          data.inhabitantType ?? null,
          data.religion ?? null,
          data.contactNumber ?? null,
          data.email ?? null,
          data.residentStatus,
          data.mothersMaidenSurname ?? null,
          data.mothersMaidenFirstName ?? null,
          data.mothersMaidenMiddleName ?? null,
          id,
        ],
      );

      // Sync Address fields if provided
      if (data.address) {
        // Find the AddressID linked to this resident's household
        const addressRows = await conn.query(
          `SELECT h.AddressID, h.HouseholdID FROM Household h 
           JOIN Resident r ON r.HouseholdID = h.HouseholdID 
           WHERE r.ResidentID = ?`,
          [id]
        );

        if (addressRows.length > 0 && addressRows[0].AddressID) {
          const currentAddressId = addressRows[0].AddressID;
          const targetHouseholdId = addressRows[0].HouseholdID;

          // AddressID 1, 2, and 3 are the base streets, we don't want to overwrite them!
          if (currentAddressId > 3) {
            // It's a specific address, safe to overwrite
            await conn.query(
              `UPDATE Address SET 
                Unit_RoomNo_Floor = ?, 
                Building_Name = ?, 
                Lot_Block_Phase_Num = ?
               WHERE AddressID = ?`,
              [
                data.address.unitRoomFloor || null,
                data.address.buildingName || null,
                data.address.lotBlockPhase || null,
                currentAddressId
              ]
            );
          } else {
            // The household is still stuck on the blank template street!
            // We must create a brand new specific address and switch the household to it.
            const newAddressResult = await conn.query(
              `INSERT INTO Address (
                Unit_RoomNo_Floor, Building_Name, Lot_Block_Phase_Num, 
                HouseNumber, Street_Alley_Zone, Barangay, Municipality
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                data.address.unitRoomFloor || null,
                data.address.buildingName || null,
                data.address.lotBlockPhase || null,
                data.address.houseNumber || "",
                data.address.street || "",
                data.address.barangay || "Barangay 619",
                data.address.municipality || "Manila"
              ]
            );

            // Link the household to the new specific address
            await conn.query(
              `UPDATE Household SET AddressID = ? WHERE HouseholdID = ?`,
              [newAddressResult.insertId, targetHouseholdId]
            );
          }
        }
      }

      let categoriesSynced = false;
      let educationSynced = false;
      let employmentSynced = false;
      let voterSynced = false;
      let occupancySynced = false;
      let householdSynced = false;

      if (hasOwn(payload, "householdId")) {
        const requestedHouseholdId = data.householdId;
        const normalizedHouseholdId =
          requestedHouseholdId === null ||
          requestedHouseholdId === "" ||
          requestedHouseholdId === undefined
            ? null
            : Number(requestedHouseholdId);

        const householdIdValue =
          typeof normalizedHouseholdId === "number" &&
          Number.isFinite(normalizedHouseholdId)
            ? normalizedHouseholdId
            : null;

        await conn.query(
          `UPDATE Resident SET HouseholdID = ? WHERE ResidentID = ?`,
          [householdIdValue, id],
        );
        householdSynced = true;
      }

      if (Array.isArray(data.categories)) {
        const requestedCategories = normalizeCategoryList(data.categories);

        await conn.query(`DELETE FROM ResidentCategory WHERE ResidentID = ?`, [
          id,
        ]);

        for (const categoryName of requestedCategories) {
          const categoryId = await resolveCategoryId(conn, categoryName);

          await conn.query(
            `INSERT INTO ResidentCategory (ResidentID, CategoryID, ExtraInfo)
             VALUES (?, ?, NULL)`,
            [id, categoryId],
          );
        }

        categoriesSynced = true;
      }

      const shouldSyncEducation =
        hasOwn(payload, "hasEducation") ||
        hasOwn(payload, "educationLevel") ||
        hasOwn(payload, "educationStatus");

      if (shouldSyncEducation) {
        const hasEducationYes = data.hasEducation === "yes";
        const hasEducationNo = data.hasEducation === "no";
        const educationLevel = normalizeEducationLevel(data.educationLevel);
        const educationStatus = normalizeEducationStatus(data.educationStatus);

        const shouldKeepEducation =
          !hasEducationNo &&
          (hasEducationYes || Boolean(educationLevel || educationStatus));

        if (!shouldKeepEducation) {
          await conn.query(`DELETE FROM Education WHERE ResidentID = ?`, [id]);
          educationSynced = true;
        } else if (educationLevel && educationStatus) {
          await conn.query(`DELETE FROM Education WHERE ResidentID = ?`, [id]);
          await conn.query(
            `INSERT INTO Education (ResidentID, Level, EducationStatus) VALUES (?, ?, ?)`,
            [id, educationLevel, educationStatus],
          );
          educationSynced = true;
        }
      }

      const shouldSyncEmployment =
        hasOwn(payload, "isEmployed") ||
        hasOwn(payload, "occupation") ||
        hasOwn(payload, "employmentStatus");

      if (shouldSyncEmployment) {
        const isEmployedYes = data.isEmployed === "yes";
        const isEmployedNo = data.isEmployed === "no";
        const employmentStatus = normalizeEmploymentStatus(
          data.employmentStatus,
        );
        const occupation =
          typeof data.occupation === "string" && data.occupation.trim().length
            ? data.occupation.trim()
            : null;

        const shouldKeepEmployment =
          !isEmployedNo &&
          (isEmployedYes || Boolean(employmentStatus || occupation));

        if (!shouldKeepEmployment) {
          await conn.query(`DELETE FROM Employment WHERE ResidentID = ?`, [id]);
          employmentSynced = true;
        } else if (employmentStatus) {
          await conn.query(`DELETE FROM Employment WHERE ResidentID = ?`, [id]);
          await conn.query(
            `INSERT INTO Employment (ResidentID, Occupation, EmploymentStatus) VALUES (?, ?, ?)`,
            [id, occupation, employmentStatus],
          );
          employmentSynced = true;
        }
      }

      const shouldSyncVoter =
        hasOwn(payload, "isVoter") || hasOwn(payload, "precinctNumber");

      if (shouldSyncVoter) {
        const isVoterYes = data.isVoter === "yes";
        const isVoterNo = data.isVoter === "no";
        const precinctNumber =
          typeof data.precinctNumber === "string" &&
          data.precinctNumber.trim().length
            ? data.precinctNumber.trim()
            : null;

        const shouldKeepVoter =
          !isVoterNo && (isVoterYes || Boolean(precinctNumber));

        if (!shouldKeepVoter) {
          await conn.query(`DELETE FROM Voter WHERE ResidentID = ?`, [id]);
          voterSynced = true;
        } else {
          const voterRows = await conn.query(
            `SELECT VoterID FROM Voter WHERE ResidentID = ? LIMIT 1`,
            [id],
          );
          const existingVoterId = voterRows[0]?.VoterID
            ? String(voterRows[0].VoterID)
            : null;

          if (existingVoterId) {
            await conn.query(
              `UPDATE Voter SET PrecinctNumber = ? WHERE ResidentID = ?`,
              [precinctNumber, id],
            );
          } else {
            const voterId = `V${id}${Date.now().toString().slice(-8)}`.slice(
              0,
              20,
            );
            await conn.query(
              `INSERT INTO Voter (VoterID, ResidentID, PrecinctNumber) VALUES (?, ?, ?)`,
              [voterId, id, precinctNumber],
            );
          }

          voterSynced = true;
        }
      }

      const shouldSyncOccupancy =
        hasOwn(payload, "occupancyStatus") || hasOwn(payload, "householdRole");

      if (shouldSyncOccupancy) {
        const occupancyStatus = normalizeOccupancyStatus(data.occupancyStatus);
        const householdRole =
          typeof data.householdRole === "string"
            ? data.householdRole.trim().toLowerCase()
            : "";

        const shouldPersistOccupancy =
          householdRole !== "member" && Boolean(occupancyStatus);

        if (shouldPersistOccupancy && occupancyStatus) {
          await conn.query(
            `INSERT INTO ResidentHouseholdSetup (ResidentID, OccupancyStatus)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE OccupancyStatus = VALUES(OccupancyStatus)`,
            [id, occupancyStatus],
          );
        } else {
          await conn.query(
            `DELETE FROM ResidentHouseholdSetup WHERE ResidentID = ?`,
            [id],
          );
        }

        occupancySynced = true;
      }

      await conn.commit();

      return (
        result.affectedRows > 0 ||
        categoriesSynced ||
        educationSynced ||
        employmentSynced ||
        voterSynced ||
        occupancySynced ||
        householdSynced
      );
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  //Search Residents (enhanced per FR3 — supports name, sex, status, household, address)
  static async searchResidents(filters: Record<string, string>) {
    const conn = await pool.getConnection();

    try {
      let sql = `SELECT r.ResidentID, r.FirstName, r.LastName, r.Sex,
                        r.DateOfBirth, r.CivilStatus, r.ResidentStatus,
                        r.HouseholdID,
                        GROUP_CONCAT(
                          DISTINCT sc.CategoryName
                          ORDER BY sc.CategoryName
                          SEPARATOR ', '
                        ) AS Categories
                 FROM Resident r
                 LEFT JOIN Household h ON r.HouseholdID = h.HouseholdID
                 LEFT JOIN Address a ON h.AddressID = a.AddressID
                 LEFT JOIN ResidentCategory rc ON r.ResidentID = rc.ResidentID
                 LEFT JOIN SpecialCategory sc ON rc.CategoryID = sc.CategoryID
                 WHERE 1=1`;
      const params: (string | number)[] = [];

      //Search by name (FirstName OR LastName)
      if (filters.name) {
        sql += " AND (r.FirstName LIKE ? OR r.LastName LIKE ?)";
        params.push(`%${filters.name}%`, `%${filters.name}%`);
      }

      //Filter by sex
      if (filters.sex) {
        sql += " AND r.Sex = ?";
        params.push(filters.sex);
      }

      //Filter by civil status
      if (filters.civilStatus) {
        sql += " AND r.CivilStatus = ?";
        params.push(filters.civilStatus);
      }

      //Filter by resident status (Active, MovedOut, Deceased)
      if (filters.status) {
        sql += " AND r.ResidentStatus = ?";
        params.push(filters.status);
      }

      //Filter by household
      if (filters.householdId) {
        sql += " AND r.HouseholdID = ?";
        params.push(Number(filters.householdId));
      }

      //Filter by inhabitant type
      if (filters.inhabitantType) {
        sql += " AND r.InhabitantType = ?";
        params.push(filters.inhabitantType);
      }

      //Filter by address (street name)
      if (filters.address) {
        sql += " AND a.Street_Alley_Zone LIKE ?";
        params.push(`%${filters.address}%`);
      }

      sql += ` GROUP BY
                  r.ResidentID,
                  r.FirstName,
                  r.LastName,
                  r.Sex,
                  r.DateOfBirth,
                  r.CivilStatus,
                  r.ResidentStatus,
                  r.HouseholdID
               ORDER BY r.LastName ASC`;

      return await conn.query(sql, params);
    } finally {
      conn.release();
    }
  }

  //Check for duplicate resident
  static async findDuplicate(
    firstName: string,
    lastName: string,
    dateOfBirth: string,
  ): Promise<any> {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT ResidentID, FirstName, LastName, DateOfBirth, ResidentStatus FROM Resident WHERE FirstName = ? AND LastName = ? AND DateOfBirth = ?`,
        [firstName, lastName, dateOfBirth],
      );
      return rows[0] || null;
    } finally {
      conn.release();
    }
  }

  //Get all archived (Deceased/MovedOut) residents
  static async getArchivedResidents() {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT r.ResidentID, r.FirstName, r.LastName, r.Sex, r.ResidentStatus,
                d.DateofDeath,
                COALESCE(
                  DATE_FORMAT(d.DateofDeath, '%Y-%m-%d'),
                  DATE_FORMAT(
                    (
                      SELECT MAX(rh.ChangeDate)
                      FROM ResidentHistory rh
                      WHERE rh.ResidentID = r.ResidentID
                        AND rh.ChangeType IN ('Deceased', 'MovedOut')
                    ),
                    '%Y-%m-%d'
                  )
                ) AS DateArchived
         FROM Resident r
         LEFT JOIN Deceased d ON r.ResidentID = d.ResidentID
         WHERE r.ResidentStatus IN ('Deceased', 'MovedOut')
         ORDER BY r.LastName`,
      );
      return rows;
    } finally {
      conn.release();
    }
  }
}
