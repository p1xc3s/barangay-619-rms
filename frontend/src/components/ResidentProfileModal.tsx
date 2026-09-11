import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  Tabs,
  Tab,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Divider,
  Avatar,
  Slide,
  Container,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import {
  X,
  User,
  MapPin,
  GraduationCap,
  FileBadge,
  Edit2,
  Save,
  RotateCcw,
  CheckCircle,
  Phone,
  Mail,
  Calendar,
  Hash,
} from "lucide-react";
import type { TransitionProps } from "@mui/material/transitions";
import { residentService } from "../services/residentService";
import { householdService } from "../services/householdService";
import { familyService } from "../services/familyService";
import { notify } from "../utils/notify";
import { useHouseholdDataRefresh } from "../hooks/useHouseholdDataSync";
import type { HouseholdListItem, FamilyHeadOption } from "../types";

// --- Types ---
interface ResidentProfileModalProps {
  open: boolean;
  onClose: () => void;
  residentId?: string | number;
  onUpdated?: () => void;
}

const familyRoles = [
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Relative",
  "Househelp",
  "Others",
];

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Default empty form shape
const emptyFormData = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  sex: "",
  dob: "",
  placeOfBirth: "",
  mothersMaidenName: "",
  civilStatus: "",
  citizenship: "",
  inhabitantType: "",
  religion: "",
  contactNumber: "",
  email: "",
  unitRoom: "",
  building: "",
  lotBlock: "",
  street: "",
  barangay: "",
  city: "",
  householdRole: "",
  householdNumber: "",
  householdId: "",
  occupancyStatus: "",
  householdHeadName: "",
  familyHeadId: "",
  relationship: "",
  hasEducation: "no",
  educationLevel: "",
  educationStatus: "",
  isEmployed: "no",
  occupation: "",
  employmentStatus: "",
  isVoter: "no",
  precinctNumber: "",
  categories: [] as string[],
};

const profileCategoryOptions = [
  "PWD",
  "Solo Parent",
  "Pregnant Woman",
  "OSY",
  "OSC",
  "4Ps",
  "OFW",
  "IP",
];

const parseCategories = (categories?: string | null): string[] => {
  if (!categories) return [];

  return categories
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
};

