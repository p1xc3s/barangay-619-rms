import React, { useState, useEffect, useCallback, useRef } from "react";
import { useBarangayLogo } from "../hooks/useBarangayLogo";
import { householdService } from "../services/householdService";
import { officialService } from "../services/officialService";
import { useHouseholdDataRefresh } from "../hooks/useHouseholdDataSync";
import type { HouseholdListItem, Official } from "../types";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Button,
  Grid,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Slide,
  Container,
  Divider,
  Stack,
  Card,
  CardActionArea,
  Zoom,
  TablePagination,
} from "@mui/material";
import {
  Download,
  FileSpreadsheet,
  BarChart4,
  Users,
  Home,
  Vote,
  UsersRound,
  Accessibility,
  Heart,
  ShieldAlert,
  UserSquare,
  X,
  TrendingUp,
  Printer,
  ClipboardList,
  Stamp,
  Calendar,
  Layers,
  Maximize2,
  ChevronLeft,
  Search,
  FileDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TransitionProps } from "@mui/material/transitions";
import { reportService } from "../services/reportService";
import { notify } from "../utils/notify";
import SortOrderToggle, { type SortOrder } from "./SortOrderToggle";
import type {
  ReportDemographicsSummary,
  ReportDemographicsResident,
  ReportFormARecord,
  ReportFormAExportFormat,
  ReportFormCData,
} from "../types";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// --- Types ---
interface ResidentRecord {
  id: number;
  lastName: string;
  firstName: string;
  middleName: string;
  ext: string;
  pob: string;
  dob: string;
  age: number;
  sex: string;
  civilStatus: string;
  citizenship: string;
  occupation: string;
  sector: string;
  household: string;
  street: string;
  categories: string[];
}

interface ReportCategory {
  id: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

const toResidentRecord = (
  record: ReportFormARecord,
  index: number,
): ResidentRecord => {
  const categories = (record.Categories || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: index + 1,
    lastName: record.LastName,
    firstName: record.FirstName,
    middleName: record.MiddleName || "",
    ext: record.Suffix || "",
    pob: record.PlaceOfBirth || "",
    dob: record.DateOfBirth || "",
    age: Number(record.Age) || 0,
    sex: record.Sex,
    civilStatus: record.CivilStatus,
    citizenship: record.Citizenship,
    occupation: record.Occupation || "",
    sector: categories[0] || "",
    household: record.Household || "Unassigned",
    street: record.Street || "",
    categories,
  };
};

const ageBrackets = [
  { label: "Under 5 years old", range: [0, 4] },
  { label: "5-9 years old", range: [5, 9] },
  { label: "10-14 years old", range: [10, 14] },
  { label: "15-19 years old", range: [15, 19] },
  { label: "20-24 years old", range: [20, 24] },
  { label: "25-29 years old", range: [25, 29] },
  { label: "30-34 years old", range: [30, 34] },
  { label: "35-39 years old", range: [35, 39] },
  { label: "40-44 years old", range: [40, 44] },
  { label: "45-49 years old", range: [45, 49] },
  { label: "50-54 years old", range: [50, 54] },
  { label: "55-59 years old", range: [55, 59] },
  { label: "60-64 years old", range: [60, 64] },
  { label: "65-69 years old", range: [65, 69] },
  { label: "70-74 years old", range: [70, 74] },
  { label: "75-79 years old", range: [75, 79] },
  { label: "80 years old and over", range: [80, 200] },
];

const sectorList = [
  "Labor Force",
  "Unemployed",
  "Out of School Children (OSC)",
  "Out of School Youth (OSY)",
  "Person with Disabilities (PWDs)",
  "Overseas Filipino Workers (OFWs)",
  "Solo Parents",
  "Indigenous Peoples (IPs)",
];

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#6366f1",
];

const buildDateToken = (value: Date = new Date()): string =>
  value.toISOString().slice(0, 10);

const sanitizeFilenamePart = (value: string): string =>
  value
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const joinFilenameParts = (parts: Array<string | null | undefined>): string =>
  parts
    .map((part) => (part ? sanitizeFilenamePart(part) : ""))
    .filter(Boolean)
    .join(" - ");

const buildFilename = (
  parts: Array<string | null | undefined>,
  extension: string,
): string => `${joinFilenameParts(parts)}.${extension}`;

const formatDateMMDDYYYY = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

// --- Form Preview Components ---

const FormA_Preview = ({
  residents,
  totalResidents,
  householdName,
  householdStreet,
  barangaySecretaryName,
  punongBarangayName,
}: {
  residents: ResidentRecord[];
  totalResidents: number;
  householdName: string;
  householdStreet: string;
  barangaySecretaryName: string;
  punongBarangayName: string;
}) => (
  <Box
    sx={{
      bgcolor: "white",
      p: 6,
      minHeight: "11in",
      border: "1px solid #e2e8f0",
      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
    }}
  >
    <Typography variant="caption" sx={{ fontWeight: "bold" }}>
      RBI FORM A (Revised 2024)
    </Typography>
    <Typography
      variant="h6"
      align="center"
      sx={{ fontWeight: 800, mt: 2, mb: 4, textTransform: "uppercase" }}
    >
      Records of Barangay Inhabitants by Household
    </Typography>

    <Grid container spacing={2} sx={{ mb: 4 }}>
      <Grid size={{ xs: 6 }}>
        <Typography variant="body2">
          <strong>REGION :</strong> NCR
        </Typography>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <Typography variant="body2">
          <strong>PROVINCE:</strong> METRO MANILA
        </Typography>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <Typography variant="body2">
          <strong>CITY/MUNICIPALITY:</strong> MANILA
        </Typography>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <Typography variant="body2">
          <strong>BARANGAY :</strong> 619
        </Typography>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <Typography variant="body2">
          <strong>HOUSEHOLD ADDRESS :</strong>{" "}
          {householdStreet ? `${householdStreet} St.` : "N/A"}
        </Typography>
      </Grid>
      <Grid size={{ xs: 6 }}>
        <Typography variant="body2">
          <strong>NO. OF HOUSEHOLD MEMBERS:</strong> {totalResidents}
        </Typography>
      </Grid>
    </Grid>

    <TableContainer
      component={Paper}
      elevation={0}
      variant="outlined"
      sx={{ borderRadius: 0 }}
    >
      <Table size="small">
        <TableHead sx={{ bgcolor: "#dcfce7" }}>
          <TableRow>
            <TableCell
              colSpan={4}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              NAME
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              PLACE OF BIRTH
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              DATE OF BIRTH
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              AGE
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              SEX
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              CIVIL STATUS
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              CITIZENSHIP
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
            >
              OCCUPATION
            </TableCell>
            <TableCell
              rowSpan={2}
              align="center"
              sx={{
                fontWeight: "bold",
                border: "1px solid #bbf7d0",
                fontSize: "10px",
              }}
            >
              CATEGORIES
            </TableCell>
          </TableRow>
          <TableRow sx={{ bgcolor: "#dcfce7" }}>
            <TableCell
              sx={{
                border: "1px solid #bbf7d0",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              LAST NAME
            </TableCell>
            <TableCell
              sx={{
                border: "1px solid #bbf7d0",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              FIRST NAME
            </TableCell>
            <TableCell
              sx={{
                border: "1px solid #bbf7d0",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              MIDDLE NAME
            </TableCell>
            <TableCell
              sx={{
                border: "1px solid #bbf7d0",
                fontSize: "10px",
                fontWeight: "bold",
              }}
            >
              EXT
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {residents.map((r, i) => (
            <TableRow key={i}>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.lastName}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.firstName}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.middleName}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.ext || "-"}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.pob}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {formatDateMMDDYYYY(r.dob)}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.age}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.sex}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.civilStatus}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.citizenship}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.occupation}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}>
                {r.sector}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    <Box sx={{ mt: 8, display: "flex", justifyContent: "space-between" }}>
      <Box sx={{ textAlign: "center", width: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, minHeight: 18 }}>
          {householdName}
        </Typography>
        <Typography
          variant="caption"
          display="block"
          sx={{ borderTop: "1px solid black", pt: 0.5 }}
        >
          Name of Household
        </Typography>
      </Box>
      <Box sx={{ textAlign: "center", width: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, minHeight: 18 }}>
          {barangaySecretaryName}
        </Typography>
        <Typography
          variant="caption"
          display="block"
          sx={{ borderTop: "1px solid black", pt: 0.5 }}
        >
          Barangay Secretary
        </Typography>
      </Box>
      <Box sx={{ textAlign: "center", width: 200 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, minHeight: 18 }}>
          {punongBarangayName}
        </Typography>
        <Typography
          variant="caption"
          display="block"
          sx={{ borderTop: "1px solid black", pt: 0.5 }}
        >
          Punong Barangay
        </Typography>
      </Box>
    </Box>
  </Box>
);

