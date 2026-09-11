import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Select,
  MenuItem,
  IconButton,
  Popover,
  TextField,
  Typography,
  FormControl,
  InputAdornment,
  Pagination,
  Chip,
} from "@mui/material";
import { Calendar, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { auditService } from "../services/auditService";
import { notify } from "../utils/notify";
import type { AuditLog } from "../types";
import SortOrderToggle, { type SortOrder } from "./SortOrderToggle";

interface AuditLogRow {
  id: number;
  user: string;
  date: string;
  timestamp: string;
  timestampMs: number;
  action: string;
  actionLabel: string;
  tone: "blue" | "green" | "red" | "neutral";
  oldRecord: string;
  newRecord: string;
  oldRecordText: string;
  newRecordText: string;
}

const toSentenceCase = (value: string): string => {
  if (!value.trim()) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const formatRoleValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const lower = value.trim().toLowerCase();
  if (lower === "admin" || lower === "staff") {
    return toSentenceCase(lower);
  }
  return value;
};

const normalizeAuditPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditPayload(item));
  }

  if (value && typeof value === "object") {
    const normalizedEntries = Object.entries(
      value as Record<string, unknown>,
    ).map(([key, nestedValue]) => {
      const normalizedNestedValue = normalizeAuditPayload(nestedValue);
      const shouldFormatRole = key.toLowerCase().includes("role");
      return [
        key,
        shouldFormatRole
          ? formatRoleValue(normalizedNestedValue)
          : normalizedNestedValue,
      ];
    });

    return Object.fromEntries(normalizedEntries);
  }

  return formatRoleValue(value);
};

const parseAuditPayload = (value?: string): unknown => {
  if (!value) return undefined;
  try {
    return normalizeAuditPayload(JSON.parse(value));
  } catch {
    return normalizeAuditPayload(value);
  }
};

const prettifyKey = (key: string): string => {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => toSentenceCase(part))
    .join(" ");
};

const stringifyAuditValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyAuditValue(item)).join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "-";
    return entries
      .map(([key, nestedValue]) => {
        const rendered = stringifyAuditValue(nestedValue);
        return `${prettifyKey(key)}: ${rendered}`;
      })
      .join(" | ");
  }
  return String(value);
};

const getActionTone = (
  action: string,
): "blue" | "green" | "red" | "neutral" => {
  if (/(LOGOUT|FAILED|DEACTIVATE|ARCHIVE|DELETE)/.test(action)) {
    return "red";
  }
  if (/(UPDATE|CHANGE|EDIT)/.test(action)) {
    return "blue";
  }
  if (/(LOGIN|CREATE|ADD|ASSIGN|RESTORE|ACTIVATE|BACKUP)/.test(action)) {
    return "green";
  }
  return "neutral";
};

const actionLabelMap: Record<string, string> = {
  USER_LOGIN: "User Logged In",
  USER_LOGOUT: "User Logged Out",
  UPDATE_BARANGAY_INFO: "Updated Barangay Info",
};

const getActionLabel = (action: string): string => {
  if (actionLabelMap[action]) return actionLabelMap[action];
  return action
    .toLowerCase()
    .split("_")
    .map((part) => toSentenceCase(part))
    .join(" ");
};

const IGNORED_KEYS = ["id", "password", "createdAt", "updatedAt"];

const filterIgnoredKeys = (parsed: any): any => {
  if (typeof parsed !== "object" || parsed === null) return parsed;
  if (Array.isArray(parsed)) return parsed.map(filterIgnoredKeys);
  
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!IGNORED_KEYS.includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
};

const getDiff = (oldParsed: any, newParsed: any, kind: "old" | "new"): any => {
  if (typeof oldParsed !== "object" || typeof newParsed !== "object" || !oldParsed || !newParsed) {
    return filterIgnoredKeys(kind === "old" ? oldParsed : newParsed);
  }

  const diff: Record<string, any> = {};
  const allKeys = Array.from(new Set([...Object.keys(oldParsed), ...Object.keys(newParsed)]));
  
  for (const key of allKeys) {
    if (IGNORED_KEYS.includes(key)) continue;
    // Compare stringified values to catch nested differences
    if (JSON.stringify(oldParsed[key]) !== JSON.stringify(newParsed[key])) {
      diff[key] = kind === "old" ? oldParsed[key] : newParsed[key];
    }
  }
  
  if (Object.keys(diff).length === 0) return "No significant changes";
  return diff;
};

