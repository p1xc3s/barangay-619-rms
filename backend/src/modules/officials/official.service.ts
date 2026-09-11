import { OfficialRepository } from "./official.repository.js";
import { ResidentRepository } from "../residents/resident.repository.js";
import { AuditTrailRepository } from "../audit/audit.repository.js";

const VALID_POSITIONS = [
  "Barangay Captain",
  "Kagawad",
  "Secretary",
  "Treasurer",
  "SK Chairperson",
  "Clerk",
  "Tanod",
  "BHW",
  "Others",
];

const VALID_STATUSES = ["Active", "Former"];

const parseDateOrThrow = (value: string | Date, label: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw { status: 400, message: `Invalid ${label} date!` };
  }
  return parsed;
};

export class OfficialService {
  //Get all officials
  static async getAllOfficials() {
    return OfficialRepository.getAll();
  }

  //Get active officials as of today (effective term range)
  static async getActiveOfficials() {
    return OfficialRepository.getActiveAsOf();
  }

  //Get official by ID
  static async getOfficialById(officialId: number) {
    const official = await OfficialRepository.getById(officialId);
    if (!official) {
      throw { status: 404, message: "Official not found!" };
    }
    return official;
  }

  //Add new official
  static async addOfficial(
    data: {
      residentId: number;
      position: string;
      termStart: string;
      termEnd: string | null;
    },
    userId: number,
  ) {
    //Validate resident exists
    const resident = await ResidentRepository.getResidentById(data.residentId);
    if (!resident) {
      throw { status: 404, message: "Resident not found!" };
    }

    //Validate position matches schema ENUM
    if (!VALID_POSITIONS.includes(data.position)) {
      throw { status: 400, message: "Invalid position!" };
    }

    //Check if resident is already an active official
    const isAlready = await OfficialRepository.isActiveOfficial(
      data.residentId,
    );
    if (isAlready) {
      throw { status: 400, message: "Resident is already an active official!" };
    }

    const termStartDate = parseDateOrThrow(data.termStart, "term start");
    if (data.termEnd) {
      const termEndDate = parseDateOrThrow(data.termEnd, "term end");
      if (termEndDate < termStartDate) {
        throw {
          status: 400,
          message: "Term end must be on or after term start!",
        };
      }
    }

    const officialId =
      await OfficialRepository.createActiveWithTransition(data);

    //Audit log
    await AuditTrailRepository.log({
      userId,
      action: "ADD_OFFICIAL",
      newValue: JSON.stringify({ officialId, ...data }),
    });

    return officialId;
  }

  //Update official
  static async updateOfficial(
    officialId: number,
    data: {
      position?: string;
      termStart?: string;
      termEnd?: string | null;
      bStatus?: string;
    },
    userId: number,
  ) {
    //Validate official exists
    const existing = await OfficialRepository.getById(officialId);
    if (!existing) {
      throw { status: 404, message: "Official not found!" };
    }

    //Validate position if provided
    if (data.position && !VALID_POSITIONS.includes(data.position)) {
      throw { status: 400, message: "Invalid position!" };
    }

    //Validate status if provided
    if (data.bStatus && !VALID_STATUSES.includes(data.bStatus)) {
      throw { status: 400, message: "Invalid status!" };
    }

    const nextPosition = data.position ?? existing.Position;
    const nextTermStart = data.termStart ?? existing.TermStart;
    const nextTermEnd =
      data.termEnd !== undefined ? data.termEnd : existing.TermEnd;
    const nextStatus = data.bStatus ?? existing.BStatus;

    const termStartDate = parseDateOrThrow(nextTermStart, "term start");
    if (nextTermEnd) {
      const termEndDate = parseDateOrThrow(nextTermEnd, "term end");
      if (termEndDate < termStartDate) {
        throw {
          status: 400,
          message: "Term end must be on or after term start!",
        };
      }
    }

    const updated =
      nextStatus === "Active"
        ? await OfficialRepository.activateOfficial(officialId, {
            position: nextPosition,
            termStart: nextTermStart,
            termEnd: nextTermEnd ?? null,
          })
        : await OfficialRepository.update(officialId, {
            position: nextPosition,
            termStart: nextTermStart,
            termEnd: nextTermEnd ?? null,
            bStatus: nextStatus,
          });

    if (!updated) {
      throw { status: 400, message: "No changes applied!" };
    }

       const mapOfficialToReadable = (off: any) => ({
      "Position": off.Position || off.position,
      "Term Start": off.TermStart || off.termStart,
      "Term End": off.TermEnd !== undefined ? off.TermEnd : off.termEnd,
      "Status": off.BStatus || off.bStatus
    });

    //Audit log
    await AuditTrailRepository.log({
      userId,
      action: "UPDATE_OFFICIAL",
      oldValue: JSON.stringify(mapOfficialToReadable(existing)),
      newValue: JSON.stringify(mapOfficialToReadable({
         position: data.position ?? existing.Position,
         termStart: data.termStart ?? existing.TermStart,
         termEnd: data.termEnd !== undefined ? data.termEnd : existing.TermEnd,
         bStatus: data.bStatus ?? existing.BStatus
      })),
    });

    return true;
  }
}