const FormC_Preview = ({
  residents,
  formCData,
  isPdfExport,
  sectorHeaderRef,
  barangaySecretaryName,
  punongBarangayName,
  semesterFilter,
  yearFilter,
}: {
  residents: ResidentRecord[];
  formCData?: ReportFormCData | null;
  isPdfExport?: boolean;
  sectorHeaderRef?: React.RefObject<HTMLTableRowElement>;
  barangaySecretaryName: string;
  punongBarangayName: string;
  semesterFilter: string;
  yearFilter: string;
}) => {
  const getBracketCount = (
    label: string,
    min: number,
    max: number,
    sex?: string,
  ) => {
    if (formCData) {
      const row = formCData.ageBrackets.find((item) => item.bracket === label);
      if (!row) return 0;
      if (sex === "Male") return row.male;
      if (sex === "Female") return row.female;
      return row.total;
    }

    return residents.filter(
      (r) => (sex ? r.sex === sex : true) && r.age >= min && r.age <= max,
    ).length;
  };

  const getSectorCount = (sector: string, sex?: string) => {
    if (formCData) {
      const row = formCData.sectors.find((item) => item.sector === sector);
      if (!row) return 0;
      if (sex === "Male") return row.male;
      if (sex === "Female") return row.female;
      return row.total;
    }

    return residents.filter(
      (r) =>
        (sex ? r.sex === sex : true) &&
        (r.sector === sector ||
          (r.categories && r.categories.includes(sector))),
    ).length;
  };

  const getCivilStatusCount = (status: string, sex?: string) => {
    if (formCData) {
      const rows = formCData.civilStatus.filter(
        (item) => item.status === status,
      );
      if (sex) {
        return rows
          .filter((item) => item.Sex === sex)
          .reduce((total, item) => total + Number(item.total), 0);
      }
      return rows.reduce((total, item) => total + Number(item.total), 0);
    }

    return residents.filter(
      (r) => (sex ? r.sex === sex : true) && r.civilStatus === status,
    ).length;
  };

  const getCitizenshipCount = (citizenship: string, sex?: string) => {
    if (formCData) {
      const rows = formCData.citizenship.filter(
        (item) => item.citizenship === citizenship,
      );
      if (sex) {
        return rows
          .filter((item) => item.Sex === sex)
          .reduce((total, item) => total + Number(item.total), 0);
      }
      return rows.reduce((total, item) => total + Number(item.total), 0);
    }

    if (citizenship === "Filipino") {
      return residents.filter(
        (r) => (sex ? r.sex === sex : true) && r.citizenship === "Filipino",
      ).length;
    }

    return residents.filter(
      (r) => (sex ? r.sex === sex : true) && r.citizenship !== "Filipino",
    ).length;
  };

  const sectorsToDisplay = formCData?.sectors?.length
    ? formCData.sectors.map((item) => item.sector)
    : sectorList;

  return (
    <Box
      sx={{
        bgcolor: "white",
        p: 6,
        minHeight: "11in",
        height: isPdfExport ? "auto" : "auto",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
        overflow: isPdfExport ? "visible" : "visible",
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: "bold" }}>
        RBI FORM C (Revised 2024)
      </Typography>
      <Typography
        variant="h6"
        align="center"
        sx={{ fontWeight: 800, mt: 1, textTransform: "uppercase" }}
      >
        MONITORING REPORT
      </Typography>
      <Typography variant="body2" align="center" sx={{ mb: 4 }}>
        for {semesterFilter} of CY {yearFilter}
      </Typography>

      <Grid container spacing={0.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2">
            <strong>REGION :</strong> NCR
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2">
            <strong>PROVINCE:</strong> METRO MANILA
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2">
            <strong>CITY/MUNICIPALITY:</strong> MANILA
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2">
            <strong>BARANGAY :</strong> 619
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
          <Typography variant="body2">
            <strong>Total No. of Barangay Inhabitants:</strong>{" "}
            {formCData?.summary.totalInhabitants ?? residents.length}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2">
            <strong>Total No. of Households:</strong>{" "}
            {formCData?.summary.totalHouseholds ?? 0}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2">
            <strong>Total No. of Families:</strong>{" "}
            {formCData?.summary.totalFamilies ?? 0}
          </Typography>
        </Grid>
      </Grid>

      <TableContainer
        component={Paper}
        elevation={0}
        variant="outlined"
        sx={{ borderRadius: 0 }}
      >
        <Table size="small">
          <TableHead sx={{ bgcolor: "#dcfce7" }}>
            <TableRow>
              <TableCell
                sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
              >
                INDICATORS
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
              >
                MALE
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
              >
                FEMALE
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
              >
                TOTAL
              </TableCell>
              <TableCell
                sx={{ fontWeight: "bold", border: "1px solid #bbf7d0" }}
              >
                REMARKS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={{ bgcolor: "#dcfce7" }}>
              <TableCell
                colSpan={5}
                sx={{
                  fontWeight: "bold",
                  border: "1px solid #bbf7d0",
                  fontSize: "0.75rem",
                }}
              >
                Population by Age Bracket:
              </TableCell>
            </TableRow>
            {ageBrackets.map((bracket, i) => (
              <TableRow key={i}>
                <TableCell
                  sx={{
                    pl: 4,
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                  }}
                >
                  {bracket.label}
                </TableCell>
                <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                  {getBracketCount(
                    bracket.label,
                    bracket.range[0],
                    bracket.range[1],
                    "Male",
                  )}
                </TableCell>
                <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                  {getBracketCount(
                    bracket.label,
                    bracket.range[0],
                    bracket.range[1],
                    "Female",
                  )}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ border: "1px solid #e2e8f0", fontWeight: "bold" }}
                >
                  {getBracketCount(
                    bracket.label,
                    bracket.range[0],
                    bracket.range[1],
                  )}
                </TableCell>
                <TableCell sx={{ border: "1px solid #e2e8f0" }}></TableCell>
              </TableRow>
            ))}
            <TableRow ref={sectorHeaderRef} sx={{ bgcolor: "#dcfce7" }}>
              <TableCell
                colSpan={5}
                sx={{
                  fontWeight: "bold",
                  border: "1px solid #bbf7d0",
                  fontSize: "0.75rem",
                }}
              >
                Population by Sector:
              </TableCell>
            </TableRow>
            {sectorsToDisplay.map((sector, i) => (
              <TableRow key={i}>
                <TableCell
                  sx={{
                    pl: 4,
                    border: "1px solid #e2e8f0",
                    fontSize: "0.75rem",
                  }}
                >
                  {sector}
                </TableCell>
                <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                  {getSectorCount(sector, "Male")}
                </TableCell>
                <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                  {getSectorCount(sector, "Female")}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ border: "1px solid #e2e8f0", fontWeight: "bold" }}
                >
                  {getSectorCount(sector)}
                </TableCell>
                <TableCell sx={{ border: "1px solid #e2e8f0" }}></TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                }}
              >
                Civil Status : Single
              </TableCell>
              <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                {getCivilStatusCount("Single", "Male")}
              </TableCell>
              <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                {getCivilStatusCount("Single", "Female")}
              </TableCell>
              <TableCell
                align="center"
                sx={{ border: "1px solid #e2e8f0", fontWeight: "bold" }}
              >
                {getCivilStatusCount("Single")}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}></TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{
                  pl: 4,
                  fontWeight: "bold",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                }}
              >
                : Married
              </TableCell>
              <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                {getCivilStatusCount("Married", "Male")}
              </TableCell>
              <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                {getCivilStatusCount("Married", "Female")}
              </TableCell>
              <TableCell
                align="center"
                sx={{ border: "1px solid #e2e8f0", fontWeight: "bold" }}
              >
                {getCivilStatusCount("Married")}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}></TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                }}
              >
                Citizenship : Filipino
              </TableCell>
              <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                {getCitizenshipCount("Filipino", "Male")}
              </TableCell>
              <TableCell align="center" sx={{ border: "1px solid #e2e8f0" }}>
                {getCitizenshipCount("Filipino", "Female")}
              </TableCell>
              <TableCell
                align="center"
                sx={{ border: "1px solid #e2e8f0", fontWeight: "bold" }}
              >
                {getCitizenshipCount("Filipino")}
              </TableCell>
              <TableCell sx={{ border: "1px solid #e2e8f0" }}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 5, display: "flex", justifyContent: "space-between" }}>
        <Box sx={{ width: "45%" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Prepared by:
          </Typography>
          <Box
            sx={{
              mt: 5,
              borderTop: "1px solid black",
              pt: 0.5,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {barangaySecretaryName}
            </Typography>
            <Typography variant="caption" display="block">
              Barangay Secretary
            </Typography>
          </Box>
        </Box>
        <Box sx={{ width: "45%" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Submitted by:
          </Typography>
          <Box
            sx={{
              mt: 5,
              borderTop: "1px solid black",
              pt: 0.5,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {punongBarangayName}
            </Typography>
            <Typography variant="caption" display="block">
              Punong Barangay
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const Certification_Preview = ({
  inhabitantsCount,
  isPdfExport,
  punongBarangayName,
}: {
  inhabitantsCount: number;
  isPdfExport?: boolean;
  punongBarangayName: string;
}) => {
  const { logoSrc } = useBarangayLogo();

  return (
    <Box
      sx={{
        bgcolor: "white",
        p: 10,
        height: isPdfExport ? "auto" : "11in",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        overflow: isPdfExport ? "visible" : "hidden",
      }}
    >
      <Box sx={{ textAlign: "center", mb: 4 }}>
        {logoSrc ? (
          <Box
            component="img"
            src={logoSrc}
            alt="Barangay Logo"
            sx={{
              width: 100,
              height: 100,
              objectFit: "contain",
              mx: "auto",
              mb: 2,
              borderRadius: "50%",
            }}
          />
        ) : (
          <Box
            sx={{
              width: 100,
              height: 100,
              border: "2px solid #ccc",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
              fontSize: "12px",
              textAlign: "center",
              color: "#666",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            BARANGAY
            <br />
            LOGO
          </Box>
        )}
        <Typography variant="body1" sx={{ fontWeight: 800 }}>
          Barangay 619, Zone 62, District VI
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 800 }}>
          City of Manila
        </Typography>
      </Box>

      <Typography
        variant="h4"
        align="center"
        sx={{ fontWeight: 900, mt: 4, mb: 10, letterSpacing: "0.1em" }}
      >
        CERTIFICATION
      </Typography>

      <Box sx={{ px: 4, mt: 4 }}>
        <Typography
          variant="body1"
          paragraph
          sx={{
            textAlign: "justify",
            lineHeight: 2,
            textIndent: "40px",
            fontSize: "1.1rem",
          }}
        >
          This is to certify that Barangay <strong>619</strong>, Zone{" "}
          <strong>62</strong>, District <strong>VI</strong>, Manila has a total
          of
          <strong> {inhabitantsCount.toLocaleString()}</strong> registered
          barangay inhabitants for the <strong>2nd</strong> quarter of{" "}
          <strong>2025</strong> pursuant to DILG Memorandum Circular 2008-144
          re: Reiteration of Memorandum Circular No. 2005-69 dated July 21 2005
          re: Maintenance and Updating of all Inhabitants of the Barangay.
        </Typography>

        <Typography
          variant="body1"
          sx={{ mt: 6, lineHeight: 2, textIndent: "40px", fontSize: "1.1rem" }}
        >
          Issued this <strong>{new Date().getDate()}th</strong> day of{" "}
          <strong>
            {new Date().toLocaleString("default", { month: "long" })}
          </strong>
          , <strong>{new Date().getFullYear()}</strong> at the{" "}
          <u>address of the Barangay Hall</u>.
        </Typography>
      </Box>

      <Box sx={{ mt: 15, display: "flex", justifyContent: "flex-end", pr: 4 }}>
        <Box sx={{ textAlign: "center", width: 350 }}>
          <Box sx={{ borderTop: "2px solid black", mt: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: "bold", mt: 0.5 }}>
            {punongBarangayName}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Punong Barangay
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

interface DetailedReportDialogProps {
  open: boolean;
  onClose: () => void;
  category: ReportCategory | null;
  yearFilter: string;
  semesterFilter: string;
}

const DetailedReportDialog: React.FC<DetailedReportDialogProps> = ({
  open,
  onClose,
  category,
  yearFilter,
  semesterFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rows, setRows] = useState<ReportDemographicsResident[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    if (!open) return;
    setSearchQuery("");
    setPage(1);
    setSortOrder("asc");
  }, [category?.id, open]);

  useEffect(() => {
    setPage(1);
  }, [sortOrder]);

  const fetchBreakdown = useCallback(async () => {
    if (!open || !category) return;

    setIsLoading(true);
    try {
      const response = await reportService.getDemographicsByCategory(
        category.id,
        {
          search: searchQuery,
          page,
          limit: rowsPerPage,
        },
      );
      setRows(response.data);
      setTotalRows(response.total);
    } catch {
      notify.error(`Failed to load ${category.label} breakdown.`);
      setRows([]);
      setTotalRows(0);
    } finally {
      setIsLoading(false);
    }
  }, [open, category, searchQuery, page, rowsPerPage]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  if (!category) return null;
  const Icon = category.icon;
  const sortedRows = [...rows].sort((a, b) => {
    const compareName = `${a.LastName} ${a.FirstName}`.localeCompare(
      `${b.LastName} ${b.FirstName}`,
      undefined,
      { sensitivity: "base" },
    );

    if (compareName !== 0) {
      return sortOrder === "asc" ? compareName : -compareName;
    }

    return sortOrder === "asc"
      ? Number(a.ResidentID) - Number(b.ResidentID)
      : Number(b.ResidentID) - Number(a.ResidentID);
  });

  const handleExportCSV = async () => {
    try {
      const response = await reportService.getDemographicsByCategory(
        category.id,
        {
          search: searchQuery,
          page: 1,
          limit: Math.max(totalRows, rowsPerPage, 1),
        },
      );

      const headers = [
        "First Name",
        "Last Name",
        "Age",
        "Gender",
        "Household",
        "Street",
      ];
      const csvRows = response.data.map((resident) => [
        resident.FirstName,
        resident.LastName,
        resident.Age,
        resident.Sex,
        resident.Household ?? "",
        resident.Street ?? "",
      ]);

      const periodLabel = `${semesterFilter} ${yearFilter}`;
      const filename = buildFilename(
        ["Demographics", category.label, periodLabel, buildDateToken()],
        "csv",
      );
      const csvContent = [headers, ...csvRows]
        .map((row) =>
          row
            .map((value) => {
              const normalized = value ?? "";
              const text = String(normalized).replace(/"/g, '""');
              return `"${text}"`;
            })
            .join(","),
        )
        .join("\n");

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const nav = window.navigator as Navigator & {
        msSaveOrOpenBlob?: (data: Blob, fileName: string) => void;
      };

      if (typeof nav.msSaveOrOpenBlob === "function") {
        nav.msSaveOrOpenBlob(blob, filename);
      } else {
        const fileUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = filename;
        link.rel = "noopener";
        link.style.display = "none";
        document.body.appendChild(link);
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(fileUrl), 5000);
      }
      notify.success("CSV exported successfully.");
    } catch {
      notify.error("Failed to export CSV.");
    }
  };

  const handleDownloadResidentPdf = async (
    residentId: number,
    firstName: string,
    lastName: string,
  ) => {
    try {
      const blob = await reportService.downloadResidentPdf(residentId);
      const fileUrl = URL.createObjectURL(blob);
      const filename = buildFilename(
        ["Resident Profile", `${lastName} ${firstName}`, buildDateToken()],
        "pdf",
      );
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);
      notify.success("Resident PDF downloaded.");
    } catch {
      notify.error("Failed to download resident PDF.");
    }
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
    >
      <Box
        sx={{
          bgcolor: "#f8fafc",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "white",
            color: "#1e293b",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Toolbar sx={{ height: 80, justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <IconButton
                edge="start"
                onClick={onClose}
                sx={{ mr: 2, color: "#64748b" }}
              >
                <X />
              </IconButton>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: `${category.color}15`,
                    color: category.color,
                  }}
                >
                  <Icon size={24} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {category.label} Demographics
                </Typography>
              </Box>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<FileDown size={18} />}
                onClick={handleExportCSV}
                sx={{
                  borderRadius: 2.5,
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                Download CSV
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ flex: 1, py: 4 }}>
          <Grid container spacing={3}>
            {/* Summary Stat Card */}
            <Grid size={{ xs: 12 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  border: "1px solid #e5e7eb",
                  bgcolor: "white",
                }}
              >
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor: `${category.color}15`,
                    color: category.color,
                  }}
                >
                  <Icon size={48} strokeWidth={1.5} />
                </Box>
                <Box>
                  <Typography
                    variant="h3"
                    sx={{ fontWeight: 900, color: "#1e293b" }}
                  >
                    {totalRows}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ color: "text.secondary", fontWeight: 600 }}
                  >
                    Total Found in {category.label}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <TextField
                  placeholder="Search by name or household..."
                  size="small"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  sx={{
                    width: 350,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      bgcolor: "#f8fafc",
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
              </Paper>
            </Grid>

            {/* Data Table */}
            <Grid size={{ xs: 12 }}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 4,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  bgcolor: "white",
                }}
              >
                <TableContainer sx={{ maxHeight: "calc(100vh - 350px)" }}>
                  <Table
                    stickyHeader
                    sx={{ tableLayout: "fixed", minWidth: 1150 }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "25%",
                          }}
                        >
                          NAME
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "7%",
                          }}
                        >
                          AGE
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "10%",
                          }}
                        >
                          SEX
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "11%",
                          }}
                        >
                          HOUSEHOLD
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "14%",
                          }}
                        >
                          STREET
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "12%",
                          }}
                        >
                          CIVIL STATUS
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            width: "13%",
                          }}
                        >
                          CITIZENSHIP
                        </TableCell>
                        <TableCell
                          sx={{
                            bgcolor: "#f8fafc",
                            fontWeight: 800,
                            color: "#64748b",
                            textAlign: "center",
                            width: "8%",
                          }}
                        >
                          ACTIONS
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {isLoading && (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                            <Typography variant="body1" color="text.secondary">
                              Loading records...
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {!isLoading &&
                        sortedRows.map((res) => (
                          <TableRow key={res.ResidentID} hover>
                            <TableCell
                              sx={{ fontWeight: 700, color: "#1e293b" }}
                            >
                              {res.LastName}, {res.FirstName}
                            </TableCell>
                            <TableCell>{res.Age}</TableCell>
                            <TableCell>
                              <Chip
                                label={res.Sex}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: "0.65rem",
                                  bgcolor:
                                    res.Sex === "Male" ? "#eff6ff" : "#fdf2f8",
                                  color:
                                    res.Sex === "Male" ? "#1d4ed8" : "#be185d",
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {res.Household ?? "-"}
                            </TableCell>
                            <TableCell>{res.Street ?? "-"}</TableCell>
                            <TableCell>{res.CivilStatus}</TableCell>
                            <TableCell>{res.Citizenship}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() =>
                                  handleDownloadResidentPdf(
                                    res.ResidentID,
                                    res.FirstName,
                                    res.LastName,
                                  )
                                }
                              >
                                <Download size={17} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      {!isLoading && rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                            <Typography variant="body1" color="text.secondary">
                              No records found.
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
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 2,
                    px: 2,
                    py: 1,
                    borderTop: "1px solid #e5e7eb",
                  }}
                >
                  <SortOrderToggle
                    order={sortOrder}
                    onToggle={() =>
                      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                    }
                    label="Sort"
                  />
                  <TablePagination
                    rowsPerPageOptions={[10, 25, 50]}
                    component="div"
                    count={totalRows}
                    rowsPerPage={rowsPerPage}
                    page={Math.max(page - 1, 0)}
                    onPageChange={(_e, newPage) => setPage(newPage + 1)}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(1);
                    }}
                    sx={{ ml: "auto" }}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Dialog>
  );
};

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [semesterFilter, setSemesterFilter] = useState("2nd Semester");
  const [rbiTemplate, setRbiTemplate] = useState("Form A");
  const [selectedReport, setSelectedReport] = useState<ReportCategory | null>(
    null,
  );
  const [demographicsSummary, setDemographicsSummary] =
    useState<ReportDemographicsSummary | null>(null);
  const [formAPreviewResidents, setFormAPreviewResidents] = useState<
    ResidentRecord[]
  >([]);
  const [formAPreviewPage, setFormAPreviewPage] = useState(1);
  const [formAPreviewRowsPerPage, setFormAPreviewRowsPerPage] = useState(25);
  const [formAPreviewTotalRows, setFormAPreviewTotalRows] = useState(0);
  const [formCData, setFormCData] = useState<ReportFormCData | null>(null);
  const [isDemographicsLoading, setIsDemographicsLoading] = useState(false);
  const [isRbiLoading, setIsRbiLoading] = useState(false);
  const [isFormAPreviewLoading, setIsFormAPreviewLoading] = useState(false);
  const [formAExportingFormat, setFormAExportingFormat] =
    useState<ReportFormAExportFormat | null>(null);
  const [isTemplatePdfExporting, setIsTemplatePdfExporting] = useState(false);
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [officials, setOfficials] = useState<Official[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<
    number | undefined
  >(undefined);
  const rbiPreviewRef = useRef<HTMLDivElement | null>(null);
  const formCSectorHeaderRef = useRef<HTMLTableRowElement>(null!);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const fetchDemographics = useCallback(async () => {
    setIsDemographicsLoading(true);
    try {
      const data = await reportService.getDemographicsSummary();
      setDemographicsSummary(data);
    } catch {
      notify.error("Failed to load demographics report.");
    } finally {
      setIsDemographicsLoading(false);
    }
  }, []);

  const fetchFormCData = useCallback(async () => {
    setIsRbiLoading(true);
    try {
      const formC = await reportService.getFormCData();
      setFormCData(formC);
    } catch {
      notify.error("Failed to load RBI report data.");
    } finally {
      setIsRbiLoading(false);
    }
  }, []);

  const fetchFormAPreview = useCallback(async () => {
    setIsFormAPreviewLoading(true);
    try {
      const response = await reportService.getFormAPreview({
        householdId: selectedHouseholdId,
        page: formAPreviewPage,
        limit: formAPreviewRowsPerPage,
      });

      const offset = (response.page - 1) * response.limit;
      setFormAPreviewResidents(
        response.data.map((record, index) =>
          toResidentRecord(record, offset + index),
        ),
      );
      setFormAPreviewTotalRows(response.total);
    } catch {
      notify.error("Failed to load Form A preview data.");
      setFormAPreviewResidents([]);
      setFormAPreviewTotalRows(0);
    } finally {
      setIsFormAPreviewLoading(false);
    }
  }, [formAPreviewPage, formAPreviewRowsPerPage, selectedHouseholdId]);

  useEffect(() => {
    fetchDemographics();
    fetchFormCData();
    householdService
      .getAll()
      .then(setHouseholds)
      .catch(() => {});
    officialService
      .getActive()
      .then(setOfficials)
      .catch(() => {
        notify.error("Failed to load barangay officials.");
      });
  }, [fetchDemographics, fetchFormCData]);

  const refreshReportHouseholdData = useCallback(() => {
    fetchDemographics();
    fetchFormCData();
    householdService
      .getAll()
      .then(setHouseholds)
      .catch(() => {});
  }, [fetchDemographics, fetchFormCData]);

  useHouseholdDataRefresh(refreshReportHouseholdData);

  useEffect(() => {
    fetchFormAPreview();
  }, [fetchFormAPreview]);

  const startYear = 2020;
  const endYear = currentYear;
  const yearOptions = Array.from(
    { length: endYear - startYear + 1 },
    (_value, index) => String(endYear - index),
  );

  const stats = [
    {
      id: "inhabitants",
      label: "Total Inhabitants",
      value: (demographicsSummary?.stats.inhabitants ?? 0).toLocaleString(),
      icon: Users,
      color: "#3b82f6",
    },
    {
      id: "household",
      label: "Total Household",
      value: (demographicsSummary?.stats.households ?? 0).toLocaleString(),
      icon: Home,
      color: "#8b5cf6",
    },
    {
      id: "families",
      label: "Families Recorded",
      value: (demographicsSummary?.stats.families ?? 0).toLocaleString(),
      icon: UsersRound,
      color: "#f59e0b",
    },
    {
      id: "voters",
      label: "Registered Voters",
      value: (demographicsSummary?.stats.voters ?? 0).toLocaleString(),
      icon: Vote,
      color: "#10b981",
    },
    {
      id: "seniors",
      label: "Senior Citizens",
      value: (demographicsSummary?.stats.seniors ?? 0).toLocaleString(),
      icon: Heart,
      color: "#ef4444",
    },
    {
      id: "pwd",
      label: "PWD Count",
      value: (demographicsSummary?.stats.pwd ?? 0).toLocaleString(),
      icon: Accessibility,
      color: "#06b6d4",
    },
    {
      id: "solo",
      label: "Solo Parents",
      value: (demographicsSummary?.stats.soloParent ?? 0).toLocaleString(),
      icon: UserSquare,
      color: "#ec4899",
    },
    {
      id: "indigent",
      label: "Indigent Records",
      value: (demographicsSummary?.stats.indigent ?? 0).toLocaleString(),
      icon: ShieldAlert,
      color: "#6366f1",
    },
  ];

  const ageChartData = demographicsSummary?.charts.ageGroups ?? [];
  const employmentChartData = demographicsSummary?.charts.employment ?? [];

  const templates = [
    {
      id: "Form A",
      title: "Form A (RBI Form By Household)",
      icon: ClipboardList,
      desc: "Detailed household inhabitant registry.",
      color: "#4f46e5",
    },
    {
      id: "Form C",
      title: "Form C (RBI Population Bracketing)",
      icon: TrendingUp,
      desc: "Population summary report.",
      color: "#0891b2",
    },
    {
      id: "Cert",
      title: "Certification",
      icon: Stamp,
      desc: "Official population count certification.",
      color: "#be185d",
    },
  ];

  const handleFormAExport = async (format: ReportFormAExportFormat) => {
    if (rbiTemplate !== "Form A") {
      notify.info("Form A exports are available only when Form A is selected.");
      return;
    }

    if (formAExportingFormat) return;

    const formatLabel = format.toUpperCase();
    setFormAExportingFormat(format);
    notify.info(`Preparing Form A ${formatLabel} export...`);

    try {
      const { blob } = await reportService.exportFormA(
        format,
        selectedHouseholdId,
      );

      const selectedHousehold = households.find(
        (household) => household.HouseholdID === selectedHouseholdId,
      );
      const householdLabel = selectedHouseholdId
        ? selectedHousehold?.householdNumber
          ? `Household ${selectedHousehold.householdNumber}`
          : `Household ${selectedHouseholdId}`
        : "All Households";
      const periodLabel = `${semesterFilter} ${yearFilter}`;
      const filename = buildFilename(
        ["RBI Form A", periodLabel, householdLabel, buildDateToken()],
        format,
      );

      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);

      notify.success(`Form A ${formatLabel} exported successfully.`);
    } catch {
      notify.error(`Failed to export Form A ${formatLabel}.`);
    } finally {
      setFormAExportingFormat(null);
    }
  };

  const handleTemplatePdfDownload = async () => {
    if (rbiTemplate === "Form A") {
      await handleFormAExport("pdf");
      return;
    }

    if (!rbiPreviewRef.current) {
      notify.error("Preview is not ready for export.");
      return;
    }

    const periodLabel = `${semesterFilter} ${yearFilter}`;
    const filename = buildFilename(
      [
        rbiTemplate === "Form C" ? "RBI Form C" : "Barangay Certification",
        periodLabel,
        buildDateToken(),
      ],
      "pdf",
    );

    notify.info("Preparing PDF export...");
    setIsTemplatePdfExporting(true);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const previewElement = rbiPreviewRef.current;
    const prevTransform = previewElement.style.transform;
    const prevTransformOrigin = previewElement.style.transformOrigin;
    const prevWidth = previewElement.style.width;
    const prevMaxWidth = previewElement.style.maxWidth;
    const prevHeight = previewElement.style.height;
    const prevMaxHeight = previewElement.style.maxHeight;
    const prevOverflow = previewElement.style.overflow;
    const prevZoom = previewElement.style.zoom;

    previewElement.style.transform = "none";
    previewElement.style.transformOrigin = "top left";
    previewElement.style.width = "8.5in";
    previewElement.style.maxWidth = "8.5in";
    previewElement.style.height = "auto";
    previewElement.style.maxHeight = "none";
    previewElement.style.overflow = "visible";
    previewElement.style.zoom = "1";

    try {
      const canvas = await html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: rbiTemplate === "Form C" ? [8.5, 13] : "letter",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      const previewRect = previewElement.getBoundingClientRect();
      const scale = canvas.width / previewRect.width;
      const sectorRect = formCSectorHeaderRef.current?.getBoundingClientRect();
      const sectorOffset =
        rbiTemplate === "Form C" && sectorRect
          ? Math.max(0, (sectorRect.top - previewRect.top) * scale)
          : null;

      const sliceCanvas = (
        source: HTMLCanvasElement,
        y: number,
        height: number,
      ) => {
        const out = document.createElement("canvas");
        out.width = source.width;
        out.height = height;
        const ctx = out.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            source,
            0,
            y,
            source.width,
            height,
            0,
            0,
            out.width,
            out.height,
          );
        }
        return out;
      };

      if (rbiTemplate === "Form C") {
        const fitScale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        const fitWidth = imgWidth * fitScale;
        const fitHeight = imgHeight * fitScale;
        const xOffset = (pageWidth - fitWidth) / 2;
        const yOffset = (pageHeight - fitHeight) / 2;
        pdf.addImage(imgData, "JPEG", xOffset, yOffset, fitWidth, fitHeight);
      } else if (
        sectorOffset &&
        sectorOffset > 0 &&
        sectorOffset < canvas.height
      ) {
        const firstCanvas = sliceCanvas(canvas, 0, Math.floor(sectorOffset));
        const firstData = firstCanvas.toDataURL("image/jpeg", 0.98);
        const firstProps = pdf.getImageProperties(firstData);
        const firstHeight = (firstProps.height * imgWidth) / firstProps.width;
        pdf.addImage(firstData, "JPEG", 0, 0, imgWidth, firstHeight);

        const remainingHeight = canvas.height - Math.floor(sectorOffset);
        const remainingCanvas = sliceCanvas(
          canvas,
          Math.floor(sectorOffset),
          remainingHeight,
        );
        const remainingData = remainingCanvas.toDataURL("image/jpeg", 0.98);
        const remainingProps = pdf.getImageProperties(remainingData);
        const remainingImgHeight =
          (remainingProps.height * imgWidth) / remainingProps.width;

        let remaining = remainingImgHeight;
        let yOffset = 0;
        pdf.addPage();
        while (remaining > 0) {
          pdf.addImage(
            remainingData,
            "JPEG",
            0,
            -yOffset,
            imgWidth,
            remainingImgHeight,
          );
          remaining -= pageHeight;
          yOffset += pageHeight;
          if (remaining > 0) {
            pdf.addPage();
          }
        }
      } else if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      } else {
        let remainingHeight = imgHeight;
        let yOffset = 0;

        while (remainingHeight > 0) {
          pdf.addImage(imgData, "JPEG", 0, -yOffset, imgWidth, imgHeight);
          remainingHeight -= pageHeight;
          yOffset += pageHeight;

          if (remainingHeight > 0) {
            pdf.addPage();
          }
        }
      }

      pdf.save(filename);
      notify.success("PDF downloaded successfully.");

      if (rbiTemplate === "Form C" || rbiTemplate === "Cert") {
        const inhabitantsCount =
          demographicsSummary?.stats.inhabitants ??
          formCData?.summary.totalInhabitants ??
          formAPreviewTotalRows ??
          0;

        const metadata = {
          periodLabel,
          year: yearFilter,
          semester: semesterFilter,
          totalInhabitants: inhabitantsCount,
          totalHouseholds: formCData?.summary.totalHouseholds ?? null,
          totalFamilies: formCData?.summary.totalFamilies ?? null,
        };

        try {
          await reportService.logExportAudit(
            rbiTemplate === "Form C" ? "FORM_C" : "BARANGAY_CERTIFICATION",
            metadata,
          );
        } catch {
          // Best-effort audit logging; do not block user download.
        }
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `Failed to download PDF: ${error.message}`
          : "Failed to download PDF.";
      notify.error(message);
    } finally {
      previewElement.style.transform = prevTransform;
      previewElement.style.transformOrigin = prevTransformOrigin;
      previewElement.style.width = prevWidth;
      previewElement.style.maxWidth = prevMaxWidth;
      previewElement.style.height = prevHeight;
      previewElement.style.maxHeight = prevMaxHeight;
      previewElement.style.overflow = prevOverflow;
      previewElement.style.zoom = prevZoom;
      setIsTemplatePdfExporting(false);
    }
  };

  const formAPreviewStart =
    formAPreviewTotalRows === 0
      ? 0
      : (formAPreviewPage - 1) * formAPreviewRowsPerPage + 1;
  const formAPreviewEnd = Math.min(
    formAPreviewPage * formAPreviewRowsPerPage,
    formAPreviewTotalRows,
  );
  const selectedHousehold = households.find(
    (household) => household.HouseholdID === selectedHouseholdId,
  );
  const formAHouseholdName = selectedHouseholdId
    ? selectedHousehold?.householdNumber
      ? `Household ${selectedHousehold.householdNumber}`
      : `Household ${selectedHouseholdId}`
    : "All Households";
  const normalizePosition = (value: string) => value.trim().toLowerCase();
  const buildOfficialName = (official?: Official) =>
    official ? `Hon. ${official.FirstName} ${official.LastName}` : "";
  const getOfficialByPosition = (positions: string[]) => {
    const normalized = positions.map(normalizePosition);
    return (
      officials.find((official) =>
        normalized.includes(normalizePosition(official.Position)),
      ) ||
      officials.find((official) =>
        normalized.some((position) =>
          normalizePosition(official.Position).includes(position),
        ),
      )
    );
  };
  const barangaySecretaryName = buildOfficialName(
    getOfficialByPosition(["Barangay Secretary", "Secretary"]),
  );
  const punongBarangayName = buildOfficialName(
    getOfficialByPosition([
      "Punong Barangay",
      "Barangay Captain",
      "Barangay Chairman",
    ]),
  );

  return (
    <Box
      sx={{
        p: 4,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "#f3f4f6",
        pointerEvents: "auto",
      }}
    >
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: "#2e0249", mb: 1 }}
          >
            Barangay Reports
          </Typography>
          <Typography variant="body1" sx={{ color: "#64748b" }}>
            Official analytics and RBI records management for Barangay 619 Zone
            62.
          </Typography>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          borderRadius: 4,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "white",
            px: 2,
            flexShrink: 0,
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 700,
                fontSize: "1rem",
                minHeight: 64,
                px: 5,
              },
            }}
          >
            <Tab
              icon={<BarChart4 size={20} />}
              iconPosition="start"
              label="Demographics"
            />
            <Tab
              icon={<FileSpreadsheet size={20} />}
              iconPosition="start"
              label="RBI Registry"
            />
          </Tabs>
        </Box>

        {/* Tab content area */}
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          {/* Tab 0: Demographics */}
          {tabValue === 0 && (
            <Box
              sx={{
                p: 4,
                bgcolor: "#f8fafc",
                height: "100%",
                overflowY: "auto",
              }}
            >
              {isDemographicsLoading && (
                <Typography
                  variant="body2"
                  sx={{ mb: 2, color: "text.secondary", fontWeight: 600 }}
                >
                  Loading demographics data...
                </Typography>
              )}
              <Grid container spacing={3} sx={{ mb: 6 }}>
                {stats.map((stat, i) => (
                  <Grid size={{ xs: 12, md: 6 }} key={i}>
                    <Box
                      onClick={() => setSelectedReport(stat)}
                      sx={{
                        bgcolor: "white",
                        borderRadius: 3,
                        p: 3.5,
                        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                        border: "1px solid #f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        "&:hover": {
                          transform: "translateY(-3px)",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                          borderColor: stat.color,
                        },
                      }}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: "bold",
                            color: stat.color,
                            textTransform: "uppercase",
                            mb: 1,
                            display: "block",
                          }}
                        >
                          {stat.label}
                        </Typography>
                        <Typography
                          variant="h3"
                          sx={{ fontWeight: 900, color: "#1e293b" }}
                        >
                          {stat.value}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", fontWeight: "bold" }}
                        >
                          View Breakdown
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          bgcolor: `${stat.color}15`,
                          color: stat.color,
                        }}
                      >
                        <stat.icon size={36} strokeWidth={1.5} />
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Stack spacing={4}>
                <Paper
                  variant="outlined"
                  sx={{ p: 4, borderRadius: 3, height: 500 }}
                >
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                    Age Group Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={ageChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <RechartsTooltip cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {ageChartData.map((_entry, index) => (
                          <Cell
                            key={index}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
                <Paper
                  variant="outlined"
                  sx={{ p: 4, borderRadius: 3, height: 500 }}
                >
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                    Employment Breakdown
                  </Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart layout="vertical" data={employmentChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        width={150}
                      />
                      <RechartsTooltip />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {employmentChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Stack>
            </Box>
          )}

          {/* Tab 1: RBI Registry Generator */}
          {tabValue === 1 && (
            <Box sx={{ display: "flex", height: "100%", bgcolor: "#f1f5f9" }}>
              {/* Left Document Preview Area (Independent Scroll) */}
              <Box
                sx={{
                  flex: 1,
                  p: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  overflowY: "auto",
                  bgcolor: "#f1f5f9",
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    maxWidth: "8.5in",
                    mb: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Document Preview{" "}
                    <span style={{ marginLeft: 8, color: "#cbd5e1" }}>|</span>{" "}
                    Standard Letter (8.5" x 11")
                  </Typography>
                  <IconButton size="small" sx={{ color: "#64748b" }}>
                    <Maximize2 size={18} />
                  </IconButton>
                </Box>

                {(isRbiLoading ||
                  (rbiTemplate === "Form A" && isFormAPreviewLoading)) && (
                  <Typography
                    variant="body2"
                    sx={{ mb: 2, color: "text.secondary", fontWeight: 600 }}
                  >
                    {rbiTemplate === "Form A"
                      ? "Loading Form A preview data..."
                      : "Loading RBI data..."}
                  </Typography>
                )}

                <Zoom in={true} key={rbiTemplate}>
                  <Box
                    ref={rbiPreviewRef}
                    sx={{ width: "100%", maxWidth: "8.5in" }}
                  >
                    {rbiTemplate === "Form A" && (
                      <Stack spacing={2}>
                        <FormA_Preview
                          residents={formAPreviewResidents}
                          totalResidents={formAPreviewTotalRows}
                          householdName={formAHouseholdName}
                          householdStreet={
                            selectedHousehold?.Street_Alley_Zone || ""
                          }
                          barangaySecretaryName={barangaySecretaryName}
                          punongBarangayName={punongBarangayName}
                        />
                        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                          <Box
                            sx={{
                              px: 2,
                              pt: 1,
                              color: "#475569",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            Showing {formAPreviewStart.toLocaleString()}-
                            {formAPreviewEnd.toLocaleString()} of{" "}
                            {formAPreviewTotalRows.toLocaleString()} records
                          </Box>
                          <TablePagination
                            component="div"
                            count={formAPreviewTotalRows}
                            rowsPerPage={formAPreviewRowsPerPage}
                            page={Math.max(formAPreviewPage - 1, 0)}
                            onPageChange={(_event, newPage) =>
                              setFormAPreviewPage(newPage + 1)
                            }
                            onRowsPerPageChange={(event) => {
                              setFormAPreviewRowsPerPage(
                                parseInt(event.target.value, 10),
                              );
                              setFormAPreviewPage(1);
                            }}
                            rowsPerPageOptions={[25, 50, 100]}
                          />
                        </Paper>
                      </Stack>
                    )}
                    {rbiTemplate === "Form C" && (
                      <FormC_Preview
                        residents={formAPreviewResidents}
                        formCData={formCData}
                        isPdfExport={isTemplatePdfExporting}
                        sectorHeaderRef={formCSectorHeaderRef}
                        barangaySecretaryName={barangaySecretaryName}
                        punongBarangayName={punongBarangayName}
                        semesterFilter={semesterFilter}
                        yearFilter={yearFilter}
                      />
                    )}

                    {rbiTemplate === "Cert" && (
                      <Certification_Preview
                        inhabitantsCount={
                          demographicsSummary?.stats.inhabitants ??
                          formCData?.summary.totalInhabitants ??
                          formAPreviewTotalRows ??
                          0
                        }
                        isPdfExport={isTemplatePdfExporting}
                        punongBarangayName={punongBarangayName}
                      />
                    )}
                  </Box>
                </Zoom>

                {/* Keep a little scroll tail for non-Form A previews only */}
                {rbiTemplate !== "Form A" && (
                  <Box sx={{ height: 100, flexShrink: 0 }} />
                )}
              </Box>

              {/* Right Control Panel / Sidebar (Independent Scroll) */}
              <Box
                sx={{
                  width: 340,
                  borderLeft: "1px solid #e2e8f0",
                  p: 3,
                  bgcolor: "white",
                  flexShrink: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 3,
                    fontWeight: 800,
                    color: "#1e293b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Layers size={18} /> Select Template
                </Typography>

                <Stack spacing={2} sx={{ mb: 4 }}>
                  {templates.map((tmpl) => (
                    <Card
                      key={tmpl.id}
                      elevation={0}
                      onClick={() => setRbiTemplate(tmpl.id)}
                      sx={{
                        border: "2px solid",
                        borderColor:
                          rbiTemplate === tmpl.id ? tmpl.color : "#f1f5f9",
                        bgcolor:
                          rbiTemplate === tmpl.id
                            ? `${tmpl.color}05`
                            : "transparent",
                        borderRadius: 3,
                        transition: "all 0.2s",
                        "&:hover": {
                          borderColor:
                            rbiTemplate === tmpl.id ? tmpl.color : "#e2e8f0",
                        },
                      }}
                    >
                      <CardActionArea sx={{ p: 2 }}>
                        <Box sx={{ display: "flex", gap: 2 }}>
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor:
                                rbiTemplate === tmpl.id
                                  ? tmpl.color
                                  : "#f1f5f9",
                              color:
                                rbiTemplate === tmpl.id ? "white" : "#64748b",
                            }}
                          >
                            <tmpl.icon size={24} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              variant="body1"
                              fontWeight="bold"
                              sx={{ color: "#1e293b" }}
                            >
                              {tmpl.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {tmpl.desc}
                            </Typography>
                          </Box>
                          {rbiTemplate === tmpl.id && (
                            <ChevronLeft
                              size={18}
                              className="text-gray-400 mt-2"
                            />
                          )}
                        </Box>
                      </CardActionArea>
                    </Card>
                  ))}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 2,
                    fontWeight: 800,
                    color: "#1e293b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Calendar size={18} /> Configuration
                </Typography>

                <Stack spacing={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Reporting Period</InputLabel>
                    <Select
                      value={semesterFilter}
                      label="Reporting Period"
                      onChange={(e) => setSemesterFilter(e.target.value)}
                    >
                      <MenuItem value="1st Semester">
                        1st Semester (Jan-Jun)
                      </MenuItem>
                      <MenuItem value="2nd Semester">
                        2nd Semester (Jul-Dec)
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel>Target Year</InputLabel>
                    <Select
                      value={yearFilter}
                      label="Target Year"
                      onChange={(e) => setYearFilter(e.target.value)}
                    >
                      {yearOptions.map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {rbiTemplate === "Form A" && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Household</InputLabel>
                      <Select<number | "">
                        value={selectedHouseholdId ?? ""}
                        label="Household"
                        onChange={(e) => {
                          const val = e.target.value as number | "";
                          setSelectedHouseholdId(
                            val === "" ? undefined : Number(val),
                          );
                          setFormAPreviewPage(1);
                        }}
                      >
                        <MenuItem value="">
                          <em>All Households</em>
                        </MenuItem>
                        {households.map((hh) => (
                          <MenuItem key={hh.HouseholdID} value={hh.HouseholdID}>
                            {hh.householdNumber ??
                              `Household #${hh.HouseholdID}`}
                            {hh.Street_Alley_Zone
                              ? ` — ${hh.Street_Alley_Zone}`
                              : ""}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Stack>

                <Box sx={{ mt: "auto", pt: 4 }}>
                  <Stack spacing={2}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<FileDown size={18} />}
                      onClick={() => void handleFormAExport("csv")}
                      disabled={
                        rbiTemplate !== "Form A" || !!formAExportingFormat
                      }
                      sx={{ fontWeight: 700, borderRadius: 2, py: 1.5 }}
                    >
                      {formAExportingFormat === "csv"
                        ? "Exporting CSV..."
                        : "Download CSV"}
                    </Button>

                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<FileSpreadsheet size={18} />}
                      onClick={() => void handleFormAExport("xlsx")}
                      disabled={
                        rbiTemplate !== "Form A" || !!formAExportingFormat
                      }
                      sx={{ fontWeight: 700, borderRadius: 2, py: 1.5 }}
                    >
                      {formAExportingFormat === "xlsx"
                        ? "Exporting XLSX..."
                        : "Download XLSX"}
                    </Button>

                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<Printer size={18} />}
                      onClick={() => void handleTemplatePdfDownload()}
                      disabled={
                        rbiTemplate === "Form A" && !!formAExportingFormat
                      }
                      sx={{
                        bgcolor: "#2e0249",
                        fontWeight: 700,
                        borderRadius: 2,
                        py: 1.5,
                      }}
                    >
                      {rbiTemplate === "Form A" &&
                      formAExportingFormat === "pdf"
                        ? "Preparing Official PDF..."
                        : rbiTemplate === "Form A"
                          ? "Official PDF"
                          : "Download PDF"}
                    </Button>

                    <Typography variant="caption" color="text.secondary">
                      Form A only: CSV/XLSX for high-volume export, Official PDF
                      for printable copy.
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
      <DetailedReportDialog
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        category={selectedReport}
        yearFilter={yearFilter}
        semesterFilter={semesterFilter}
      />
    </Box>
  );
};

export default Reports;