const formatAuditRecordText = (
  action: string,
  rawValue: string | undefined,
  kind: "old" | "new",
  otherRawValue?: string | undefined
): string => {
  if (!rawValue) {
    return kind === "old" ? "No previous value." : "No additional details.";
  }

  let parsed = parseAuditPayload(rawValue);

  // If this is an update and we have both old and new values, filter to show only changes
  if (/(UPDATE|CHANGE|EDIT)/.test(action) && otherRawValue) {
      const otherParsed = parseAuditPayload(otherRawValue);
      parsed = kind === "old" ? getDiff(parsed, otherParsed, "old") : getDiff(otherParsed, parsed, "new");
  } else {
      parsed = filterIgnoredKeys(parsed);
  }

  const details = stringifyAuditValue(parsed);

  if (/(UPDATE|CHANGE|EDIT)/.test(action)) {
    return kind === "old" ? `${details}` : `${details}`;
  }

  if (/USER_LOGIN/.test(action) || /USER_LOGOUT/.test(action)) {
    return `${details}`;
  }

  return `Details: ${details}`;
};

const getToneStyles = (tone: "blue" | "green" | "red" | "neutral") => {
  switch (tone) {
    case "blue":
      return { text: "#1d4ed8", bg: "#eff6ff" };
    case "green":
      return { text: "#166534", bg: "#dcfce7" };
    case "red":
      return { text: "#991b1b", bg: "#fee2e2" };
    default:
      return { text: "#475569", bg: "#f1f5f9" };
  }
};

const formatUserCell = (
  username: string | undefined,
  userId: number,
): string => {
  if (!username) return `User ${userId}`;
  return toSentenceCase(username);
};

const mapAuditLogToRow = (log: AuditLog): AuditLogRow => {
  const parsedDate = new Date(log.Timestamp);
  const isValidDate = !Number.isNaN(parsedDate.getTime());
  const tone = getActionTone(log.Action);

  return {
    id: log.LogID,
    user: formatUserCell(log.Username, log.UserID),
    date: isValidDate ? parsedDate.toLocaleDateString("en-CA") : "-",
    timestamp: isValidDate
      ? parsedDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : String(log.Timestamp || "-"),
    timestampMs: isValidDate ? parsedDate.getTime() : 0,
    action: log.Action,
    actionLabel: getActionLabel(log.Action),
    tone,
    oldRecord: log.OldValue || "-",
    newRecord: log.NewValue || "-",
    oldRecordText: formatAuditRecordText(log.Action, log.OldValue, "old", log.NewValue),
    newRecordText: formatAuditRecordText(log.Action, log.NewValue, "new", log.OldValue),
  };
};

