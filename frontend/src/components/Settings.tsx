import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  IconButton,
  Avatar,
  Grid,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  InputAdornment,
  Pagination,
} from "@mui/material";
import {
  Edit2,
  Save,
  X,
  Camera,
  Building2,
  Plus,
  Eye,
  Trash2,
  Calendar,
  ShieldCheck,
  UserPlus,
  History,
  Search,
  PowerOff,
  CheckCircle,
  Filter,
  Monitor,
} from "lucide-react";
import { residentService } from "../services/residentService";
import { officialService, type OfficialApi } from "../services/officialService";
import {
  userAccountService,
  type UserAccountApi,
} from "../services/userAccountService";
import { barangayInfoService } from "../services/barangayInfoService";
import { notify } from "../utils/notify";
import { useBarangayLogo } from "../hooks/useBarangayLogo";
import SortOrderToggle, { type SortOrder } from "./SortOrderToggle";
import type { ResidentListItem } from "../types";
import { useAuth } from "../hooks/useAuth";
import DataImportTab from "./DataImportTab";

interface BarangayInfoForm {
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  telephone: string;
  email: string;
}

interface SystemInfo {
  name: string;
  description: string;
  version: string;
}

interface Official {
  id: number;
  residentId: number;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  status: "Active" | "Former";
  imageUrl?: string;
  termStart?: string;
  termEnd?: string;
}

interface UserAccount {
  id: number;
  name: string;
  username: string;
  role: "Admin" | "Staff";
  status: "Active" | "Inactive";
  lastLogin?: string;
}

interface UserFormData {
  name: string;
  username: string;
  role: "Admin" | "Staff";
  status: "Active" | "Inactive";
}

interface ResidentOption {
  id: number;
  name: string;
}

const DEFAULT_BARANGAY_INFO: BarangayInfoForm = {
  name: "Barangay 619",
  city: "Manila",
  district: "Sampaloc",
  address:
    "Bata Street, Barangay 619, Zone 62, Bacood, Santa Mesa, Manila City, 1000, Metro Manila, Philippines",
  phone: "",
  telephone: "",
  email: "",
};

const INITIAL_SYSTEM_INFO: SystemInfo = {
  name: "Local-Based Resident Record Management System",
  description:
    "The Local-Based Resident Record Management System is a digital platform designed to store and manage essential information about residents within Barangay 619. It allows authorized personnel to efficiently access and update resident records, ensuring accurate and organized data for internal administrative use. The system improves efficiency by centralizing information in a secure platform, making resident data management easier and more reliable.",
  version: "1.0",
};

const OFFICIAL_POSITIONS = [
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

const OFFICIAL_STATUSES: Array<"Active" | "Former"> = ["Active", "Former"];

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return message || fallback;
};

const normalizeRoleLabel = (role: string): "Admin" | "Staff" => {
  return role.toLowerCase() === "admin" ? "Admin" : "Staff";
};

const formatOfficialTermDate = (value?: string | null): string => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const mapOfficialApiToUi = (official: OfficialApi): Official => ({
  id: official.OfficialID,
  residentId: official.ResidentID,
  firstName: official.FirstName,
  lastName: official.LastName,
  name: `Hon. ${official.FirstName} ${official.LastName}`,
  position: official.Position,
  status: official.BStatus,
  termStart: official.TermStart || undefined,
  termEnd: official.TermEnd || undefined,
  imageUrl: undefined,
});

const formatLastLogin = (value: string | null): string => {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Never";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const mapUserApiToUi = (user: UserAccountApi): UserAccount => ({
  id: user.UserID,
  name: user.Username,
  username: user.Username,
  role: normalizeRoleLabel(user.Role),
  status: user.AccStatus,
  lastLogin: formatLastLogin(user.LastLogin),
});