const ResidentProfileModal: React.FC<ResidentProfileModalProps> = ({
  open,
  onClose,
  residentId,
  onUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState(emptyFormData);
  const [originalData, setOriginalData] = useState(emptyFormData);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [isHouseholdsLoading, setIsHouseholdsLoading] = useState(false);
  const [familyHeadOptions, setFamilyHeadOptions] = useState<
    FamilyHeadOption[]
  >([]);

  const fetchHouseholds = useCallback(async () => {
    if (!open) {
      return;
    }

    setIsHouseholdsLoading(true);
    try {
      const data = await householdService.getAll();
      setHouseholds(data);
    } catch {
      notify.error("Failed to load household list.");
    } finally {
      setIsHouseholdsLoading(false);
    }
  }, [open]);

  useHouseholdDataRefresh(fetchHouseholds);

  // Fetch family head options when modal opens
  const fetchFamilyHeads = useCallback(async () => {
    if (!open) return;
    try {
      const heads = await familyService.getPrimaryHeads();
      setFamilyHeadOptions(heads);
    } catch {
      // silently fail — family head options will just be empty
    }
  }, [open]);

  // Fetch full profile from API when modal opens
  useEffect(() => {
    if (open && residentId) {
      const fetchProfile = async () => {
        setIsLoadingProfile(true);
        try {
          const data = await residentService.getById(Number(residentId));

          const normalizedHouseholdRole =
            data.HouseholdRole === "head" || data.HouseholdRole === "member"
              ? data.HouseholdRole
              : data.HouseholdID
                ? "member"
                : "";

          const mapped = {
            ...emptyFormData,
            firstName: data.FirstName || "",
            middleName: data.MiddleName || "",
            lastName: data.LastName || "",
            suffix: data.Suffix || "",
            sex: data.Sex || "",
            dob: data.DateOfBirth ? data.DateOfBirth.split("T")[0] : "",
            placeOfBirth: data.PlaceOfBirth || "",
            mothersMaidenName: [
              data.Mothers_Maiden_FirstName,
              data.Mothers_Maiden_MiddleName,
              data.Mothers_Maiden_Surname,
            ]
              .filter(Boolean)
              .join(" "),
            civilStatus: data.CivilStatus || "",
            citizenship: data.Citizenship || "",
            inhabitantType: data.InhabitantType || "",
            religion: data.Religion || "",
            contactNumber: data.RContactNumber || "",
            email: data.REmail || "",
            unitRoom: data.UnitRoomFloor || "",
            building: data.BuildingName || "",
            lotBlock: data.LotBlockPhase || "",
            street: data.Street || "",
            barangay: data.Barangay || "",
            city: data.Municipality || "",
            householdRole: normalizedHouseholdRole,
            householdNumber: data.HouseholdNumber || "",
            householdId: data.HouseholdID ? String(data.HouseholdID) : "",
            occupancyStatus: data.OccupancyStatus || "",
            householdHeadName: data.HouseholdHeadName || "",
            familyHeadId: (data as unknown as Record<string, unknown>)
              .FamilyHeadID
              ? String(
                  (data as unknown as Record<string, unknown>).FamilyHeadID,
                )
              : "",
            relationship:
              ((data as unknown as Record<string, unknown>)
                .RelationshipToFamilyHead as string) || "",
            hasEducation:
              data.EducationLevel || data.EducationStatus ? "yes" : "no",
            educationLevel: data.EducationLevel || "",
            educationStatus:
              data.EducationStatus === "Ongoing"
                ? "Enrolled"
                : data.EducationStatus || "",
            isEmployed: data.Occupation || data.EmploymentStatus ? "yes" : "no",
            occupation: data.Occupation || "",
            employmentStatus: data.EmploymentStatus || "",
            isVoter: data.PrecinctNumber || data.VoterID ? "yes" : "no",
            precinctNumber: data.PrecinctNumber || "",
            categories: parseCategories(data.Categories),
          };
          setFormData(mapped);
          setOriginalData(mapped);
        } catch {
          notify.error("Failed to load resident profile.");
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
      fetchHouseholds();
      fetchFamilyHeads();
    }
    if (!open) {
      setIsEditing(false);
      setTabValue(0);
    }
  }, [open, residentId, fetchHouseholds]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Opens confirm dialog instead of saving directly (FR2)
  const handleSaveClick = () => {
    setConfirmOpen(true);
  };

  // Actual save — sends PUT to backend
  const handleConfirmSave = async () => {
    setConfirmOpen(false);
    setIsSaving(true);
    try {
      const wasHead = originalData.householdRole === "head";
      const wasHouseholdId = originalData.householdId;
      const nextIsHead = formData.householdRole === "head";
      const nextHouseholdId = formData.householdId;

      if (wasHead && (!nextIsHead || wasHouseholdId !== nextHouseholdId)) {
        try {
          await familyService.demoteHead(Number(residentId));
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ||
            "Unable to demote family head. Assign a member first.";
          notify.error(message);
          setIsSaving(false);
          return;
        }
      }

      await residentService.update(Number(residentId), {
        firstName: formData.firstName,
        middleName: formData.middleName || undefined,
        lastName: formData.lastName,
        suffix: formData.suffix || undefined,
        sex: formData.sex as "Male" | "Female",
        dateOfBirth: formData.dob || undefined,
        placeOfBirth: formData.placeOfBirth || undefined,
        civilStatus: formData.civilStatus,
        citizenship: formData.citizenship || undefined,
        inhabitantType: formData.inhabitantType || undefined,
        religion: formData.religion || undefined,
        contactNumber: formData.contactNumber || undefined,
        email: formData.email || undefined,
        residentStatus: "Active",
        mothersMaidenSurname:
          formData.mothersMaidenName?.split(" ").pop() || undefined,
        mothersMaidenFirstName:
          formData.mothersMaidenName?.split(" ")[0] || undefined,
        mothersMaidenMiddleName:
          formData.mothersMaidenName?.split(" ")[1] || undefined,
        hasEducation: formData.hasEducation as "yes" | "no",
        educationLevel: formData.educationLevel || undefined,
        educationStatus: formData.educationStatus || undefined,
        isEmployed: formData.isEmployed as "yes" | "no",
        occupation: formData.occupation || undefined,
        employmentStatus: formData.employmentStatus || undefined,
        isVoter: formData.isVoter as "yes" | "no",
        precinctNumber: formData.precinctNumber || undefined,
        categories: formData.categories,
        householdRole:
          formData.householdRole === "head" ||
          formData.householdRole === "member"
            ? formData.householdRole
            : undefined,
        occupancyStatus:
          formData.occupancyStatus === "Owner" ||
          formData.occupancyStatus === "Renter" ||
          formData.occupancyStatus === "Sharer" ||
          formData.occupancyStatus === "Boarder"
            ? formData.occupancyStatus
            : undefined,
        householdId:
          formData.householdRole === "head" && formData.householdId
            ? Number(formData.householdId)
            : undefined,
      });

      if (nextIsHead && nextHouseholdId) {
        const shouldAssignHead = !wasHead || wasHouseholdId !== nextHouseholdId;

        if (shouldAssignHead) {
          try {
            await familyService.assignHead(
              Number(nextHouseholdId),
              Number(residentId),
            );
          } catch {
            notify.warn("Resident updated, but family head assignment failed.");
          }
        }
      }

      // Link member to family head in Family table
      if (
        !nextIsHead &&
        formData.householdRole === "member" &&
        formData.familyHeadId
      ) {
        try {
          await familyService.addMember(
            Number(formData.familyHeadId),
            Number(residentId),
            formData.relationship || "Relative",
          );
        } catch (memberErr: unknown) {
          const memberMessage =
            (
              memberErr as {
                response?: { data?: { message?: string } };
              }
            )?.response?.data?.message || undefined;
          // If the member already exists in the Family table, that's fine
          if (
            memberMessage &&
            memberMessage.toLowerCase().includes("duplicate")
          ) {
            // Already linked — ignore
          } else {
            notify.warn(
              "Resident updated, but family member linking failed.",
            );
          }
        }
      }

      notify.success("Resident updated successfully!");
      setIsEditing(false);
      setOriginalData(formData);
      onUpdated?.();
    } catch {
      notify.error("Failed to update resident.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      handleSaveClick();
    } else {
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData(originalData);
  };

  const handleChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleHouseholdChange = (value: string) => {
    const selected = households.find(
      (household) => String(household.HouseholdID) === value,
    );

    setFormData((prev) => ({
      ...prev,
      householdId: value,
      householdNumber: selected?.householdNumber || "",
    }));
  };

  // --- Render Helpers ---

  const renderField = (
    label: string,
    field: keyof typeof emptyFormData,
    type: "text" | "select" | "date" = "text",
    options?: string[],
  ) => {
    const value = formData[field];

    if (isEditing) {
      if (type === "select" && options) {
        return (
          <FormControl fullWidth size="small">
            <InputLabel>{label}</InputLabel>
            <Select
              value={value}
              label={label}
              onChange={(e) => handleChange(field, e.target.value)}
            >
              {options.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }
      return (
        <TextField
          fullWidth
          size="small"
          label={label}
          value={value}
          type={type}
          onChange={(e) => handleChange(field, e.target.value)}
          InputLabelProps={type === "date" ? { shrink: true } : undefined}
        />
      );
    }

    // View Mode
    if (field === "householdRole") {
      const roleValue = value === "head" || value === "member" ? value : "";

      return (
        <Box sx={{ mb: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.5 }}
          >
            {label}
          </Typography>
          <Chip
            label={
              roleValue === "head"
                ? "HEAD OF FAMILY"
                : roleValue === "member"
                  ? "MEMBER"
                  : "-"
            }
            size="small"
            sx={{
              fontWeight: 700,
              borderRadius: 1,
              bgcolor:
                roleValue === "head"
                  ? "#4f46e5"
                  : roleValue === "member"
                    ? "#f3f4f6"
                    : "#f9fafb",
              color: roleValue === "head" ? "#ffffff" : "#374151",
              fontSize: "0.75rem",
              height: 24,
            }}
          />
        </Box>
      );
    }

    let displayValue: React.ReactNode = value;

    if (Array.isArray(value)) {
      displayValue = value.join(", ");
    } else if (!value) {
      displayValue = "-";
    } else if (typeof value === "string") {
      // Capitalize first letter except for email
      if (field !== "email") {
        displayValue = value.charAt(0).toUpperCase() + value.slice(1);
      }
    }

    return (
      <Box sx={{ mb: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.5 }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          fontWeight={500}
          sx={{ color: "#1f2937", minHeight: "24px" }}
        >
          {displayValue}
        </Typography>
      </Box>
    );
  };

  const SectionTitle = ({
    icon: Icon,
    title,
  }: {
    icon: React.FC<{ size?: number }>;
    title: string;
  }) => (
    <Typography
      variant="h6"
      fontWeight="bold"
      color="primary"
      sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}
    >
      <Icon size={20} /> {title}
    </Typography>
  );

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
    >
      <Box
        sx={{
          bgcolor: "#f3f4f6",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: "#2e0249", zIndex: 1100 }}
        >
          <Toolbar sx={{ height: 80 }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={onClose}
              sx={{ mr: 2 }}
            >
              <X />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: "bold" }}>
              Resident Profile
            </Typography>
            <Box>
              {isEditing ? (
                <>
                  <Button
                    color="inherit"
                    onClick={handleCancelEdit}
                    startIcon={<RotateCcw size={18} />}
                    sx={{ mr: 2 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleEditToggle}
                    startIcon={<Save size={18} />}
                    sx={{ borderRadius: 2 }}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleEditToggle}
                  startIcon={<Edit2 size={18} />}
                  sx={{ borderRadius: 2, bgcolor: "#3b82f6" }}
                >
                  Edit Information
                </Button>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="xl" sx={{ flex: 1, py: 4, overflowY: "auto" }}>
          {isLoadingProfile ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Landscape Profile Header Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid #e5e7eb",
                  mb: 3,
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  alignItems: { xs: "flex-start", md: "center" },
                  gap: 3,
                  bgcolor: "white",
                }}
              >
                {/* Avatar & Name Group */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    flex: { md: 1 },
                    width: "100%",
                  }}
                >
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: "#e0e7ff",
                      color: "#4f46e5",
                      fontSize: 32,
                    }}
                  >
                    {formData.firstName[0]}
                    {formData.lastName[0]}
                  </Avatar>
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        mb: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="#1f2937"
                      >
                        {formData.firstName} {formData.lastName}
                      </Typography>
                      <Chip
                        label="Active"
                        color="success"
                        size="small"
                        icon={<CheckCircle size={14} />}
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Resident Registry Information
                    </Typography>
                  </Box>
                </Box>

                {/* Vertical Divider for Desktop */}
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ display: { xs: "none", md: "block" } }}
                />

                {/* Key Stats Horizontal Row */}
                <Box
                  sx={{
                    display: "flex",
                    gap: { xs: 2, md: 6 },
                    flexWrap: "wrap",
                    width: { xs: "100%", md: "auto" },
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: "#f3f4f6", borderRadius: "50%" }}>
                      <Calendar size={18} className="text-gray-500" />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Age
                      </Typography>
                      <Typography variant="body2" fontWeight="600">
                        {formData.dob
                          ? Math.floor(
                              (Date.now() - new Date(formData.dob).getTime()) /
                                (365.25 * 24 * 60 * 60 * 1000),
                            )
                          : "-"}{" "}
                        yrs
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: "#f3f4f6", borderRadius: "50%" }}>
                      <User size={18} className="text-gray-500" />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Sex
                      </Typography>
                      <Typography variant="body2" fontWeight="600">
                        {formData.sex}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: "#f3f4f6", borderRadius: "50%" }}>
                      <Phone size={18} className="text-gray-500" />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Phone
                      </Typography>
                      <Typography variant="body2" fontWeight="600">
                        {formData.contactNumber}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Box sx={{ p: 1, bgcolor: "#f3f4f6", borderRadius: "50%" }}>
                      <Mail size={18} className="text-gray-500" />
                    </Box>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Email
                      </Typography>
                      <Typography variant="body2" fontWeight="600">
                        {formData.email}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Paper>

              {/* Detailed Info Tabs */}
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  minHeight: "60vh",
                }}
              >
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    px: 2,
                    bgcolor: "#f9fafb",
                    "& .MuiTab-root": {
                      textTransform: "none",
                      fontWeight: 600,
                      minHeight: 64,
                      fontSize: "1rem",
                    },
                  }}
                >
                  <Tab
                    label="Personal Info"
                    icon={<User size={18} />}
                    iconPosition="start"
                  />
                  <Tab
                    label="Residence"
                    icon={<MapPin size={18} />}
                    iconPosition="start"
                  />
                  <Tab
                    label="Socio-Economic"
                    icon={<GraduationCap size={18} />}
                    iconPosition="start"
                  />
                  <Tab
                    label="Classification"
                    icon={<FileBadge size={18} />}
                    iconPosition="start"
                  />
                </Tabs>

                <Box sx={{ p: 4 }}>
                  {/* Tab 0: Personal Info */}
                  {tabValue === 0 && (
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12 }}>
                        <SectionTitle
                          icon={User}
                          title="Identity Information"
                        />
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("First Name", "firstName")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Middle Name", "middleName")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Last Name", "lastName")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 1 }}>
                            {renderField("Suffix", "suffix", "select", [
                              "-",
                              "Jr.",
                              "Sr.",
                              "III",
                            ])}
                          </Grid>

                          <Grid size={{ xs: 12, md: 2 }}>
                            {renderField("Sex", "sex", "select", [
                              "Male",
                              "Female",
                            ])}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Date of Birth", "dob", "date")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Place of Birth", "placeOfBirth")}
                          </Grid>

                          <Grid size={{ xs: 12, md: 4 }}>
                            {renderField(
                              "Mother's Maiden Name",
                              "mothersMaidenName",
                            )}
                          </Grid>
                        </Grid>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Divider />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <SectionTitle icon={Hash} title="Additional Details" />
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField(
                              "Civil Status",
                              "civilStatus",
                              "select",
                              ["Single", "Married", "Widowed", "Separated"],
                            )}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Citizenship", "citizenship")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Religion", "religion")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField(
                              "Inhabitant Type",
                              "inhabitantType",
                              "select",
                              ["Non-Migrant", "Migrant", "Transient"],
                            )}
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                  )}

                  {/* Tab 1: Residence */}
                  {tabValue === 1 && (
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12 }}>
                        <SectionTitle icon={MapPin} title="Current Address" />
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 2 }}>
                            {renderField("Unit/Room No.", "unitRoom")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Building Name", "building")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Lot/Block", "lotBlock")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            {renderField("Street", "street")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("Barangay", "barangay")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField("City", "city")}
                          </Grid>
                        </Grid>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Divider />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <SectionTitle
                          icon={FileBadge}
                          title="Household Setup"
                        />
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField(
                              "Role in Family",
                              "householdRole",
                              "select",
                              ["head", "member"],
                            )}
                          </Grid>

                          {formData.householdRole === "head" ? (
                            <>
                              <Grid size={{ xs: 12, md: 3 }}>
                                {isEditing ? (
                                  <FormControl fullWidth size="small">
                                    <InputLabel>Household Number</InputLabel>
                                    <Select
                                      value={formData.householdId}
                                      label="Household Number"
                                      onChange={(e) =>
                                        handleHouseholdChange(
                                          String(e.target.value),
                                        )
                                      }
                                      disabled={isHouseholdsLoading}
                                    >
                                      <MenuItem value="">
                                        Select a household
                                      </MenuItem>
                                      {households.map((household) => (
                                        <MenuItem
                                          key={household.HouseholdID}
                                          value={String(household.HouseholdID)}
                                        >
                                          {household.householdNumber} -{" "}
                                          {household.Street_Alley_Zone}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                ) : (
                                  renderField(
                                    "Household Number",
                                    "householdNumber",
                                  )
                                )}
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                {renderField(
                                  "Occupancy Status",
                                  "occupancyStatus",
                                  "select",
                                  ["Owner", "Renter", "Sharer", "Boarder"],
                                )}
                              </Grid>
                            </>
                          ) : isEditing ? (
                            <>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Household Number</InputLabel>
                                  <Select
                                    value={formData.householdId}
                                    label="Household Number"
                                    onChange={(e) =>
                                      handleHouseholdChange(
                                        String(e.target.value),
                                      )
                                    }
                                    disabled={isHouseholdsLoading}
                                  >
                                    <MenuItem value="">
                                      Select a household
                                    </MenuItem>
                                    {households.map((household) => (
                                      <MenuItem
                                        key={household.HouseholdID}
                                        value={String(household.HouseholdID)}
                                      >
                                        {household.householdNumber} -{" "}
                                        {household.Street_Alley_Zone}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Family Head</InputLabel>
                                  <Select
                                    value={formData.familyHeadId}
                                    label="Family Head"
                                    onChange={(e) =>
                                      handleChange(
                                        "familyHeadId",
                                        String(e.target.value),
                                      )
                                    }
                                  >
                                    <MenuItem value="">
                                      Select a family head
                                    </MenuItem>
                                    {familyHeadOptions
                                      .filter(
                                        (head) =>
                                          !formData.householdId ||
                                          head.householdId ===
                                            Number(formData.householdId),
                                      )
                                      .map((head) => (
                                        <MenuItem
                                          key={head.id}
                                          value={head.id}
                                        >
                                          {head.name}
                                          {head.familyLabel
                                            ? ` (${head.familyLabel})`
                                            : ""}
                                        </MenuItem>
                                      ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  select
                                  label="Relationship to Family Head"
                                  value={formData.relationship}
                                  onChange={(e) =>
                                    handleChange("relationship", e.target.value)
                                  }
                                >
                                  {familyRoles.map((role) => (
                                    <MenuItem key={role} value={role}>
                                      {role}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Grid>
                            </>
                          ) : (
                            <Grid size={{ xs: 12, md: 6 }}>
                              <Box
                                sx={{
                                  p: 2,
                                  bgcolor: "#eff6ff",
                                  borderRadius: 2,
                                  border: "1px solid #bfdbfe",
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  fontWeight="bold"
                                >
                                  LINKED FAMILY HEAD
                                </Typography>
                                <Typography variant="body1">
                                  {formData.householdHeadName
                                    ? `${formData.householdHeadName}${
                                        formData.householdNumber
                                          ? ` (Household ${formData.householdNumber})`
                                          : ""
                                      }`
                                    : "Not available"}
                                </Typography>
                                {formData.relationship && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.5 }}
                                  >
                                    Relationship: {formData.relationship}
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Grid>
                    </Grid>
                  )}

                  {/* Tab 2: Socio-Economic */}
                  {tabValue === 2 && (
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12 }}>
                        <SectionTitle
                          icon={GraduationCap}
                          title="Education & Employment"
                        />
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField(
                              "Has Education",
                              "hasEducation",
                              "select",
                              ["yes", "no"],
                            )}
                          </Grid>
                          {formData.hasEducation === "yes" && (
                            <>
                              <Grid size={{ xs: 12, md: 3 }}>
                                {renderField("Highest Level", "educationLevel")}
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                {renderField("Status", "educationStatus")}
                              </Grid>
                            </>
                          )}

                          <Grid size={{ xs: 12 }}>
                            <Divider sx={{ borderStyle: "dashed" }} />
                          </Grid>

                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField(
                              "Is Employed",
                              "isEmployed",
                              "select",
                              ["yes", "no"],
                            )}
                          </Grid>
                          {formData.isEmployed === "yes" && (
                            <>
                              <Grid size={{ xs: 12, md: 3 }}>
                                {renderField("Occupation", "occupation")}
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                {renderField(
                                  "Employment Status",
                                  "employmentStatus",
                                )}
                              </Grid>
                            </>
                          )}
                        </Grid>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Divider />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <SectionTitle
                          icon={FileBadge}
                          title="Voter Information"
                        />
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 3 }}>
                            {renderField(
                              "Registered Voter",
                              "isVoter",
                              "select",
                              ["yes", "no"],
                            )}
                          </Grid>
                          {formData.isVoter === "yes" && (
                            <Grid size={{ xs: 12, md: 3 }}>
                              {renderField("Precinct Number", "precinctNumber")}
                            </Grid>
                          )}
                        </Grid>
                      </Grid>
                    </Grid>
                  )}

                  {/* Tab 3: Classification */}
                  {tabValue === 3 && (
                    <Box>
                      <SectionTitle
                        icon={FileBadge}
                        title="Special Categories"
                      />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                      >
                        Check all classifications that apply to this resident.
                      </Typography>

                      {isEditing ? (
                        <Grid container spacing={2}>
                          {profileCategoryOptions.map((cat) => {
                            const isSelected =
                              formData.categories.includes(cat);
                            return (
                              <Grid key={cat}>
                                <Chip
                                  label={cat}
                                  onClick={() => {
                                    const newCats = isSelected
                                      ? formData.categories.filter(
                                          (c) => c !== cat,
                                        )
                                      : [...formData.categories, cat];
                                    handleChange("categories", newCats);
                                  }}
                                  color={isSelected ? "primary" : "default"}
                                  variant={isSelected ? "filled" : "outlined"}
                                  sx={{ borderRadius: 1 }}
                                />
                              </Grid>
                            );
                          })}
                        </Grid>
                      ) : (
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          {formData.categories.map((cat) => (
                            <Chip
                              key={cat}
                              label={cat}
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                          {formData.categories.length === 0 && (
                            <Typography color="text.secondary">None</Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            </>
          )}
        </Container>

        {/* Confirm Save Dialog (FR2) */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <DialogTitle sx={{ fontWeight: 700 }}>Confirm Changes</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to save these changes to the resident
              profile?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ pb: 2, px: 3 }}>
            <Button
              onClick={() => setConfirmOpen(false)}
              color="inherit"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              variant="contained"
              color="primary"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Dialog>
  );
};

export default ResidentProfileModal;
