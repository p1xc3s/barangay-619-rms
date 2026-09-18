import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  Button,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Divider,
  Stack,
  Badge,
  Select,
} from "@mui/material";
import {
  Search,
  Plus,
  Eye,
  Archive as ArchiveIcon,
  Skull,
  PlaneTakeoff,
  Filter,
  Users,
  Home,
  ChevronDown,
  UsersRound,
  Pencil,
  X,
  Crown,
  UserCheck,
  Info,
  AlertTriangle,
} from "lucide-react";
import AddResidentModal from "./AddResidentModal";
import ResidentProfileModal from "./ResidentProfileModal";
import { residentService } from "../services/residentService";
import { householdService } from "../services/householdService";
import { familyService } from "../services/familyService";
import { archiveService } from "../services/archiveService";
import { notify } from "../utils/notify";
import { useHouseholdDataRefresh } from "../hooks/useHouseholdDataSync";
import SortOrderToggle, { type SortOrder } from "./SortOrderToggle";
import type {
  ResidentListItem,
  HouseholdListItem,
  HouseholdNumber,
  FamilyRecord,
  CreateResidentData,
  FamilyHeadOption,
} from "../types";

interface ResidentFormData {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  sex: string;
  dob?: string;
  dateOfBirth?: string;
  birthDate?: string;
  placeOfBirth?: string;
  civilStatus?: string;
  citizenship?: string;
  religion?: string;
  contactNumber?: string;
  email?: string;
  inhabitantType?: string;
  mothersMaidenNameLast?: string;
  mothersMaidenNameFirst?: string;
  mothersMaidenNameMiddle?: string;
  mothersMaidenSurname?: string;
  mothersMaidenFirstName?: string;
  mothersMaidenMiddleName?: string;
  householdId?: string | number;
  householdNumber?: string;
  unitRoom?: string;
  building?: string;
  lotBlock?: string;
  city?: string;
  unitRoomFloor?: string;
  buildingName?: string;
  lotBlockPhase?: string;
  houseNumber?: string;
  street?: string;
  barangay?: string;
  municipality?: string;
  categories?: string[];
  hasEducation?: "yes" | "no";
  educationLevel?: string;
  educationStatus?: string;
  isEmployed?: "yes" | "no";
  occupation?: string;
  employmentStatus?: string;
  isVoter?: "yes" | "no";
  precinctNumber?: string;
  householdRole?: "head" | "member";
  householdHeadId?: string;
  familyRole?: string;
  occupancyStatus?: "Owner" | "Renter" | "Sharer" | "Boarder";
}

