import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  Box,
  InputAdornment,
  IconButton
} from "@mui/material";
import { toast } from "react-toastify";
import { authService } from "../services/authService";
import { useAuth } from "../hooks/useAuth";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

const ForceChangePasswordModal: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // States for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modal is only open if the user exists and has the flag set to true
  const isOpen = user?.isFirstLogin === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.changePassword(password);
      toast.success("Password updated successfully!");
      // Refresh the context so the modal disappears
      await refreshUser();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      disableEscapeKeyDown 
      PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <AlertTriangle color="#b45309" /> Action Required
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>
          For security purposes, you must change your default password before you can access the system.
        </DialogContentText>
        <Box component="form" onSubmit={handleSubmit} id="force-password-form">
          <TextField
            fullWidth
            label="New Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label="Confirm New Password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        {/* Notice there is NO cancel button - this is strictly enforced */}
        <Button
          type="submit"
          form="force-password-form"
          variant="contained"
          disabled={isLoading}
          sx={{ bgcolor: "#2e0249", fontWeight: 700, width: "100%" }}
        >
          {isLoading ? "Updating..." : "Update Password"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForceChangePasswordModal;