// --- Custom Calendar Component ---
interface CustomCalendarProps {
  initialStart: Date | null;
  initialEnd: Date | null;
  onApply: (start: Date | null, end: Date | null) => void;
  onClose: () => void;
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  initialStart,
  initialEnd,
  onApply,
}) => {
  const [viewDate, setViewDate] = useState(initialStart ?? new Date());
  const [start, setStart] = useState<Date | null>(initialStart);
  const [end, setEnd] = useState<Date | null>(initialEnd);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // 0 = Sun, 1 = Mon ... 6 = Sat. We want Mon=0, Sun=6
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const isSameDate = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isBetween = (date: Date, d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    const target = date.getTime();
    const startT = d1.getTime();
    const endT = d2.getTime();
    return target > Math.min(startT, endT) && target < Math.max(startT, endT);
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      day,
    );

    let newStart = start;
    let newEnd = end;

    if (!start || (start && end)) {
      newStart = clickedDate;
      newEnd = null;
    } else {
      if (clickedDate < start) {
        newEnd = start;
        newStart = clickedDate;
      } else {
        newEnd = clickedDate;
      }
    }

    setStart(newStart);
    setEnd(newEnd);

    // Auto-apply selection for immediate feedback
    onApply(newStart, newEnd);
  };

  const handleReset = () => {
    setStart(null);
    setEnd(null);
    onApply(null, null);
  };

  const renderDays = () => {
    const totalDays = getDaysInMonth(viewDate);
    const startOffset = getFirstDayOfMonth(viewDate);
    const days = [];

    // Empty cells for offset
    for (let i = 0; i < startOffset; i++) {
      days.push(<Box key={`empty-${i}`} sx={{ width: 36, height: 36 }} />);
    }

    // Days
    for (let d = 1; d <= totalDays; d++) {
      const currentDate = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth(),
        d,
      );
      const isStart = isSameDate(currentDate, start);
      const isEnd = isSameDate(currentDate, end);
      const inRange = isBetween(currentDate, start, end);

      let color = "#374151";

      if (isStart || isEnd) {
        color = "#6366f1"; // Indigo 500
        color = "white";
      } else if (inRange) {
        color = "#c7d2fe"; // Indigo 200 (lighter)
        color = "#374151";
      }

      // Visual tweaks for connecting the range
      const isRangeStart = isStart && end;
      const isRangeEnd = isEnd && start;

      days.push(
        <Box
          key={d}
          onClick={() => handleDayClick(d)}
          sx={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Background for range connectivity */}
          {inRange && (
            <Box sx={{ position: "absolute", inset: 0, bgcolor: "#c7d2fe" }} />
          )}
          {isRangeStart && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: 0,
                left: "50%",
                bgcolor: "#c7d2fe",
                zIndex: -1,
              }}
            />
          )}
          {isRangeEnd && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: "50%",
                bgcolor: "#c7d2fe",
                zIndex: -1,
              }}
            />
          )}

          {/* The Circle */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              bgcolor: isStart || isEnd ? "#4f46e5" : "transparent",
              color: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: isStart || isEnd ? "bold" : "normal",
              "&:hover": {
                bgcolor: isStart || isEnd ? "#4338ca" : "#f3f4f6",
              },
            }}
          >
            {d}
          </Box>
        </Box>,
      );
    }
    return days;
  };

  return (
    <Box sx={{ p: 2, width: 320 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold">
          {viewDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </Typography>
        <Box>
          <IconButton size="small" onClick={handlePrevMonth}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton size="small" onClick={handleNextMonth}>
            <ChevronRight size={16} />
          </IconButton>
        </Box>
      </Box>

      {/* Days of Week */}
      <Box sx={{ display: "flex", mb: 1, justifyContent: "space-between" }}>
        {daysOfWeek.map((day) => (
          <Typography
            key={day}
            variant="caption"
            sx={{
              width: 36,
              textAlign: "center",
              color: "#6b7280",
              fontWeight: "bold",
            }}
          >
            {day}
          </Typography>
        ))}
      </Box>

      {/* Grid */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          rowGap: 0.5,
          justifyContent: "flex-start",
        }}
      >
        {renderDays()}
      </Box>

      {/* Footer Actions - Reset moved to right, Apply removed */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 3,
          pt: 2,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <Button
          onClick={handleReset}
          sx={{ textTransform: "none", color: "#1f2937", fontWeight: "bold" }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
};

// --- Main Component ---

const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userFilter, setUserFilter] = useState("All Users");
  const [searchQuery, setSearchQuery] = useState("");
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const rowsPerPage = 10;

  // Date Range State (Date objects)
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleClickCalendar = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseCalendar = () => {
    setAnchorEl(null);
  };

  const handleApplyDateRange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
    // Do not close automatically so user can select range interactively
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  const openCalendar = Boolean(anchorEl);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      setIsLoading(true);
      try {
        const response = await auditService.getLogs(1, 500);
        const mapped = response.data.map(mapAuditLogToRow);
        setLogs(mapped);
      } catch {
        notify.error("Failed to load audit logs.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, []);

  const availableUsers = useMemo(
    () => [
      "All Users",
      ...Array.from(new Set(logs.map((log) => log.user))).sort((a, b) =>
        a.localeCompare(b),
      ),
    ],
    [logs],
  );

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (userFilter !== "All Users" && log.user !== userFilter) {
          return false;
        }

        if (
          searchQuery &&
          !Object.values(log).some((value) =>
            String(value).toLowerCase().includes(searchQuery.toLowerCase()),
          )
        ) {
          return false;
        }

        if (startDate) {
          const logDate = new Date(log.date);
          const startBoundary = new Date(startDate);
          startBoundary.setHours(0, 0, 0, 0);
          if (logDate < startBoundary) return false;
        }

        if (endDate) {
          const logDate = new Date(log.date);
          const endBoundary = new Date(endDate);
          endBoundary.setHours(23, 59, 59, 999);
          if (logDate > endBoundary) return false;
        }

        return true;
      }),
    [logs, userFilter, searchQuery, startDate, endDate],
  );

  useEffect(() => {
    setPage(1);
  }, [userFilter, searchQuery, startDate, endDate, sortOrder]);

  const sortedLogs = useMemo(() => {
    const sorted = [...filteredLogs];
    sorted.sort((a, b) =>
      sortOrder === "asc"
        ? a.timestampMs - b.timestampMs
        : b.timestampMs - a.timestampMs,
    );
    return sorted;
  }, [filteredLogs, sortOrder]);

  const paginatedLogs = sortedLogs.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );

  return (
    <Box
      sx={{
        p: 4,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Page Title & Subtitle */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: "#2e0249", mb: 1 }}
        >
          System Logs
        </Typography>
        <Typography variant="body1" sx={{ color: "#64748b" }}>
          Monitor and track all user activities, record updates, and system
          events.
        </Typography>
      </Box>

      {/* Header / Filter Section */}
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {/* Left Side Filters */}
        <Box
          sx={{
            display: "flex",
            gap: 3,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Date Range Picker Button */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="600">
              Date Range:
            </Typography>
            <IconButton
              onClick={handleClickCalendar}
              sx={{
                bgcolor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 2,
                width: 40,
                height: 40,
                "&:hover": { bgcolor: "#f9fafb" },
              }}
            >
              <Calendar size={20} className="text-gray-600" />
            </IconButton>

            {/* Display Selected Date Range Text */}
            {(startDate || endDate) && (
              <Typography variant="body2" fontWeight="bold" color="primary">
                {formatDate(startDate) || "..."}{" "}
                <span style={{ color: "#9ca3af" }}>to</span>{" "}
                {formatDate(endDate) || "..."}
              </Typography>
            )}

            {/* Custom Calendar Popover */}
            <Popover
              open={openCalendar}
              anchorEl={anchorEl}
              onClose={handleCloseCalendar}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                },
              }}
            >
              <CustomCalendar
                initialStart={startDate}
                initialEnd={endDate}
                onApply={handleApplyDateRange}
                onClose={handleCloseCalendar}
              />
            </Popover>
          </Box>

          {/* User Filter */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="600">
              User:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                displayEmpty
                sx={{
                  bgcolor: "white",
                  borderRadius: 2,
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#e5e7eb",
                  },
                }}
                renderValue={(selected) => {
                  if (!selected || selected === "All Users") {
                    return (
                      <Typography color="text.secondary">All Users</Typography>
                    );
                  }
                  return selected;
                }}
              >
                {availableUsers.map((user) => (
                  <MenuItem key={user} value={user}>
                    {user}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Search Field (Replaced Button) */}
          <TextField
            placeholder="Search logs..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 250,
              backgroundColor: "white",
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Search size={18} className="text-gray-400" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        {/* Reset Button (Moved to Right Side, Export Removed) */}
        <Button
          variant="contained"
          sx={{
            bgcolor: "#0f172a",
            color: "white",
            fontWeight: "bold",
            textTransform: "none",
            borderRadius: 2,
            "&:hover": { bgcolor: "#1e293b" },
          }}
          onClick={() => {
            setStartDate(null);
            setEndDate(null);
            setUserFilter("All Users");
            setSearchQuery("");
          }}
        >
          Reset
        </Button>
      </Box>

      {/* Table Section */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          overflow: "hidden",
          border: "1px solid #e0e0e0",
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          bgcolor: "white",
        }}
      >
        <TableContainer
          sx={{ flex: 1, overflow: "auto" }}
          className="custom-scrollbar"
        >
          <Table stickyHeader sx={{ tableLayout: "fixed", minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "8%",
                  }}
                >
                  Id
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "12%",
                  }}
                >
                  User
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "10%",
                  }}
                >
                  Date
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "10%",
                  }}
                >
                  Timestamp
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "18%",
                  }}
                >
                  Action
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "21%",
                  }}
                >
                  Old Record
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: "#f3f4f6",
                    fontWeight: "bold",
                    color: "#374151",
                    width: "21%",
                  }}
                >
                  New Record
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      Loading logs...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      No logs found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{log.id}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{log.user}</TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>{log.timestamp}</TableCell>
                    <TableCell>
                      <Chip
                        label={log.actionLabel}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: getToneStyles(log.tone).bg,
                          color: getToneStyles(log.tone).text,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            log.oldRecord === "-"
                              ? "#64748b"
                              : getToneStyles(log.tone).text,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {log.oldRecordText}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            log.newRecord === "-"
                              ? "#64748b"
                              : getToneStyles(log.tone).text,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {log.newRecordText}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination - Matching Resident Records Style */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            p: 2,
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <SortOrderToggle
            order={sortOrder}
            onToggle={() =>
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            label="Sort"
          />
          <Pagination
            count={Math.max(1, Math.ceil(sortedLogs.length / rowsPerPage))}
            color="primary"
            shape="rounded"
            page={page}
            onChange={(_event, value) => setPage(value)}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default AuditTrail;