const Settings: React.FC = () => {
  const { logoSrc, setLogoSrc } = useBarangayLogo();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const { user: authUser } = useAuth();

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [barangayInfo, setBarangayInfo] = useState<BarangayInfoForm>(
    DEFAULT_BARANGAY_INFO,
  );
  const [savedBarangayInfo, setSavedBarangayInfo] = useState<BarangayInfoForm>(
    DEFAULT_BARANGAY_INFO,
  );
  const [isGeneralLoading, setIsGeneralLoading] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [isEditingSystem, setIsEditingSystem] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo>(INITIAL_SYSTEM_INFO);

  const [officials, setOfficials] = useState<Official[]>([]);
  const [isOfficialsLoading, setIsOfficialsLoading] = useState(false);
  const [isOfficialsSubmitting, setIsOfficialsSubmitting] = useState(false);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isUsersSubmitting, setIsUsersSubmitting] = useState(false);
  const [officialsPage, setOfficialsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [officialsSortOrder, setOfficialsSortOrder] =
    useState<SortOrder>("asc");
  const [usersSortOrder, setUsersSortOrder] = useState<SortOrder>("asc");
  const officialsRowsPerPage = 10;
  const usersRowsPerPage = 10;

  const [residentOptions, setResidentOptions] = useState<ResidentOption[]>([]);
  const [isResidentsLoading, setIsResidentsLoading] = useState(false);

  const [isAddOfficialOpen, setIsAddOfficialOpen] = useState(false);
  const [isViewOfficialOpen, setIsViewOfficialOpen] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<Official | null>(
    null,
  );
  const [isEditingOfficial, setIsEditingOfficial] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("All");
  const [userFormData, setUserFormData] = useState<UserFormData>({
    name: "",
    username: "",
    role: "Staff",
    status: "Active",
  });
  const [userPassword, setUserPassword] = useState("");

  const [newOfficialResident, setNewOfficialResident] =
    useState<ResidentOption | null>(null);
  const [newOfficialPosition, setNewOfficialPosition] = useState("");
  const [newOfficialTermStart, setNewOfficialTermStart] = useState("");
  const [newOfficialTermEnd, setNewOfficialTermEnd] = useState("");

  const [editOfficialData, setEditOfficialData] = useState<Official | null>(
    null,
  );

  const fetchBarangayInfo = useCallback(async () => {
    setIsGeneralLoading(true);
    try {
      const info = await barangayInfoService.getInfo();
      const mapped: BarangayInfoForm = {
        ...DEFAULT_BARANGAY_INFO,
        address: info.BarangayAddress || DEFAULT_BARANGAY_INFO.address,
        phone: info.PhoneNum || "",
        telephone: info.TelNum || "",
        email: info.EmailAd || "",
      };
      setBarangayInfo(mapped);
      setSavedBarangayInfo(mapped);
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        "Failed to load barangay information.",
      );

      if (message.toLowerCase().includes("not configured")) {
        setBarangayInfo(DEFAULT_BARANGAY_INFO);
        setSavedBarangayInfo(DEFAULT_BARANGAY_INFO);
        notify.info("Barangay information is not configured yet.");
      } else {
        notify.error(message);
      }
    } finally {
      setIsGeneralLoading(false);
    }
  }, []);

  const fetchOfficials = useCallback(async () => {
    setIsOfficialsLoading(true);
    try {
      const data = await officialService.getAll();
      setOfficials(data.map(mapOfficialApiToUi));
    } catch {
      notify.error("Failed to load officials.");
    } finally {
      setIsOfficialsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsUsersLoading(true);
    try {
      const data = await userAccountService.getAll();
      setUsers(data.map(mapUserApiToUi));
    } catch {
      notify.error("Failed to load user accounts.");
    } finally {
      setIsUsersLoading(false);
    }
  }, []);

  const fetchResidents = useCallback(async () => {
    setIsResidentsLoading(true);
    try {
      const data = await residentService.getAll();
      const options = data
        .map((resident: ResidentListItem) => ({
          id: resident.ResidentID,
          name: `${resident.LastName}, ${resident.FirstName}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setResidentOptions(options);
    } catch {
      notify.error("Failed to load residents.");
    } finally {
      setIsResidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBarangayInfo();
    fetchOfficials();
    fetchUsers();
    fetchResidents();
  }, [fetchBarangayInfo, fetchOfficials, fetchUsers, fetchResidents]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setOfficialsPage(1);
    setUsersPage(1);
  };

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarangayInfo({ ...barangayInfo, [e.target.name]: e.target.value });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      notify.error("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const loadedResult =
        typeof reader.result === "string" ? reader.result : "";

      if (!loadedResult) {
        notify.error("Failed to load selected logo image.");
        return;
      }

      setLogoSrc(loadedResult);
      notify.success("Barangay logo updated successfully.");
    };

    reader.onerror = () => {
      notify.error("Failed to load selected logo image.");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const saveInfo = async () => {
    setIsSavingInfo(true);
    try {
      await barangayInfoService.updateInfo({
        phoneNum: barangayInfo.phone || null,
        telNum: barangayInfo.telephone || null,
        emailAd: barangayInfo.email || null,
        barangayAddress: barangayInfo.address || null,
      });
      setSavedBarangayInfo(barangayInfo);
      setIsEditingInfo(false);
      notify.success("Barangay details updated successfully.");
    } catch (error: unknown) {
      notify.error(
        getApiErrorMessage(error, "Failed to update barangay info."),
      );
    } finally {
      setIsSavingInfo(false);
    }
  };

  const cancelInfo = () => {
    setBarangayInfo(savedBarangayInfo);
    setIsEditingInfo(false);
  };

  const handleSystemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSystemInfo({ ...systemInfo, [e.target.name]: e.target.value });
  };

  const saveSystem = () => {
    setIsEditingSystem(false);
    notify.success("System info updated.");
  };

  const cancelSystem = () => setIsEditingSystem(false);

  const handleAddClick = () => {
    setNewOfficialResident(null);
    setNewOfficialPosition("");
    setNewOfficialTermStart("");
    setNewOfficialTermEnd("");
    setIsAddOfficialOpen(true);
  };

  const handleSaveNewOfficial = async () => {
    if (!newOfficialResident || !newOfficialPosition || !newOfficialTermStart) {
      notify.error("Resident, position, and term start are required.");
      return;
    }

    setIsOfficialsSubmitting(true);
    try {
      await officialService.create({
        residentId: newOfficialResident.id,
        position: newOfficialPosition,
        termStart: newOfficialTermStart,
        termEnd: newOfficialTermEnd || null,
      });
      notify.success("Official added successfully.");
      setIsAddOfficialOpen(false);
      await fetchOfficials();
    } catch (error: unknown) {
      notify.error(getApiErrorMessage(error, "Failed to add official."));
    } finally {
      setIsOfficialsSubmitting(false);
    }
  };

  const handleViewOfficial = (official: Official) => {
    setSelectedOfficial(official);
    setEditOfficialData({ ...official });
    setIsEditingOfficial(false);
    setIsViewOfficialOpen(true);
  };

  const handleUpdateOfficial = async () => {
    if (!editOfficialData) return;

    setIsOfficialsSubmitting(true);
    try {
      await officialService.update(editOfficialData.id, {
        position: editOfficialData.position,
        termStart: editOfficialData.termStart,
        termEnd: editOfficialData.termEnd || null,
        bStatus: editOfficialData.status,
      });
      notify.success("Official updated successfully.");
      setSelectedOfficial({ ...editOfficialData });
      setIsEditingOfficial(false);
      await fetchOfficials();
    } catch (error: unknown) {
      notify.error(getApiErrorMessage(error, "Failed to update official."));
    } finally {
      setIsOfficialsSubmitting(false);
    }
  };

  const handleDeleteOfficial = async (id: number) => {
    setIsOfficialsSubmitting(true);
    try {
      await officialService.update(id, { bStatus: "Former" });
      notify.success("Official marked as former.");
      setIsViewOfficialOpen(false);
      setSelectedOfficial(null);
      setEditOfficialData(null);
      await fetchOfficials();
    } catch (error: unknown) {
      notify.error(
        getApiErrorMessage(error, "Failed to update official status."),
      );
    } finally {
      setIsOfficialsSubmitting(false);
    }
  };

  const handleOpenUserModal = (user?: UserAccount) => {
    if (user) {
      setSelectedUser(user);
      setUserFormData({
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
      });
    } else {
      setSelectedUser(null);
      setUserFormData({
        name: "",
        username: "",
        role: "Staff",
        status: "Active",
      });
    }
    setUserPassword("");
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    const trimmedUsername = userFormData.username.trim();

    if (!trimmedUsername) {
      notify.error("Username is required.");
      return;
    }

    if (!selectedUser && !userPassword.trim()) {
      notify.error("Password is required for new accounts.");
      return;
    }

    setIsUsersSubmitting(true);
    try {
      if (selectedUser) {
        const updatePayload: {
          username?: string;
          password?: string;
          role?: "Admin" | "Staff";
        } = {};

        if (trimmedUsername !== selectedUser.username) {
          updatePayload.username = trimmedUsername;
        }

        if (userFormData.role !== selectedUser.role) {
          updatePayload.role = userFormData.role;
        }

        if (userPassword.trim()) {
          updatePayload.password = userPassword.trim();
        }

        if (Object.keys(updatePayload).length > 0) {
          await userAccountService.update(selectedUser.id, updatePayload);
        }

        if (userFormData.status !== selectedUser.status) {
          await userAccountService.updateStatus(
            selectedUser.id,
            userFormData.status,
          );
        }

        notify.success("User account updated successfully.");
      } else {
        const created = await userAccountService.create({
          username: trimmedUsername,
          password: userPassword.trim(),
          role: userFormData.role,
        });

        if (userFormData.status === "Inactive") {
          await userAccountService.updateStatus(created.userId, "Inactive");
        }

        notify.success("User account created successfully.");
      }

      setIsUserModalOpen(false);
      await fetchUsers();
    } catch (error: unknown) {
      notify.error(getApiErrorMessage(error, "Failed to save user account."));
    } finally {
      setIsUsersSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (id: number) => {
    const targetUser = users.find((user) => user.id === id);
    if (!targetUser) return;

    const nextStatus = targetUser.status === "Active" ? "Inactive" : "Active";

    try {
      await userAccountService.updateStatus(id, nextStatus);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, status: nextStatus } : user,
        ),
      );
      notify.success(
        `Account ${nextStatus === "Active" ? "activated" : "deactivated"}.`,
      );
    } catch (error: unknown) {
      notify.error(
        getApiErrorMessage(error, "Failed to update account status."),
      );
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(userSearchQuery.toLowerCase());
      const matchesStatus =
        userStatusFilter === "All" || user.status === userStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [users, userSearchQuery, userStatusFilter]);

  const officialsTotalPages = Math.max(
    1,
    Math.ceil(officials.length / officialsRowsPerPage),
  );
  const sortedOfficials = [...officials].sort((a, b) => {
    const statusRank = (status: Official["status"]) =>
      status === "Active" ? 0 : 1;
    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff !== 0) return statusDiff;
    const compare = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
    return officialsSortOrder === "asc" ? compare : -compare;
  });

  const paginatedOfficials = sortedOfficials.slice(
    (officialsPage - 1) * officialsRowsPerPage,
    officialsPage * officialsRowsPerPage,
  );

  const usersTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / usersRowsPerPage),
  );
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const compare = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
    return usersSortOrder === "asc" ? compare : -compare;
  });

  const paginatedUsers = sortedUsers.slice(
    (usersPage - 1) * usersRowsPerPage,
    usersPage * usersRowsPerPage,
  );

  useEffect(() => {
    setOfficialsPage(1);
  }, [officialsSortOrder]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersSortOrder]);

  useEffect(() => {
    if (officialsPage > officialsTotalPages) {
      setOfficialsPage(officialsTotalPages);
    }
  }, [officialsPage, officialsTotalPages]);

  useEffect(() => {
    if (usersPage > usersTotalPages) {
      setUsersPage(usersTotalPages);
    }
  }, [usersPage, usersTotalPages]);

  return (
    <Box
      sx={{
        p: 4,
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: "#2e0249", mb: 1 }}
        >
          System Settings
        </Typography>
        <Typography variant="body1" sx={{ color: "#64748b" }}>
          Manage your barangay information, official roster, and system user
          accounts.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRadius: 3,
          border: "1px solid #e0e0e0",
          overflow: "hidden",
          bgcolor: "#f8fafc",
        }}
      >
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "white",
            px: 3,
            pt: 2,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: "bold",
                fontSize: "1rem",
                minHeight: 48,
              },
            }}
          >
            <Tab label="General" />
            <Tab label="Barangay Officials" />
            <Tab label="User Accounts" />
            <Tab label="Import Data" />
          </Tabs>
        </Box>

        {activeTab === 0 && (
          <Box sx={{ p: 4, overflowY: "auto", flex: 1 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 8 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "white",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 4,
                    }}
                  >
                    <Box sx={{ flexShrink: 0 }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight="bold"
                        sx={{ mb: 2, color: "#1f2937" }}
                      >
                        Barangay Logo
                      </Typography>
                      <Box
                        sx={{
                          position: "relative",
                          width: "fit-content",
                          mx: { xs: "auto", sm: "0" },
                        }}
                      >
                        <Avatar
                          src={logoSrc}
                          sx={{
                            width: 160,
                            height: 160,
                            border: "4px solid #f8fafc",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <IconButton
                          onClick={() => logoInputRef.current?.click()}
                          sx={{
                            position: "absolute",
                            bottom: 8,
                            right: 8,
                            bgcolor: "white",
                            border: "1px solid #e5e7eb",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            "&:hover": { bgcolor: "#f3f4f6" },
                          }}
                          disabled={isGeneralLoading || isSavingInfo}
                        >
                          <Camera size={16} className="text-gray-600" />
                        </IconButton>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={handleLogoUpload}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          mb: 3,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                          }}
                        >
                          <Building2 size={20} className="text-indigo-600" />
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            color="#1f2937"
                          >
                            Barangay Details
                          </Typography>
                        </Box>
                        {!isEditingInfo ? (
                          <IconButton
                            size="small"
                            onClick={() => setIsEditingInfo(true)}
                            sx={{ bgcolor: "#f1f5f9" }}
                            disabled={isGeneralLoading}
                          >
                            <Edit2 size={16} />
                          </IconButton>
                        ) : (
                          <Box>
                            <Button
                              size="small"
                              onClick={cancelInfo}
                              sx={{
                                mr: 1,
                                color: "#6b7280",
                                textTransform: "none",
                              }}
                              disabled={isSavingInfo}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={saveInfo}
                              startIcon={<Save size={16} />}
                              sx={{ textTransform: "none" }}
                              disabled={isSavingInfo}
                            >
                              {isSavingInfo ? "Saving..." : "Save"}
                            </Button>
                          </Box>
                        )}
                      </Box>

                      {isGeneralLoading ? (
                        <Typography color="text.secondary">
                          Loading barangay info...
                        </Typography>
                      ) : (
                        <Box
                          component="form"
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          {isEditingInfo ? (
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 12 }}>
                                <TextField
                                  fullWidth
                                  label="Barangay Name"
                                  name="name"
                                  value={barangayInfo.name}
                                  onChange={handleInfoChange}
                                  size="small"
                                  disabled
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                  fullWidth
                                  label="District"
                                  name="district"
                                  value={barangayInfo.district}
                                  onChange={handleInfoChange}
                                  size="small"
                                  disabled
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                  fullWidth
                                  label="City / Municipality"
                                  name="city"
                                  value={barangayInfo.city}
                                  onChange={handleInfoChange}
                                  size="small"
                                  disabled
                                />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={2}
                                  label="Address"
                                  name="address"
                                  value={barangayInfo.address}
                                  onChange={handleInfoChange}
                                  size="small"
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Phone Number"
                                  name="phone"
                                  value={barangayInfo.phone}
                                  onChange={handleInfoChange}
                                  size="small"
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Telephone Number"
                                  name="telephone"
                                  value={barangayInfo.telephone}
                                  onChange={handleInfoChange}
                                  size="small"
                                />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <TextField
                                  fullWidth
                                  label="Email Address"
                                  name="email"
                                  value={barangayInfo.email}
                                  onChange={handleInfoChange}
                                  size="small"
                                />
                              </Grid>
                            </Grid>
                          ) : (
                            <Stack spacing={2.5}>
                              <Box display="flex" flexDirection="column">
                                <Typography
                                  variant="caption"
                                  fontWeight="bold"
                                  sx={{
                                    color: "#94a3b8",
                                    textTransform: "uppercase",
                                    mb: 0.5,
                                  }}
                                >
                                  Barangay Name
                                </Typography>
                                <Typography color="#1e293b" fontWeight="600">
                                  {barangayInfo.name}
                                </Typography>
                              </Box>
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 6 }}>
                                  <Typography
                                    variant="caption"
                                    fontWeight="bold"
                                    sx={{
                                      color: "#94a3b8",
                                      textTransform: "uppercase",
                                      mb: 0.5,
                                    }}
                                  >
                                    City / Municipality
                                  </Typography>
                                  <Typography color="#1e293b" fontWeight="600">
                                    {barangayInfo.city}
                                  </Typography>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <Typography
                                    variant="caption"
                                    fontWeight="bold"
                                    sx={{
                                      color: "#94a3b8",
                                      textTransform: "uppercase",
                                      mb: 0.5,
                                    }}
                                  >
                                    District
                                  </Typography>
                                  <Typography color="#1e293b" fontWeight="600">
                                    {barangayInfo.district}
                                  </Typography>
                                </Grid>
                              </Grid>
                              <Box display="flex" flexDirection="column">
                                <Typography
                                  variant="caption"
                                  fontWeight="bold"
                                  sx={{
                                    color: "#94a3b8",
                                    textTransform: "uppercase",
                                    mb: 0.5,
                                  }}
                                >
                                  Official Address
                                </Typography>
                                <Typography color="#1e293b" fontWeight="600">
                                  {barangayInfo.address || "N/A"}
                                </Typography>
                              </Box>
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 6 }}>
                                  <Typography
                                    variant="caption"
                                    fontWeight="bold"
                                    sx={{
                                      color: "#94a3b8",
                                      textTransform: "uppercase",
                                      mb: 0.5,
                                    }}
                                  >
                                    Mobile Number
                                  </Typography>
                                  <Typography color="#1e293b" fontWeight="600">
                                    {barangayInfo.phone || "N/A"}
                                  </Typography>
                                </Grid>
                                <Grid size={{ xs: 6 }}>
                                  <Typography
                                    variant="caption"
                                    fontWeight="bold"
                                    sx={{
                                      color: "#94a3b8",
                                      textTransform: "uppercase",
                                      mb: 0.5,
                                    }}
                                  >
                                    Telephone
                                  </Typography>
                                  <Typography color="#1e293b" fontWeight="600">
                                    {barangayInfo.telephone || "N/A"}
                                  </Typography>
                                </Grid>
                              </Grid>
                              <Box display="flex" flexDirection="column">
                                <Typography
                                  variant="caption"
                                  fontWeight="bold"
                                  sx={{
                                    color: "#94a3b8",
                                    textTransform: "uppercase",
                                    mb: 0.5,
                                  }}
                                >
                                  Email Address
                                </Typography>
                                <Typography color="#1e293b" fontWeight="600">
                                  {barangayInfo.email || "N/A"}
                                </Typography>
                              </Box>
                            </Stack>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    border: "1px solid #e2e8f0",
                    bgcolor: "white",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 3,
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <Monitor size={20} className="text-indigo-600" />
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        color="#1f2937"
                      >
                        System Info
                      </Typography>
                    </Box>

                    {!isEditingSystem ? (
                      <IconButton
                        size="small"
                        onClick={() => setIsEditingSystem(true)}
                        sx={{ bgcolor: "#f1f5f9" }}
                      >
                        <Edit2 size={16} />
                      </IconButton>
                    ) : (
                      <Box>
                        <Button
                          size="small"
                          onClick={cancelSystem}
                          sx={{
                            mr: 1,
                            color: "#6b7280",
                            textTransform: "none",
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={saveSystem}
                          startIcon={<Save size={16} />}
                          sx={{ textTransform: "none" }}
                        >
                          Save
                        </Button>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    {isEditingSystem ? (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            fullWidth
                            label="System Name"
                            name="name"
                            value={systemInfo.name}
                            onChange={handleSystemChange}
                            size="small"
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={8}
                            label="System Description"
                            name="description"
                            value={systemInfo.description}
                            onChange={handleSystemChange}
                            size="small"
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            fullWidth
                            label="Version"
                            name="version"
                            value={systemInfo.version}
                            onChange={handleSystemChange}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    ) : (
                      <Stack spacing={3.5}>
                        <Box>
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            sx={{
                              color: "#94a3b8",
                              textTransform: "uppercase",
                              mb: 1,
                              display: "block",
                            }}
                          >
                            System Name
                          </Typography>
                          <Typography
                            variant="body1"
                            color="#1e293b"
                            fontWeight="700"
                            sx={{ lineHeight: 1.3 }}
                          >
                            {systemInfo.name}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="caption"
                            fontWeight="bold"
                            sx={{
                              color: "#94a3b8",
                              textTransform: "uppercase",
                              mb: 1,
                              display: "block",
                            }}
                          >
                            About This System
                          </Typography>
                          <Typography
                            variant="body2"
                            color="#475569"
                            sx={{ lineHeight: 1.6, textAlign: "justify" }}
                          >
                            {systemInfo.description}
                          </Typography>
                        </Box>
                        <Box sx={{ mt: "auto" }}>
                          <Chip
                            label={`Version ${systemInfo.version}`}
                            size="small"
                            sx={{
                              fontWeight: "bold",
                              bgcolor: "#f1f5f9",
                              color: "#475569",
                              borderRadius: 1.5,
                            }}
                          />
                        </Box>
                      </Stack>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {activeTab === 1 && (
          <Box
            sx={{
              p: 5,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 4,
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight="bold" color="#1f2937">
                  Current Officials
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage the list of current barangay officials.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Plus size={20} />}
                onClick={handleAddClick}
                sx={{
                  textTransform: "none",
                  fontWeight: "bold",
                  bgcolor: "#2e0249",
                  "&:hover": { bgcolor: "#4a0475" },
                }}
              >
                Add Official
              </Button>
            </Box>

            <TableContainer
              component={Paper}
              elevation={0}
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              <Table sx={{ tableLayout: "fixed", minWidth: 880 }}>
                <TableHead sx={{ bgcolor: "#f8fafc" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold", width: "80px" }}>
                      Photo
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "32%" }}>
                      Name
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "28%" }}>
                      Position
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "140px" }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "28%" }}>
                      Term
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: "bold", width: "100px" }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isOfficialsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="body1" color="text.secondary">
                          Loading officials...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : officials.length > 0 ? (
                    paginatedOfficials.map((official) => (
                      <TableRow key={official.id} hover>
                        <TableCell>
                          <Avatar
                            src={official.imageUrl}
                            sx={{ width: 40, height: 40, bgcolor: "#e2e8f0" }}
                          >
                            {official.firstName.charAt(0)}
                          </Avatar>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          {official.name}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {official.position}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={official.status}
                            size="small"
                            color={
                              official.status === "Active"
                                ? "success"
                                : "default"
                            }
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{ color: "text.secondary", fontSize: "0.875rem" }}
                        >
                          {formatOfficialTermDate(official.termStart)} -{" "}
                          {formatOfficialTermDate(official.termEnd)}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Eye size={16} />}
                            onClick={() => handleViewOfficial(official)}
                            sx={{ textTransform: "none" }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="body1" color="text.secondary">
                          No officials found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
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
                pt: 2,
              }}
            >
              <SortOrderToggle
                order={officialsSortOrder}
                onToggle={() =>
                  setOfficialsSortOrder((prev) =>
                    prev === "asc" ? "desc" : "asc",
                  )
                }
                label="Sort"
              />
              <Pagination
                count={officialsTotalPages}
                color="primary"
                shape="rounded"
                page={officialsPage}
                onChange={(_event, value) => setOfficialsPage(value)}
              />
            </Box>
          </Box>
        )}

        {activeTab === 2 && (
          <Box
            sx={{
              p: 5,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
              }}
            >
              <Box>
                <Typography variant="h6" fontWeight="bold" color="#1f2937">
                  System User Accounts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Register and manage accounts for system administrators and
                  staff.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<UserPlus size={20} />}
                onClick={() => handleOpenUserModal()}
                sx={{
                  textTransform: "none",
                  fontWeight: "bold",
                  bgcolor: "#3b82f6",
                  "&:hover": { bgcolor: "#2563eb" },
                }}
              >
                Register New User
              </Button>
            </Box>

            <Box
              sx={{
                mb: 3,
                display: "flex",
                gap: 2,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <TextField
                placeholder="Search account by name or username..."
                size="small"
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  setUsersPage(1);
                }}
                sx={{
                  flex: 1,
                  maxWidth: 400,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    bgcolor: "white",
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} className="text-gray-400" />
                    </InputAdornment>
                  ),
                  endAdornment: userSearchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setUserSearchQuery("");
                          setUsersPage(1);
                        }}
                      >
                        <X size={16} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  <Filter size={16} /> Filter:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select
                    value={userStatusFilter}
                    onChange={(e) => {
                      setUserStatusFilter(e.target.value);
                      setUsersPage(1);
                    }}
                    sx={{
                      borderRadius: 2.5,
                      bgcolor: "white",
                      "& .MuiSelect-select": { py: 1 },
                    }}
                  >
                    <MenuItem value="All">All Status</MenuItem>
                    <MenuItem value="Active">Active Accounts</MenuItem>
                    <MenuItem value="Inactive">Inactive Accounts</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ flex: 1 }} />
              <Typography
                variant="caption"
                sx={{ color: "#94a3b8", fontWeight: 600 }}
              >
                Showing {filteredUsers.length} account
                {filteredUsers.length !== 1 ? "s" : ""}
              </Typography>
            </Box>

            <TableContainer
              component={Paper}
              elevation={0}
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              <Table sx={{ tableLayout: "fixed", minWidth: 980 }}>
                <TableHead sx={{ bgcolor: "#f8fafc" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold", width: "24%" }}>
                      User Profile
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "20%" }}>
                      Username
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "12%" }}>
                      Role
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "12%" }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", width: "20%" }}>
                      Last Login
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: "bold", width: "12%" }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isUsersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="body1" color="text.secondary">
                          Loading user accounts...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length > 0 ? (
                    paginatedUsers.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor:
                                  user.role === "Admin" ? "#2e0249" : "#3b82f6",
                                fontSize: 14,
                              }}
                            >
                              {user.name.charAt(0)}
                            </Avatar>
                            <Typography variant="body2" fontWeight="600">
                              {user.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ color: "#64748b", fontStyle: "italic" }}
                          >
                            @{user.username}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<ShieldCheck size={14} />}
                            label={normalizeRoleLabel(user.role)}
                            size="small"
                            sx={{
                              fontWeight: "bold",
                              bgcolor:
                                normalizeRoleLabel(user.role) === "Admin"
                                  ? "#f5f3ff"
                                  : "#eff6ff",
                              color:
                                normalizeRoleLabel(user.role) === "Admin"
                                  ? "#6d28d9"
                                  : "#1d4ed8",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.status}
                            size="small"
                            sx={{
                              fontWeight: "bold",
                              bgcolor:
                                user.status === "Active"
                                  ? "#dcfce7"
                                  : "#f1f5f9",
                              color:
                                user.status === "Active"
                                  ? "#166534"
                                  : "#64748b",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              color: "#94a3b8",
                            }}
                          >
                            <History size={14} />
                            <Typography variant="caption">
                              {user.lastLogin || "Never"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: "flex",
                              gap: 1,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Tooltip title="Edit Account">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenUserModal(user)}
                              >
                                <Edit2 size={16} className="text-blue-500" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={
                                user.id === authUser?.userId
                                  ? "You cannot deactivate yourself" // Show a helpful tooltip
                                  : user.status === "Active"
                                    ? "Deactivate Account"
                                    : "Activate Account"
                              }
                            >
                              <span>
                                {" "}
                                {/* Wrap in a span so Tooltip still works when disabled */}
                                <IconButton
                                  size="small"
                                  disabled={
                                    user.id === authUser?.userId &&
                                    user.status === "Active"
                                  }
                                  onClick={() =>
                                    handleToggleUserStatus(user.id)
                                  }
                                  sx={{
                                    color:
                                      user.id === authUser?.userId &&
                                      user.status === "Active"
                                        ? "#9ca3af" // Gray for currently logged-in Admin
                                        : user.status === "Active"
                                          ? "#ef4444" // Red to Deactivate others
                                          : "#10b981", // Green to Activate
                                    "&:hover": {
                                      bgcolor:
                                        user.id === authUser?.userId &&
                                        user.status === "Active"
                                          ? "transparent" // No hover effect if disabled
                                          : user.status === "Active"
                                            ? "#fee2e2"
                                            : "#dcfce7",
                                    },
                                  }}
                                >
                                  {user.status === "Active" ? (
                                    <PowerOff size={16} />
                                  ) : (
                                    <CheckCircle size={16} />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography variant="body1" color="text.secondary">
                          No matching accounts found for the current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
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
                pt: 2,
              }}
            >
              <SortOrderToggle
                order={usersSortOrder}
                onToggle={() =>
                  setUsersSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                label="Sort"
              />
              <Pagination
                count={usersTotalPages}
                color="primary"
                shape="rounded"
                page={usersPage}
                onChange={(_event, value) => setUsersPage(value)}
              />
              
            </Box>
          </Box>
        )}
        {activeTab === 3 && (
          <Box sx={{ p: 4, overflowY: "auto", flex: 1, bgcolor: "white" }}>
            <DataImportTab />
          </Box>
        )}

      </Paper>

      <Dialog
        open={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            pb: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {selectedUser ? "Edit User Account" : "Register New User"}
          <IconButton onClick={() => setIsUserModalOpen(false)} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, py: 1 }}>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: "bold" }}
              >
                Full Name
              </Typography>
              <Autocomplete
                options={residentOptions}
                loading={isResidentsLoading}
                getOptionLabel={(option) => option.name}
                value={
                  residentOptions.find((r) => r.name === userFormData.name) ||
                  null
                }
                onChange={(_event, newValue) =>
                  setUserFormData({
                    ...userFormData,
                    name: newValue?.name || "",
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Link to resident profile..."
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: "bold" }}
              >
                Username
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Choose a unique username"
                value={userFormData.username}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, username: e.target.value })
                }
              />
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: "bold" }}
              >
                Password
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                placeholder={
                  selectedUser
                    ? "Leave blank to keep current"
                    : "Set initial password"
                }
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
              />
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Account Role</InputLabel>
                  <Select
                    label="Account Role"
                    value={userFormData.role}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        role: e.target.value as "Admin" | "Staff",
                      })
                    }
                  >
                    <MenuItem value="Admin">Admin</MenuItem>
                    <MenuItem value="Staff">Staff</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={userFormData.status}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        status: e.target.value as "Active" | "Inactive",
                      })
                    }
                  >
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setIsUserModalOpen(false)}
            sx={{ color: "#6b7280" }}
            disabled={isUsersSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveUser}
            disabled={
              !userFormData.username.trim() ||
              (!selectedUser && !userPassword.trim()) ||
              isUsersSubmitting
            }
            sx={{ borderRadius: 2 }}
          >
            {isUsersSubmitting
              ? "Saving..."
              : selectedUser
                ? "Update Account"
                : "Create Account"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isAddOfficialOpen}
        onClose={() => setIsAddOfficialOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            pb: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Add New Official
          <IconButton onClick={() => setIsAddOfficialOpen(false)} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3, py: 1 }}>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: "bold" }}
              >
                Select Resident
              </Typography>
              <Autocomplete
                options={residentOptions}
                loading={isResidentsLoading}
                getOptionLabel={(option) => option.name}
                value={newOfficialResident}
                onChange={(_event, newValue) =>
                  setNewOfficialResident(newValue)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search resident name..."
                    size="small"
                    fullWidth
                  />
                )}
              />
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: "bold" }}
              >
                Position
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Position</InputLabel>
                <Select
                  label="Position"
                  value={newOfficialPosition}
                  onChange={(e) => setNewOfficialPosition(e.target.value)}
                >
                  {OFFICIAL_POSITIONS.map((position) => (
                    <MenuItem key={position} value={position}>
                      {position}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontWeight: "bold" }}
              >
                Term Duration
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    label="Term Start"
                    InputLabelProps={{ shrink: true }}
                    value={newOfficialTermStart}
                    onChange={(e) => setNewOfficialTermStart(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    type="date"
                    size="small"
                    label="Term End"
                    InputLabelProps={{ shrink: true }}
                    value={newOfficialTermEnd}
                    onChange={(e) => setNewOfficialTermEnd(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setIsAddOfficialOpen(false)}
            sx={{ color: "#6b7280" }}
            disabled={isOfficialsSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveNewOfficial}
            disabled={
              !newOfficialResident ||
              !newOfficialPosition ||
              !newOfficialTermStart ||
              isOfficialsSubmitting
            }
            sx={{ borderRadius: 2 }}
          >
            {isOfficialsSubmitting ? "Adding..." : "Add Official"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isViewOfficialOpen}
        onClose={() => setIsViewOfficialOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            pb: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            bgcolor: "#f9fafb",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              src={editOfficialData?.imageUrl}
              sx={{ width: 32, height: 32 }}
            />
            <Typography fontWeight="bold">Official Details</Typography>
          </Box>
          <IconButton onClick={() => setIsViewOfficialOpen(false)} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedOfficial && editOfficialData && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ textAlign: "center", mb: 1 }}>
                <Box sx={{ position: "relative", display: "inline-block" }}>
                  <Avatar
                    src={editOfficialData.imageUrl}
                    sx={{
                      width: 100,
                      height: 100,
                      mx: "auto",
                      mb: 2,
                      border: "3px solid white",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {editOfficialData.firstName.charAt(0)}
                  </Avatar>
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {selectedOfficial.name}
                </Typography>
                {!isEditingOfficial ? (
                  <Chip
                    label={`${selectedOfficial.position} (${selectedOfficial.status})`}
                    color="primary"
                    size="small"
                    sx={{ mt: 1 }}
                  />
                ) : (
                  <Box
                    sx={{
                      mt: 1,
                      display: "flex",
                      gap: 1,
                      justifyContent: "center",
                    }}
                  >
                    <FormControl size="small" sx={{ width: 180 }}>
                      <InputLabel>Position</InputLabel>
                      <Select
                        label="Position"
                        value={editOfficialData.position}
                        onChange={(e) =>
                          setEditOfficialData({
                            ...editOfficialData,
                            position: e.target.value,
                          })
                        }
                      >
                        {OFFICIAL_POSITIONS.map((position) => (
                          <MenuItem key={position} value={position}>
                            {position}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 140 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        label="Status"
                        value={editOfficialData.status}
                        onChange={(e) =>
                          setEditOfficialData({
                            ...editOfficialData,
                            status: e.target.value as "Active" | "Former",
                          })
                        }
                      >
                        {OFFICIAL_STATUSES.map((status) => (
                          <MenuItem key={status} value={status}>
                            {status}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}
              </Box>
              <Divider />
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Calendar size={18} className="text-gray-500" /> Term Duration
                </Typography>
                {isEditingOfficial ? (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Start Date"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={editOfficialData.termStart || ""}
                        onChange={(e) =>
                          setEditOfficialData({
                            ...editOfficialData,
                            termStart: e.target.value,
                          })
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="End Date"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={editOfficialData.termEnd || ""}
                        onChange={(e) =>
                          setEditOfficialData({
                            ...editOfficialData,
                            termEnd: e.target.value,
                          })
                        }
                      />
                    </Grid>
                  </Grid>
                ) : (
                  <Box sx={{ display: "flex", gap: 4 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Start Date
                      </Typography>
                      <Typography variant="body2" fontWeight="500">
                        {formatOfficialTermDate(selectedOfficial.termStart)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        End Date
                      </Typography>
                      <Typography variant="body2" fontWeight="500">
                        {formatOfficialTermDate(selectedOfficial.termEnd)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            p: 2,
            justifyContent: "space-between",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <Button
            startIcon={<Trash2 size={16} />}
            color="error"
            onClick={() =>
              selectedOfficial && handleDeleteOfficial(selectedOfficial.id)
            }
            disabled={isOfficialsSubmitting}
          >
            Mark Former
          </Button>
          <Box>
            {isEditingOfficial ? (
              <>
                <Button
                  onClick={() => setIsEditingOfficial(false)}
                  sx={{ color: "#6b7280", mr: 1 }}
                  disabled={isOfficialsSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleUpdateOfficial}
                  disabled={isOfficialsSubmitting}
                >
                  {isOfficialsSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => setIsEditingOfficial(true)}
                startIcon={<Edit2 size={16} />}
              >
                Edit Info
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
