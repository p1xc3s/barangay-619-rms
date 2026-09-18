import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  Alert,
  IconButton,
  Pagination,
} from "@mui/material";
import {
  CloudUpload,
  RotateCcw,
  Search,
  Database,
  FileText,
  History,
  Download,
} from "lucide-react";
import { backupService } from "../services/backupService";
import { notify } from "../utils/notify";
import SortOrderToggle, { type SortOrder } from "./SortOrderToggle";
import type { BackupLog as BackupApiLog } from "../types";

interface BackupLogRow {
  id: string;
  backupId: number;
  fileName: string;
  dateTime: string;
  timestampMs: number;
  status: "Successful" | "Failed" | "Pending";
  filePath: string;
  type: "Backup" | "Restore";
}

const mapBackupLogToRow = (log: BackupApiLog): BackupLogRow => ({
  id: String(log.BackupID),
  backupId: log.BackupID,
  fileName: log.FileName,
  dateTime: new Date(log.DateCreated).toLocaleString(),
  timestampMs: new Date(log.DateCreated).getTime(),
  status: log.BackupStatus,
  filePath: log.FilePath,
  type: log.BackupType as "Backup" | "Restore",
});

const BackupRestore: React.FC = () => {
  const [logs, setLogs] = useState<BackupLogRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const rowsPerPage = 10;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBackupLogs = useCallback(async () => {
    try {
      const data = await backupService.getLogs();
      const mapped = data.map(mapBackupLogToRow);
      setLogs(mapped.length ? mapped : []);
    } catch {
      notify.error("Failed to load backup logs.");
    }
  }, []);

  useEffect(() => {
    fetchBackupLogs();
  }, [fetchBackupLogs]);

  const handleDownloadBackup = async (log: BackupLogRow) => {
    if (log.type !== "Backup") return;

    try {
      const blob = await backupService.downloadBackup(log.backupId);
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = log.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);
      notify.success("Backup file downloaded.");
    } catch {
      notify.error("Failed to download backup file.");
    }
  };

  const handleStartBackup = async () => {
    if (!window.confirm("Are you sure you want to proceed with creating a system backup?")) {
      return;
    }
    setIsBackupDialogOpen(false);
    setIsProgressDialogOpen(true);
    setProgress(25);
    setIsProcessing(true);

    try {
      const result = await backupService.createBackup();
      setProgress(100);
      await fetchBackupLogs();

      //Auto-download the backup file to the user's Downloads folder
      try {
        const blob = await backupService.downloadBackup(result.backupId);
        const fileUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(fileUrl);
      } catch {
        //Non-critical: backup is saved on server even if download fails
        notify.error("Backup created but auto-download failed. You can download it manually from the logs below.");
      }

      setSuccessMessage("Backup created successfully! The file has been saved to your Downloads folder.");
      notify.success("Backup created successfully!");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create backup.";
      setErrorMessage(message);
      notify.error(message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setIsProgressDialogOpen(false);
        setProgress(0);
      }, 400);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".enc")) {
        setErrorMessage("Invalid file type. Please select a .sql backup file.");
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      setIsRestoreDialogOpen(true);
    }
  };

  const handleStartRestore = async () => {
    if (!selectedFile) {
      setErrorMessage("No backup file selected.");
      return;
    }

    if (!window.confirm("Are you sure you want to proceed with restoring the database? This action will overwrite existing data.")) {
      return;
    }

    setIsRestoreDialogOpen(false);
    setIsProgressDialogOpen(true);
    setProgress(30);
    setIsProcessing(true);

    try {
      await backupService.restoreBackup(selectedFile);
      setProgress(100);
      await fetchBackupLogs();
      setSuccessMessage("System restored successfully!");
      notify.success("System restored successfully!");
      setSelectedFile(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to restore backup.";
      setErrorMessage(message);
      notify.error(message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setIsProgressDialogOpen(false);
        setProgress(0);
      }, 400);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.filePath.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / rowsPerPage));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sortOrder]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (a.timestampMs === b.timestampMs) {
      return sortOrder === "asc"
        ? a.backupId - b.backupId
        : b.backupId - a.backupId;
    }

    return sortOrder === "asc"
      ? a.timestampMs - b.timestampMs
      : b.timestampMs - a.timestampMs;
  });

  const paginatedLogs = sortedLogs.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage,
  );

  return (
    <Box sx={{ p: 4, height: "100%", overflowY: "auto", bgcolor: "#f8fafc" }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: "#2e0249", mb: 1 }}
        >
          Backup & Restore
        </Typography>
        <Typography variant="body1" sx={{ color: "#64748b" }}>
          Secure and recover your system data.
        </Typography>
      </Box>

      {successMessage && (
        <Alert
          severity="success"
          onClose={() => setSuccessMessage(null)}
          sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
        >
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert
          severity="error"
          onClose={() => setErrorMessage(null)}
          sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Action Cards - Spread to occupy horizontal space */}
      <Grid container spacing={3} sx={{ mb: 5, width: "100%" }}>
        {/* Fix: Replaced 'item' and 'xs'/'md' with 'size' prop for Grid2 compatibility */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              width: "100%", // Maximize width
              borderRadius: 4,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "transform 0.2s",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
              },
            }}
          >
            <Box
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: "#eff6ff",
                color: "#3b82f6",
              }}
            >
              <Database size={48} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, mb: 1, color: "#1e293b" }}
              >
                Full System Backup
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "#64748b", mb: 2.5, lineHeight: 1.6 }}
              >
                Create a manual snapshot of all resident records and system data
                to an external drive for safety.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Download size={18} />}
                onClick={() => setIsBackupDialogOpen(true)}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 800,
                  px: 4,
                  py: 1,
                }}
              >
                Generate Backup
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Fix: Replaced 'item' and 'xs'/'md' with 'size' prop for Grid2 compatibility */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              width: "100%", // Maximize width
              borderRadius: 4,
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "transform 0.2s",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
              },
            }}
          >
            <Box
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: "#fef2f2",
                color: "#ef4444",
              }}
            >
              <RotateCcw size={48} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, mb: 1, color: "#1e293b" }}
              >
                Restore from File
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "#64748b", mb: 2.5, lineHeight: 1.6 }}
              >
                Recover your system to a previous state using a valid backup
                file (.sql) from your storage.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CloudUpload size={18} />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 800,
                  px: 4,
                  py: 1,
                  borderWidth: 2,
                  "&:hover": { borderWidth: 2 },
                }}
              >
                Upload & Restore
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".sql"
                onChange={handleFileSelect}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* History Table */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 4,
          border: "1px solid #e2e8f0",
          width: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
            <History size={24} className="text-gray-400" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Operation Logs
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
            <TextField
              placeholder="Search by filename..."
              size="small"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              sx={{
                width: 320,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "white",
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

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 600, ml: 0.5 }}
              >
                Status
              </Typography>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ borderRadius: 2, bgcolor: "white" }}
                >
                  <MenuItem value="All">All Status</MenuItem>
                  <MenuItem value="Successful">Successful</MenuItem>
                  <MenuItem value="Failed">Failed</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        <TableContainer>
          <Table sx={{ tableLayout: "fixed", minWidth: 980 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    borderRadius: "12px 0 0 0",
                    width: "23%",
                  }}
                >
                  File Name
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: "20%" }}>
                  Date & Time
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: "12%" }}>
                  Type
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: "13%" }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: "22%" }}>
                  Storage Path
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    borderRadius: "0 12px 0 0",
                    textAlign: "center",
                    width: "10%",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLogs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <FileText size={18} className="text-blue-500" />
                      {log.fileName}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: "#64748b" }}>
                    {log.dateTime}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.type}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontWeight: 700,
                        borderRadius: 1.5,
                        borderColor:
                          log.type === "Backup" ? "#3b82f6" : "#ec4899",
                        color: log.type === "Backup" ? "#3b82f6" : "#ec4899",
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.status}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        borderRadius: 1.5,
                        bgcolor:
                          log.status === "Successful"
                            ? "#dcfce7"
                            : log.status === "Pending"
                              ? "#fef3c7"
                              : "#fee2e2",
                        color:
                          log.status === "Successful"
                            ? "#166534"
                            : log.status === "Pending"
                              ? "#92400e"
                              : "#991b1b",
                      }}
                    />
                  </TableCell>
                  <TableCell
                    sx={{
                      color: "#94a3b8",
                      fontStyle: "italic",
                      fontSize: "0.875rem",
                    }}
                  >
                    {log.filePath}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={log.type !== "Backup"}
                      onClick={() => handleDownloadBackup(log)}
                    >
                      <Download size={17} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      No backup logs found.
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
            p: 2,
            borderTop: "1px solid #f1f5f9",
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
            count={totalPages}
            color="primary"
            shape="rounded"
            page={page}
            onChange={(_event, value) => setPage(value)}
          />
        </Box>
      </Paper>

      {/* Dialogs */}
      <Dialog
        open={isBackupDialogOpen}
        onClose={() => setIsBackupDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create New Backup?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#64748b" }}>
            This will package all current resident data into a backup file.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setIsBackupDialogOpen(false)}
            sx={{ fontWeight: 700, color: "#64748b" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleStartBackup}
            disabled={isProcessing}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isRestoreDialogOpen}
        onClose={() => setIsRestoreDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: "#ef4444" }}>
          Confirm Restoration?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#64748b", mb: 2 }}>
            Warning: This will overwrite all existing data.
          </Typography>
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Please ensure you have a backup.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setIsRestoreDialogOpen(false)}
            sx={{ fontWeight: 700, color: "#64748b" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleStartRestore}
            disabled={isProcessing || !selectedFile}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Restore Now
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isProgressDialogOpen}
        PaperProps={{ sx: { borderRadius: 3, width: 400, p: 3 } }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
            Processing...
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 12, borderRadius: 6, mb: 2, bgcolor: "#f1f5f9" }}
          />
          <Typography
            variant="body2"
            sx={{ color: "#94a3b8", fontWeight: 600 }}
          >
            {progress}% Complete
          </Typography>
        </Box>
      </Dialog>
    </Box>
  );
};

export default BackupRestore;
