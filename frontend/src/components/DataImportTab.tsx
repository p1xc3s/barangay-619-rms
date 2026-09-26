import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import { UploadCloud, CheckCircle, AlertCircle, FileText } from "lucide-react";
import Papa from "papaparse";
import { toast } from "react-toastify";
import { residentService } from "../services/residentService";

export default function DataImportTab() {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [errors, setErrors] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Template Function
  const handleDownloadTemplate = () => {
    const headers = [
      "Household_Number", "Street_Name", "Unit_Room_Floor", "Building_Name", "Lot_Block_Phase",
      "First_Name", "Middle_Name", "Last_Name", "Suffix", "Sex", "Date_Of_Birth", "Place_Of_Birth",
      "Civil_Status", "Citizenship", "Religion", "Contact_Number", "Email", "Inhabitant_Type",
      "Family_Role", "Relationship_To_Head", "Family_Label"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Barangay_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Handle File Upload & Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        toast.error("Invalid file format. Please upload a strictly formatted .csv file.");
        return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let errorCount = 0;
        const validatedData = results.data.map((row: any) => {
          let rowError = "";
          // Basic Frontend Validation
          if (!row.Household_Number) rowError = "Missing Household #";
          else if (!row.First_Name || !row.Last_Name) rowError = "Missing Name";
          else if (!row.Family_Role) rowError = "Missing Family Role";
          
          if (rowError) errorCount++;
          
          return { ...row, _error: rowError };
        });

        setParsedData(validatedData);
        setErrors(errorCount);
      },
      error: () => {
        toast.error("Failed to parse CSV file.");
      }
    });
  };

  const handleImportToDatabase = async () => {
    try {
        await residentService.bulkImport(parsedData);
        toast.success("Successfully imported data!");
        setParsedData([]); // Clear the table on success
    } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to import data!");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header & Instructions */}
      <Paper sx={{ p: 3, borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Bulk Import Data</Typography>
          <Typography variant="body2" color="text.secondary">
            Download the strict template, fill it out, and upload it to safely import Households and Residents.
          </Typography>
        </Box>
        <Button 
          variant="outlined" 
          startIcon={<FileText size={18} />}
          onClick={handleDownloadTemplate}
        >
          Download Template
        </Button>
      </Paper>

      {/* Drag & Drop Zone */}
      {!parsedData.length && (
        <Paper 
          sx={{ 
            p: 6, borderRadius: 3, border: "2px dashed #cbd5e1", 
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            bgcolor: "#f8fafc", cursor: "pointer", "&:hover": { bgcolor: "#f1f5f9" }
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept=".csv" hidden ref={fileInputRef} onChange={handleFileUpload} />
          <UploadCloud size={48} color="#94a3b8" />
          <Typography variant="h6" color="text.secondary">Click to upload your filled CSV</Typography>
        </Paper>
      )}

      {/* Preview Table */}
      {parsedData.length > 0 && (
        <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ p: 2, bgcolor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography fontWeight={700}>
              Previewing {parsedData.length} rows 
              {errors > 0 ? <span style={{ color: "#ef4444" }}> ({errors} errors)</span> : <span style={{ color: "#10b981" }}> (All Clear!)</span>}
            </Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button onClick={() => setParsedData([])} color="inherit">Cancel</Button>
              <Button 
                variant="contained" 
                color={errors > 0 ? "error" : "success"}
                disabled={errors > 0}
                onClick={handleImportToDatabase}
              >
                {errors > 0 ? "Fix CSV to Continue" : "Confirm & Import Data"}
              </Button>
            </Box>
          </Box>
          
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Household #</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Family Role</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedData.map((row, i) => (
                  <TableRow key={i} sx={{ bgcolor: row._error ? "#fee2e2" : "inherit" }}>
                    <TableCell>
                      {row._error ? (
                        <Chip icon={<AlertCircle size={14}/>} label={row._error} color="error" size="small" />
                      ) : (
                        <CheckCircle size={18} color="#10b981" />
                      )}
                    </TableCell>
                    <TableCell>{row.Household_Number}</TableCell>
                    <TableCell>{row.First_Name} {row.Last_Name}</TableCell>
                    <TableCell>{row.Family_Role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