// Helper: calculate age from date of birth
const calculateAge = (dateOfBirth?: string): number => {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const filterCategories = [
  "PWD",
  "Solo Parent",
  "Pregnant Woman",
  "OSY",
  "OSC",
  "4Ps",
  "OFW",
  "IP",
];

const parseResidentCategories = (categories?: string | null): string[] => {
  if (!categories) return [];

  return categories
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
};

const toFamilyAlphabetLabel = (index: number): string => {
  const base = 26;
  let n = index;
  let label = "";

  do {
    label = String.fromCharCode(65 + (n % base)) + label;
    n = Math.floor(n / base) - 1;
  } while (n >= 0);

  return `Family ${label}`;
};

interface HouseholdRegistryRow {
  HouseID: number;
  HouseholdID?: number;
  householdNumber: string;
  householdStatus: string;
  Street_Alley_Zone: string;
  Barangay: string;
  memberCount: number;
  familyCount: number;
  hasHousehold: boolean;
}

const ResidentRecords: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [residents, setResidents] = useState<ResidentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [householdNumbers, setHouseholdNumbers] = useState<HouseholdNumber[]>(
    [],
  );

  const [isHouseholdsLoading, setIsHouseholdsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStreetFilter, setSelectedStreetFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [mainSortOrder, setMainSortOrder] = useState<SortOrder>("desc");
  const rowsPerPage = 10;
  const [familyPage, setFamilyPage] = useState(1);
  const [familySortOrder, setFamilySortOrder] = useState<SortOrder>("asc");
  const familyRowsPerPage = 10;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddHouseholdOpen, setIsAddHouseholdOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isHeadWarningOpen, setIsHeadWarningOpen] = useState(false);
  const [isResidentProfileOpen, setIsResidentProfileOpen] = useState(false);
  const [isFamilyDetailOpen, setIsFamilyDetailOpen] = useState(false);
  const [selectedFamilyGroupId, setSelectedFamilyGroupId] = useState<
    number | null
  >(null);
  const [isHeadSelectOpen, setIsHeadSelectOpen] = useState(false);
  const [selectedFamilyHeadId, setSelectedFamilyHeadId] = useState("");
  const [preselectedHouseholdId, setPreselectedHouseholdId] = useState<
    string | undefined
  >(undefined);

  const [selectedResident, setSelectedResident] =
    useState<ResidentListItem | null>(null);
  const [residentToArchive, setResidentToArchive] =
    useState<ResidentListItem | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<
    "Deceased" | "Moved Out" | null
  >(null);
  const [archiveDateOfDeath, setArchiveDateOfDeath] = useState("");
  const [preselectedHeadId, setPreselectedHeadId] = useState<
    string | undefined
  >(undefined);

  const [newHouseholdNum, setNewHouseholdNum] = useState("");
  const [selectedHouseholdStreet, setSelectedHouseholdStreet] = useState("");

  const [isEditHouseholdOpen, setIsEditHouseholdOpen] = useState(false);
  const [editHouseholdId, setEditHouseholdId] = useState<number | null>(null);
  const [editHouseholdName, setEditHouseholdName] = useState("");

  const [familyAnchorEl, setFamilyAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(
    null,
  );
  const [activeHousehold, setActiveHousehold] =
    useState<HouseholdListItem | null>(null);
  const [familyRecords, setFamilyRecords] = useState<FamilyRecord[]>([]);
  const [isFamilyLoading, setIsFamilyLoading] = useState(false);
  const [headTransferTarget, setHeadTransferTarget] =
    useState<FamilyRecord | null>(null);
  const [familyHeadOptions, setFamilyHeadOptions] = useState<
    FamilyHeadOption[]
  >([]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSearchQuery("");
    setSelectedCategory("All");
    setPage(1);
  };

  // Fetch residents from API
  const fetchResidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await residentService.getAll();
      setResidents(data);
    } catch {
      notify.error("Failed to load residents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch households from API
  const fetchHouseholds = useCallback(async () => {
    try {
      const data = await householdService.getAll();
      setHouseholds(data);
    } catch {
      notify.error("Failed to load households.");
    }
  }, []);

  const fetchHouseholdNumbers = useCallback(async () => {
    try {
      const data = await householdService.getAllNumbers();
      setHouseholdNumbers(data);
    } catch {
      notify.error("Failed to load household numbers.");
    }
  }, []);


  const loadHouseholdData = useCallback(async () => {
    setIsHouseholdsLoading(true);
    try {
      await Promise.all([
        fetchHouseholds(),
        fetchHouseholdNumbers(),
      ]);
    } finally {
      setIsHouseholdsLoading(false);
    }
  }, [fetchHouseholds, fetchHouseholdNumbers]);

  useHouseholdDataRefresh(loadHouseholdData);

  const fetchFamilyHeads = useCallback(async () => {
    try {
      const data = await familyService.getPrimaryHeads();
      setFamilyHeadOptions(data);
    } catch {
      notify.error("Failed to load family heads.");
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchResidents();
    loadHouseholdData();
    fetchFamilyHeads();
  }, [fetchResidents, loadHouseholdData, fetchFamilyHeads]);

  // Debounced backend search
  useEffect(() => {
    if (activeTab !== 0) return;
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        fetchResidents();
        return;
      }
      setIsLoading(true);
      try {
        const data = await residentService.search({ name: searchQuery });
        setResidents(data);
      } catch {
        notify.error("Search failed.");
      } finally {
        setIsLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, fetchResidents]);

  const handleOpenAddModal = (headId?: string) => {
    setPreselectedHeadId(headId);
    setPreselectedHouseholdId(undefined);
    setIsAddModalOpen(true);
  };

  const handleAddFamilyMemberFromDetail = () => {
    if (!activeHousehold) {
      notify.error("No active household selected.");
      return;
    }

    const primaryHeads = familyHeadOptions.filter(
      (head) => head.householdId === activeHousehold.HouseholdID,
    );

    if (primaryHeads.length === 0) {
      notify.error(
        "No primary family head found. Assign a primary head before adding members.",
      );
      return;
    }

    setSelectedFamilyHeadId(
      primaryHeads.length === 1 ? primaryHeads[0].id : "",
    );
    setIsHeadSelectOpen(true);
  };

  const handleSaveResident = async (
    rawData: Record<string, string | string[]>,
  ) => {
    const data = rawData as unknown as ResidentFormData;
    try {
      const selectedFamilyHead =
        data.householdRole === "member" && data.householdHeadId
          ? familyHeadOptions.find((head) => head.id === data.householdHeadId)
          : undefined;

      const selectedHouseholdId = (() => {
        if (data.householdRole === "member" && selectedFamilyHead) {
          return selectedFamilyHead.householdId;
        }

        if (data.householdRole === "member" && activeHousehold?.HouseholdID) {
          return activeHousehold.HouseholdID;
        }

        if (data.householdId !== undefined && data.householdId !== "") {
          const parsed = Number(data.householdId);
          return Number.isFinite(parsed) ? parsed : undefined;
        }

        if (data.householdNumber) {
          const found = households.find(
            (household) => household.householdNumber === data.householdNumber,
          );
          if (found) {
            return found.HouseholdID;
          }
          // If not found in existing households, look up HouseID from householdNumbers.
          // The backend's resolveOrCreateHousehold will create the Household row if needed.
          const hhNumber = householdNumbers.find(
            (hn) => hn.HouseholdNumberName === data.householdNumber,
          );
          if (hhNumber) {
            return hhNumber.HouseID;
          }
        }

        return undefined;
      })();

      const payload: CreateResidentData = {
        firstName: data.firstName,
        middleName: data.middleName || "",
        lastName: data.lastName,
        suffix: data.suffix || "",
        sex: data.sex,
        dateOfBirth: data.dateOfBirth || data.birthDate || data.dob || "",
        placeOfBirth: data.placeOfBirth || "",
        civilStatus: data.civilStatus || "",
        citizenship: data.citizenship || "",
        religion: data.religion || "",
        contactNumber: data.contactNumber || "",
        email: data.email || "",
        inhabitantType: data.inhabitantType || "Resident",
        mothersMaidenSurname:
          data.mothersMaidenSurname || data.mothersMaidenNameLast || "",
        mothersMaidenFirstName:
          data.mothersMaidenFirstName || data.mothersMaidenNameFirst || "",
        mothersMaidenMiddleName:
          data.mothersMaidenMiddleName || data.mothersMaidenNameMiddle || "",
        hasEducation: data.hasEducation === "yes" ? "yes" : "no",
        educationLevel: data.educationLevel || "",
        educationStatus: data.educationStatus || "",
        isEmployed: data.isEmployed === "yes" ? "yes" : "no",
        occupation: data.occupation || "",
        employmentStatus: data.employmentStatus || "",
        isVoter: data.isVoter === "yes" ? "yes" : "no",
        precinctNumber: data.precinctNumber || "",
        categories: Array.isArray(data.categories) ? data.categories : [],
        householdRole:
          data.householdRole === "head" || data.householdRole === "member"
            ? data.householdRole
            : undefined,
        occupancyStatus:
          data.householdRole === "head" &&
          (data.occupancyStatus === "Owner" ||
            data.occupancyStatus === "Renter" ||
            data.occupancyStatus === "Sharer" ||
            data.occupancyStatus === "Boarder")
            ? data.occupancyStatus
            : undefined,
        householdId: selectedHouseholdId,
        address: {
          unitRoomFloor: data.unitRoomFloor || data.unitRoom || "",
          buildingName: data.buildingName || data.building || "",
          lotBlockPhase: data.lotBlockPhase || data.lotBlock || "",
          houseNumber: data.houseNumber || data.householdNumber || "",
          street: data.street || "",
          barangay: data.barangay || "Barangay 619",
          municipality: data.municipality || data.city || "Manila",
        },
      };

      // Include family linking fields when adding as a family member
      if (data.householdRole === "member") {
        payload.householdHeadId = data.householdHeadId;
        payload.familyRole = data.familyRole || "Relative";
      }

      await residentService.create(payload);

      notify.success("Resident added successfully!");
      await fetchResidents();
      await fetchHouseholds();
      await fetchFamilyHeads();

      if (isFamilyDetailOpen && activeHousehold) {
        try {
          const records = await familyService.getByHousehold(
            activeHousehold.HouseholdID,
          );
          setFamilyRecords(records);
        } catch {
          notify.warn("Resident was added, but family list refresh failed.");
        }
      }

      setIsAddModalOpen(false);
      setPreselectedHeadId(undefined);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to add resident.";
      notify.error(message);
    }
  };

  const handleOpenArchiveDialog = (resident: ResidentListItem) => {
    setResidentToArchive(resident);
    setArchiveStatus(null);
    setArchiveDateOfDeath("");
    setIsArchiveDialogOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!residentToArchive || !archiveStatus) {
      return;
    }

    if (!window.confirm(`Are you sure you want to proceed with archiving ${residentToArchive.FirstName} ${residentToArchive.LastName} as ${archiveStatus}?`)) {
      return;
    }

    const normalizedStatus: "MovedOut" | "Deceased" =
      archiveStatus === "Moved Out" ? "MovedOut" : "Deceased";

    const payload: { status: "MovedOut" | "Deceased"; dateOfDeath?: string } =
      normalizedStatus === "Deceased"
        ? {
            status: normalizedStatus,
            dateOfDeath: archiveDateOfDeath,
          }
        : {
            status: normalizedStatus,
          };

    try {
      const result = await archiveService.archiveResident(
        residentToArchive.ResidentID,
        payload,
      );

      notify.success(result.message || "Resident archived successfully.");
      setIsArchiveDialogOpen(false);
      setArchiveStatus(null);
      setArchiveDateOfDeath("");
      setResidentToArchive(null);
      await fetchResidents();
      await fetchHouseholds();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to archive resident.";

      if (/household head/i.test(message)) {
        setIsArchiveDialogOpen(false);
        setIsHeadWarningOpen(true);
        return;
      }

      notify.error(message);
    }
  };

  const handleAddHousehold = async () => {
    const trimmedHouseholdNumber = newHouseholdNum.trim();
    const selectedStreet = (selectedHouseholdStreet || "").trim();

    if (!trimmedHouseholdNumber) {
      notify.error("Household number is required.");
      return;
    }

    if (!selectedStreet) {
      notify.error("Please select a street to link this household number.");
      return;
    }

    try {
      await householdService.createNumber({
        householdNumberName: trimmedHouseholdNumber,
        streetName: selectedStreet,
      });

      notify.success("Household number created successfully!");
      setNewHouseholdNum("");
      setSelectedHouseholdStreet("");
      setIsAddHouseholdOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create household number.";
      notify.error(message);
    }
  };

  const handleOpenEditHousehold = (houseId: number, currentName: string) => {
    setEditHouseholdId(houseId);
    setEditHouseholdName(currentName);
    setIsEditHouseholdOpen(true);
  };

  const handleSaveHouseholdName = async () => {
    if (!editHouseholdId || !editHouseholdName.trim()) {
      notify.error("Household number name is required.");
      return;
    }

    try {
      await householdService.updateNumberName(
        editHouseholdId,
        editHouseholdName.trim(),
      );
      notify.success("Household number name updated successfully!");
      setIsEditHouseholdOpen(false);
      setEditHouseholdId(null);
      setEditHouseholdName("");
      await loadHouseholdData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update household number name.";
      notify.error(message);
    }
  };

  const handleManageFamilyClick = async (
    event: React.MouseEvent<HTMLButtonElement>,
    household: HouseholdRegistryRow,
  ) => {
    if (!household.HouseholdID) {
      notify.info("This household number is not yet linked to a household.");
      return;
    }

    setFamilyAnchorEl(event.currentTarget);
    const matchedHousehold = households.find(
      (item) => item.HouseholdID === household.HouseholdID,
    );
    setActiveHousehold(
      matchedHousehold || {
        HouseholdID: household.HouseholdID,
        householdNumber: household.householdNumber,
        householdStatus: household.householdStatus,
        HouseNumber: household.householdNumber,
        Street_Alley_Zone: household.Street_Alley_Zone,
        Barangay: household.Barangay,
        memberCount: household.memberCount,
        familyCount: household.familyCount,
      },
    );
    setIsFamilyLoading(true);
    try {
      const records = await familyService.getByHousehold(household.HouseholdID);
      setFamilyRecords(records);
    } catch {
      notify.error("Failed to load family data.");
      setFamilyRecords([]);
    } finally {
      setIsFamilyLoading(false);
    }
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterMenuClose = (category?: string) => {
    if (typeof category === "string") {
      setSelectedCategory(category);
      setPage(1);
    }
    setFilterAnchorEl(null);
  };

  const handleViewFamilyDetail = (familyHeadId?: number) => {
    setFamilyPage(1);
    setSelectedFamilyGroupId(familyHeadId ?? null);
    setIsFamilyDetailOpen(true);
    setFamilyAnchorEl(null);
  };

  const handleSetNewHead = (record: FamilyRecord) => {
    setHeadTransferTarget(record);
  };

  const confirmHeadTransfer = async () => {
    if (!activeHousehold || !headTransferTarget) return;
    setHeadTransferTarget(null);

    // Find the current primary head's FamilyHeadID
    const currentHead = familyRecords.find(
      (r) =>
        r.HeadType === "Primary" &&
        r.RelationshipToFamilyHead === null &&
        r.FamilyHeadID === headTransferTarget.FamilyHeadID,
    );
    if (!currentHead) {
      notify.error("No current head found.");
      return;
    }

    try {
      await familyService.changeHead(
        activeHousehold.HouseholdID,
        currentHead.FamilyHeadID,
      );
      notify.success("Household head changed successfully!");
      // Refresh family data
      const records = await familyService.getByHousehold(
        activeHousehold.HouseholdID,
      );
      setFamilyRecords(records);
      await fetchHouseholds();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to change head.";
      notify.error(message);
    }
  };

  const filteredResidents =
    selectedCategory === "All"
      ? residents
      : residents.filter((resident) =>
          parseResidentCategories(resident.Categories).includes(
            selectedCategory,
          ),
        );

  const householdRegistryRows = useMemo<HouseholdRegistryRow[]>(() => {
    const householdsByNumber = new Map(
      households.map((household) => [household.householdNumber, household]),
    );

    return householdNumbers.map((householdNumber) => {
      const assignedHousehold = householdsByNumber.get(
        householdNumber.HouseholdNumberName,
      );

      return {
        HouseID: householdNumber.HouseID,
        HouseholdID: assignedHousehold?.HouseholdID,
        householdNumber: householdNumber.HouseholdNumberName,
        householdStatus: householdNumber.Status,
        Street_Alley_Zone:
          householdNumber.StreetName ||
          assignedHousehold?.Street_Alley_Zone ||
          "—",
        Barangay: assignedHousehold?.Barangay || "Barangay 619",
        memberCount: assignedHousehold?.memberCount || 0,
        familyCount: assignedHousehold?.familyCount || 0,
        hasHousehold: Boolean(assignedHousehold),
      };
    });
  }, [householdNumbers, households]);

  // Fixed street list for this barangay
  const streetOptions = useMemo(() => {
    return ["Batas", "Katwiran", "Lubiran"];
  }, []);

  const filteredHouseholds = householdRegistryRows.filter(
    (h) => {
      const matchesSearch =
        h.householdNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.Street_Alley_Zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.householdStatus.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStreet = selectedStreetFilter === "All" || h.Street_Alley_Zone === selectedStreetFilter;

      return matchesSearch && matchesStreet;
    }
  );

  const residentTotalPages = Math.max(
    1,
    Math.ceil(filteredResidents.length / rowsPerPage),
  );
  const householdTotalPages = Math.max(
    1,
    Math.ceil(filteredHouseholds.length / rowsPerPage),
  );

  const currentTotalPages =
    activeTab === 0 ? residentTotalPages : householdTotalPages;

  useEffect(() => {
    setPage(1);
  }, [activeTab, mainSortOrder]);

  useEffect(() => {
    if (page > currentTotalPages) {
      setPage(currentTotalPages);
    }
  }, [page, currentTotalPages]);

  const sortedResidents = [...filteredResidents].sort((a, b) =>
    mainSortOrder === "asc"
      ? a.ResidentID - b.ResidentID
      : b.ResidentID - a.ResidentID,
  );

  const sortedHouseholds = [...filteredHouseholds].sort((a, b) => {
    const compare = a.householdNumber.localeCompare(
      b.householdNumber,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      },
    );

    return mainSortOrder === "asc" ? compare : -compare;
  });

  const paginatedResidents = sortedResidents.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );

  const paginatedHouseholds = sortedHouseholds.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );

  // Deduplicate by ResidentID — prefer head entries over member entries,
  // and Primary over Secondary when multiple head rows exist.
  const dedupedFamilyRecords = useMemo(() => {
    const map = new Map<number, FamilyRecord>();
    for (const record of familyRecords) {
      const existing = map.get(record.ResidentID);
      if (!existing) {
        map.set(record.ResidentID, record);
      } else {
        // Prefer head entries (RelationshipToFamilyHead === null) over members
        const existingIsHead = existing.RelationshipToFamilyHead === null;
        const currentIsHead = record.RelationshipToFamilyHead === null;
        if (currentIsHead && !existingIsHead) {
          map.set(record.ResidentID, record);
        } else if (currentIsHead && existingIsHead) {
          // Both heads — prefer Primary over Secondary
          if (
            record.HeadType === "Primary" &&
            existing.HeadType !== "Primary"
          ) {
            map.set(record.ResidentID, record);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [familyRecords]);

  const activeFamilyHeads = useMemo(() => {
    if (!activeHousehold) {
      return [] as FamilyHeadOption[];
    }

    return familyHeadOptions.filter(
      (head) => head.householdId === activeHousehold.HouseholdID,
    );
  }, [activeHousehold, familyHeadOptions]);

  const householdFamilyMap = useMemo(() => {
    const map = new Map<number, FamilyHeadOption[]>();
    for (const head of familyHeadOptions) {
      const list = map.get(head.householdId) ?? [];
      list.push(head);
      map.set(head.householdId, list);
    }
    return map;
  }, [familyHeadOptions]);

  const familyGroups = useMemo(() => {
    const map = new Map<
      number,
      {
        label: string;
        familyHeadId: number;
        head: FamilyRecord | null;
        members: FamilyRecord[];
      }
    >();

    for (const record of familyRecords) {
      const group = map.get(record.FamilyHeadID) ?? {
        label: record.FamilyLabel || "Family",
        familyHeadId: record.FamilyHeadID,
        head: null,
        members: [] as FamilyRecord[],
      };

      if (record.RelationshipToFamilyHead === null) {
        group.head = record;
      } else {
        group.members.push(record);
      }

      map.set(record.FamilyHeadID, group);
    }

    return Array.from(map.values()).sort(
      (a, b) => a.familyHeadId - b.familyHeadId,
    );
  }, [familyRecords]);

  const familyGroupDisplayLabels = useMemo(() => {
    const map = new Map<number, string>();
    familyGroups.forEach((group, index) => {
      map.set(group.familyHeadId, toFamilyAlphabetLabel(index));
    });
    return map;
  }, [familyGroups]);

  const familyGroupSizes = useMemo(() => {
    const map = new Map<number, number>();
    for (const group of familyGroups) {
      const count = (group.head ? 1 : 0) + group.members.length;
      map.set(group.familyHeadId, count);
    }
    return map;
  }, [familyGroups]);

  const displayFamilyGroups = useMemo(() => {
    if (!selectedFamilyGroupId) {
      return familyGroups;
    }

    return familyGroups.filter(
      (group) => group.familyHeadId === selectedFamilyGroupId,
    );
  }, [familyGroups, selectedFamilyGroupId]);

  const flatFamilyRows = useMemo(() => {
    const rows: Array<
      | { type: "header"; label: string; familyHeadId: number }
      | { type: "member"; record: FamilyRecord }
    > = [];

    for (const group of displayFamilyGroups) {
      rows.push({
        type: "header",
        label: familyGroupDisplayLabels.get(group.familyHeadId) ?? group.label,
        familyHeadId: group.familyHeadId,
      });

      const sortedMembers = [...group.members].sort((a, b) => {
        const compareName = `${a.LastName} ${a.FirstName}`.localeCompare(
          `${b.LastName} ${b.FirstName}`,
          undefined,
          { sensitivity: "base" },
        );

        if (compareName !== 0) {
          return familySortOrder === "asc" ? compareName : -compareName;
        }

        const dateA = new Date(a.DateOfBirth).getTime();
        const dateB = new Date(b.DateOfBirth).getTime();
        return familySortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });

      if (group.head) {
        rows.push({ type: "member", record: group.head });
      }

      for (const member of sortedMembers) {
        rows.push({ type: "member", record: member });
      }
    }

    return rows;
  }, [displayFamilyGroups, familyGroupDisplayLabels, familySortOrder]);

  const familyTotalPages = Math.max(
    1,
    Math.ceil(flatFamilyRows.length / familyRowsPerPage),
  );

  useEffect(() => {
    setFamilyPage(1);
  }, [familySortOrder]);

  useEffect(() => {
    if (familyPage > familyTotalPages) {
      setFamilyPage(familyTotalPages);
    }
  }, [familyPage, familyTotalPages]);

  const paginatedFamilyRows = flatFamilyRows.slice(
    (familyPage - 1) * familyRowsPerPage,
    familyPage * familyRowsPerPage,
  );

  const memoizedFamilyHeadOptions = useMemo(
    () => familyHeadOptions,
    [familyHeadOptions],
  );

  return (
    <Box
      sx={{
        p: 4,
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#f3f4f6",
      }}
    >
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: "#2e0249", mb: 0.5 }}
          >
            Resident Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your local inhabitants and household registries.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          {activeTab === 1 && user?.role === "Admin" && (
            <Button
              variant="outlined"
              startIcon={<Home size={18} />}
              onClick={() => setIsAddHouseholdOpen(true)}
              sx={{
                borderRadius: 3,
                fontWeight: 700,
                px: 3,
                py: 1.2,
                borderColor: "#2e0249",
                color: "#2e0249",
                textTransform: "none",
                "&:hover": { borderColor: "#4a0475", bgcolor: "#f5f3ff" },
              }}
            >
              Add Household
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => handleOpenAddModal()}
            sx={{
              borderRadius: 3,
              fontWeight: 700,
              px: 4,
              py: 1.2,
              bgcolor: "#2e0249",
              textTransform: "none",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              "&:hover": { bgcolor: "#4a0475" },
            }}
          >
            Add Resident Record
          </Button>
        </Stack>
      </Box>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 4,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "white",
            px: 2,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                minHeight: 64,
                px: 4,
              },
              "& .Mui-selected": { color: "#2e0249" },
              "& .MuiTabs-indicator": { backgroundColor: "#2e0249", height: 3 },
            }}
          >
            <Tab
              icon={<Users size={20} />}
              iconPosition="start"
              label="Resident Registry"
            />
            <Tab
              icon={<Home size={20} />}
              iconPosition="start"
              label="Household Registry"
            />
          </Tabs>
        </Box>

        <Box
          sx={{
            p: 2.5,
            display: "flex",
            gap: 2,
            alignItems: "center",
            bgcolor: "white",
          }}
        >
          <TextField
            placeholder={
              activeTab === 0
                ? "Search resident by name..."
                : "Search household number..."
            }
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            sx={{
              width: 400,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                bgcolor: "#f9fafb",
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} className="text-gray-400" />
                </InputAdornment>
              ),
            }}
          />
          {activeTab === 0 && (
            <Button
              variant="outlined"
              onClick={handleFilterClick}
              startIcon={
                <Badge
                  variant="dot"
                  invisible={selectedCategory === "All"}
                  color="primary"
                >
                  <Filter size={18} />
                </Badge>
              }
              endIcon={<ChevronDown size={14} />}
              sx={{
                borderRadius: 2.5,
                px: 2.5,
                textTransform: "none",
                fontWeight: 600,
                borderColor: selectedCategory === "All" ? "#e5e7eb" : "#2e0249",
                color: selectedCategory === "All" ? "#64748b" : "#2e0249",
                bgcolor: selectedCategory === "All" ? "transparent" : "#f5f3ff",
              }}
            >
              {selectedCategory === "All"
                ? "Filter Options"
                : `Filtering: ${selectedCategory}`}
            </Button>
          )}
          
          {activeTab === 1 && (
            <Select
              value={selectedStreetFilter}
              onChange={(e) => {
                setSelectedStreetFilter(e.target.value);
                setPage(1);
              }}
              size="small"
              displayEmpty
              sx={{
                width: 200,
                borderRadius: 2.5,
                bgcolor: "#f9fafb",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
              }}
            >
              <MenuItem value="All">All Streets</MenuItem>
              {streetOptions.map((street) => (
                <MenuItem key={street} value={street}>
                  {street}
                </MenuItem>
              ))}
            </Select>
          )}

          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={() => setFilterAnchorEl(null)}
          >
            <MenuItem onClick={() => handleFilterMenuClose("All")}>
              All Residents
            </MenuItem>
            <Divider />
            {filterCategories.map((cat) => (
              <MenuItem key={cat} onClick={() => handleFilterMenuClose(cat)}>
                {cat}
              </MenuItem>
            ))}
          </Menu>
        </Box>

        <TableContainer
          sx={{ flex: 1, overflow: "auto", bgcolor: "white" }}
          className="custom-scrollbar"
        >
          {activeTab === 0 ? (
            <Table stickyHeader sx={{ tableLayout: "fixed", minWidth: 1020 }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "9%" }}
                  >
                    ID
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "26%" }}
                  >
                    FULL NAME
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "8%" }}
                  >
                    AGE
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "10%" }}
                  >
                    GENDER
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "12%" }}
                  >
                    STATUS
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "17%" }}
                  >
                    CATEGORIES
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "#f8fafc",
                      fontWeight: 800,
                      textAlign: "center",
                      width: "18%",
                    }}
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Loading residents...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : paginatedResidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No residents found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedResidents.map((resident) => (
                    <TableRow
                      key={resident.ResidentID}
                      hover
                      onClick={() => {
                        setSelectedResident(resident);
                        setIsResidentProfileOpen(true);
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{resident.ResidentID}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {resident.LastName}, {resident.FirstName}
                      </TableCell>
                      <TableCell>
                        {calculateAge(resident.DateOfBirth)}
                      </TableCell>
                      <TableCell>{resident.Sex}</TableCell>
                      <TableCell>
                        <Chip
                          label={resident.ResidentStatus}
                          size="small"
                          color={
                            resident.ResidentStatus === "Active"
                              ? "success"
                              : "default"
                          }
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}
                        >
                          {parseResidentCategories(resident.Categories).length >
                          0 ? (
                            parseResidentCategories(resident.Categories).map(
                              (category) => (
                                <Chip
                                  key={`${resident.ResidentID}-${category}`}
                                  label={category}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ fontWeight: 600 }}
                                />
                              ),
                            )
                          ) : (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              -
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                        >
                          <IconButton size="small" color="primary">
                            <Eye size={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenArchiveDialog(resident);
                            }}
                          >
                            <ArchiveIcon size={18} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table stickyHeader sx={{ tableLayout: "fixed", minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "24%" }}
                  >
                    HOUSEHOLD NAME
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "34%" }}
                  >
                    STREET
                  </TableCell>
                  <TableCell
                    sx={{ bgcolor: "#f8fafc", fontWeight: 800, width: "18%" }}
                  >
                    FAMILIES
                  </TableCell>
                  <TableCell
                    sx={{
                      bgcolor: "#f8fafc",
                      fontWeight: 800,
                      textAlign: "center",
                      width: "24%",
                    }}
                  >
                    ACTIONS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isHouseholdsLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Loading households...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filteredHouseholds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No households found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedHouseholds.map((hh) => {
                    const familyCount = hh.HouseholdID
                      ? (householdFamilyMap.get(hh.HouseholdID) ?? []).length
                      : 0;

                    return (
                      <TableRow key={hh.HouseID} hover>
                        <TableCell sx={{ fontWeight: 700, color: "#2e0249" }}>
                          {hh.householdNumber}
                        </TableCell>
                        <TableCell>
                          {hh.Street_Alley_Zone}
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                            sx={{ mt: 0.25 }}
                          >
                            {hh.householdStatus}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={String(familyCount)}
                            size="small"
                            sx={{ bgcolor: "#f3f4f6", fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="center"
                          >
                            <Tooltip title="Edit household number" arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleOpenEditHousehold(
                                      hh.HouseID,
                                      hh.householdNumber,
                                    )
                                  }
                                  sx={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 2,
                                    color: "#2e0249",
                                  }}
                                >
                                  <Pencil size={18} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Manage families" arrow>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!hh.HouseID}
                                  onClick={(e) =>
                                    handleManageFamilyClick(e, hh)
                                  }
                                  sx={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 2,
                                    color: "#2e0249",
                                    opacity: hh.HouseID ? 1 : 0.5,
                                  }}
                                >
                                  <UsersRound size={18} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid #e5e7eb",
            bgcolor: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <SortOrderToggle
            order={mainSortOrder}
            onToggle={() =>
              setMainSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            label="Sort"
          />
          <Pagination
            count={currentTotalPages}
            color="primary"
            shape="rounded"
            page={page}
            onChange={(_event, value) => setPage(value)}
          />
        </Box>
      </Paper>

      <AddResidentModal
        open={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setPreselectedHeadId(undefined);
          setPreselectedHouseholdId(undefined);
        }}
        onSave={handleSaveResident}
        initialHeadId={preselectedHeadId}
        initialHouseholdId={preselectedHouseholdId}
        householdOptions={householdNumbers.map((householdNumber) => {
          const matchedHousehold = households.find(
            (h) => h.householdNumber === householdNumber.HouseholdNumberName && h.HouseNumber
          );
          return {
            id: String(householdNumber.HouseID),
            number: householdNumber.HouseholdNumberName,
            street: matchedHousehold?.Street_Alley_Zone || householdNumber.StreetName || "",
            unitRoom: matchedHousehold?.Unit_RoomNo_Floor || "",
            building: matchedHousehold?.Building_Name || "",
            lotBlock: matchedHousehold?.Lot_Block_Phase_Num || "",
            barangay: matchedHousehold?.Barangay || "",
            city: matchedHousehold?.Municipality || "",
            hasAddress: !!matchedHousehold?.HouseNumber,
          };
        })}
        familyHeadOptions={memoizedFamilyHeadOptions}
      />
      <ResidentProfileModal
        open={isResidentProfileOpen}
        onClose={() => {
          setIsResidentProfileOpen(false);
          fetchResidents();
        }}
        residentId={selectedResident?.ResidentID}
        onUpdated={fetchResidents}
      />

      {/* Household Creation Dialog */}
      <Dialog
        open={isAddHouseholdOpen}
        onClose={() => setIsAddHouseholdOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Add New Household Registry
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Household Number"
              value={newHouseholdNum}
              onChange={(e) => setNewHouseholdNum(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Street</InputLabel>
              <Select
                value={selectedHouseholdStreet}
                label="Street"
                onChange={(e) => setSelectedHouseholdStreet(e.target.value)}
              >
                {streetOptions.length > 0 ? (
                  streetOptions.map((street) => (
                    <MenuItem key={street} value={street}>
                      {street}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>No street records available</MenuItem>
                )}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsAddHouseholdOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddHousehold}
            sx={{ bgcolor: "#2e0249" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Household Number Dialog */}
      <Dialog
        open={isEditHouseholdOpen}
        onClose={() => setIsEditHouseholdOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Edit Household Number
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Household Number Name"
            value={editHouseholdName}
            onChange={(e) => setEditHouseholdName(e.target.value)}
            sx={{ mt: 1, minWidth: 350 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsEditHouseholdOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveHouseholdName}
            sx={{ bgcolor: "#2e0249" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Head of Family Archive Warning */}
      <Dialog
        open={isHeadWarningOpen}
        onClose={() => setIsHeadWarningOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1, maxWidth: 450 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            color: "#991b1b",
          }}
        >
          <AlertTriangle size={24} /> Restricted Action
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 700 }}>
            Cannot archive{" "}
            <strong>
              {residentToArchive?.FirstName} {residentToArchive?.LastName}
            </strong>
            .
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This resident is currently designated as a{" "}
            <strong>Head of Family</strong>. You cannot archive a family head
            while there are other members in the family record.
          </Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: "#fff7ed",
              borderRadius: 2,
              border: "1px solid #ffedd5",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "#9a3412", fontWeight: 800 }}
            >
              REQUIRED STEP:
            </Typography>
            <Typography variant="body2" sx={{ color: "#9a3412", mt: 0.5 }}>
              Go to the <strong>Household Registry</strong>, find the relevant
              household, and transfer the headship to another active member
              before archiving this record.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setIsHeadWarningOpen(false)}
            sx={{ bgcolor: "#0f172a" }}
          >
            I Understand
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive Reason Dialog */}
      <Dialog
        open={isArchiveDialogOpen}
        onClose={() => {
          setIsArchiveDialogOpen(false);
          setArchiveStatus(null);
          setArchiveDateOfDeath("");
        }}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Archive Resident Record?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Reason for archiving{" "}
            <strong>
              {residentToArchive?.LastName}, {residentToArchive?.FirstName}
            </strong>
            :
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              fullWidth
              variant={archiveStatus === "Deceased" ? "contained" : "outlined"}
              color="error"
              startIcon={<Skull size={18} />}
              onClick={() => setArchiveStatus("Deceased")}
            >
              Deceased
            </Button>
            <Button
              fullWidth
              variant={archiveStatus === "Moved Out" ? "contained" : "outlined"}
              color="info"
              startIcon={<PlaneTakeoff size={18} />}
              onClick={() => setArchiveStatus("Moved Out")}
            >
              Moved Out
            </Button>
          </Box>
          {archiveStatus === "Deceased" && (
            <TextField
              fullWidth
              label="Date of Death"
              type="date"
              value={archiveDateOfDeath}
              onChange={(e) => setArchiveDateOfDeath(e.target.value)}
              sx={{ mt: 2 }}
              InputLabelProps={{ shrink: true }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setIsArchiveDialogOpen(false);
              setArchiveStatus(null);
              setArchiveDateOfDeath("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={
              !archiveStatus ||
              (archiveStatus === "Deceased" && !archiveDateOfDeath)
            }
            onClick={handleConfirmArchive}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Families Context Menu */}
      <Menu
        anchorEl={familyAnchorEl}
        open={Boolean(familyAnchorEl)}
        onClose={() => setFamilyAnchorEl(null)}
      >
        {isFamilyLoading ? (
          <MenuItem disabled sx={{ py: 1.5 }}>
            Loading...
          </MenuItem>
        ) : familyGroups.length === 0 ? (
          <MenuItem disabled sx={{ py: 1.5 }}>
            No family records
          </MenuItem>
        ) : (
          <Box sx={{ py: 0.5 }}>
            {familyGroups.map((group) => (
              <MenuItem
                key={group.familyHeadId}
                onClick={() => handleViewFamilyDetail(group.familyHeadId)}
                sx={{ py: 1 }}
              >
                <UsersRound size={16} style={{ marginRight: 8 }} />
                {familyGroupDisplayLabels.get(group.familyHeadId) ??
                  group.label}{" "}
                ({familyGroupSizes.get(group.familyHeadId) ?? 0})
              </MenuItem>
            ))}
          </Box>
        )}
      </Menu>

      {/* Family Head Selection Dialog */}
      <Dialog
        open={isHeadSelectOpen}
        onClose={() => setIsHeadSelectOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Select Family Head</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Family Head"
            value={selectedFamilyHeadId}
            onChange={(e) => setSelectedFamilyHeadId(e.target.value)}
            sx={{ mt: 1 }}
          >
            {activeFamilyHeads.map((head) => (
              <MenuItem key={head.id} value={head.id}>
                {head.familyLabel} - {head.name} ({head.householdNumber})
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsHeadSelectOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedFamilyHeadId}
            onClick={() => {
              setIsHeadSelectOpen(false);
              handleOpenAddModal(selectedFamilyHeadId);
            }}
            sx={{ bgcolor: "#2e0249" }}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Family Detail Dialog */}
      <Dialog
        open={isFamilyDetailOpen}
        onClose={() => setIsFamilyDetailOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 3,
            py: 2,
            bgcolor: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <UsersRound size={24} className="text-indigo-600" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Family Detail: {activeHousehold?.householdNumber}
              {selectedFamilyGroupId
                ? ` - ${
                    familyGroupDisplayLabels.get(selectedFamilyGroupId) ||
                    familyGroups.find(
                      (group) => group.familyHeadId === selectedFamilyGroupId,
                    )?.label ||
                    "Family"
                  }`
                : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={handleAddFamilyMemberFromDetail}
              sx={{
                textTransform: "none",
                borderRadius: 999,
                bgcolor: "#2e0249",
                fontWeight: 700,
                px: 2.5,
                py: 0.75,
                boxShadow: "0 6px 14px rgba(46, 2, 73, 0.18)",
                "&:hover": { bgcolor: "#4a0475" },
              }}
            >
              Add Family Member
            </Button>
            <IconButton
              onClick={() => setIsFamilyDetailOpen(false)}
              size="small"
            >
              <X size={20} />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: "#f8fafc" }}>
          <Box sx={{ p: 3, pt: 2 }}>
            <Box
              sx={{
                border: "1px solid #e2e8f0",
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "white",
              }}
            >
              <TableContainer sx={{ maxHeight: "55vh" }}>
                <Table
                  stickyHeader
                  sx={{ tableLayout: "fixed", minWidth: 760 }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: "#f8fafc",
                          width: "30%",
                        }}
                      >
                        NAME
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: "#f8fafc",
                          width: "18%",
                        }}
                      >
                        FAMILY
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: "#f8fafc",
                          width: "20%",
                        }}
                      >
                        ROLE
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: "#f8fafc",
                          width: "14%",
                        }}
                      >
                        AGE
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 800,
                          bgcolor: "#f8fafc",
                          width: "18%",
                        }}
                      >
                        ACTIONS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedFamilyRows.map((row) => {
                      if (row.type === "header") {
                        return (
                          <TableRow key={`family-${row.familyHeadId}`}>
                            <TableCell colSpan={5} sx={{ bgcolor: "#f8fafc" }}>
                              <Chip
                                label={row.label}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  bgcolor: "#ede9fe",
                                  color: "#4c1d95",
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const m = row.record;
                      const role =
                        m.RelationshipToFamilyHead === null
                          ? `Head (${m.HeadType})`
                          : m.RelationshipToFamilyHead;
                      const isHead = m.RelationshipToFamilyHead === null;
                      const isPrimary = isHead && m.HeadType === "Primary";
                      const groupSize =
                        familyGroupSizes.get(m.FamilyHeadID) ?? 0;

                      return (
                        <TableRow
                          key={`${m.FamilyHeadID}-${m.ResidentID}`}
                          hover
                        >
                          <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              {isPrimary && (
                                <Crown size={14} className="text-amber-500" />
                              )}
                              {m.FirstName} {m.LastName}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                familyGroupDisplayLabels.get(m.FamilyHeadID) ||
                                m.FamilyLabel ||
                                "Family"
                              }
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                bgcolor: "#ede9fe",
                                color: "#4c1d95",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={role}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                bgcolor: isPrimary
                                  ? "#fef3c7"
                                  : isHead
                                    ? "#e0f2fe"
                                    : "#f3f4f6",
                                color: isPrimary
                                  ? "#92400e"
                                  : isHead
                                    ? "#0369a1"
                                    : "#64748b",
                              }}
                            />
                          </TableCell>
                          <TableCell>{calculateAge(m.DateOfBirth)}</TableCell>
                          <TableCell align="center">
                            {!isPrimary && groupSize > 1 ? (
                              <Tooltip title="Set as Head of Family">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleSetNewHead(m)}
                                  sx={{ "&:hover": { bgcolor: "#eff6ff" } }}
                                >
                                  <UserCheck size={18} />
                                </IconButton>
                              </Tooltip>
                            ) : isPrimary ? (
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 800, color: "#92400e" }}
                              >
                                Current Head
                              </Typography>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                  px: 2,
                  py: 1.5,
                  borderTop: "1px solid #f1f5f9",
                  bgcolor: "#f8fafc",
                }}
              >
                <SortOrderToggle
                  order={familySortOrder}
                  onToggle={() =>
                    setFamilySortOrder((prev) =>
                      prev === "asc" ? "desc" : "asc",
                    )
                  }
                  label="Sort"
                />
                <Pagination
                  count={familyTotalPages}
                  color="primary"
                  shape="rounded"
                  page={familyPage}
                  onChange={(_event, value) => setFamilyPage(value)}
                />
              </Box>
            </Box>
          </Box>
          {dedupedFamilyRecords.length > 1 && (
            <Box
              sx={{
                mx: 3,
                mb: 3,
                p: 2,
                bgcolor: "#fffbeb",
                borderRadius: 2,
                border: "1px solid #fef3c7",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "#92400e",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Info size={14} /> Click the checkmark icon to transfer
                headship. The system will automatically assign the next oldest
                active member.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Head Transfer Confirmation Dialog */}
      <Dialog
        open={Boolean(headTransferTarget)}
        onClose={() => setHeadTransferTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            pb: 1,
          }}
        >
          <AlertTriangle size={22} className="text-amber-500" />
          Confirm Head Transfer
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#475569" }}>
            Are you sure you want to set{" "}
            <Box component="span" sx={{ fontWeight: 700, color: "#1e293b" }}>
              {headTransferTarget?.FirstName} {headTransferTarget?.LastName}
            </Box>{" "}
            as the new Head of Family? The current head will be demoted to a
            regular family member.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setHeadTransferTarget(null)}
            variant="outlined"
            sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmHeadTransfer}
            variant="contained"
            sx={{
              textTransform: "none",
              borderRadius: 2,
              fontWeight: 700,
              bgcolor: "#2e0249",
              "&:hover": { bgcolor: "#4a0475" },
            }}
          >
            Confirm Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResidentRecords;
