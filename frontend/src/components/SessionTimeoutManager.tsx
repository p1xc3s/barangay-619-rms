import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { useAuth } from "../hooks/useAuth";
import { toast } from "react-toastify";

// Define timings in milliseconds
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_MS = 4 * 60 * 1000; // 4 minutes

const SessionTimeoutManager: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(() => Date.now());

  // Function to reset the inactivity timer
  const handleActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  useEffect(() => {
    // Only run the timeout logic if the user is authenticated
    if (!isAuthenticated) return;

    // Events that count as user activity
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    
    // Attach event listeners
    events.forEach((event) => window.addEventListener(event, handleActivity));

    // Check for inactivity every 10 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivity;

      if (idleTime >= TIMEOUT_MS) {
        logout();
        toast.info("You have been logged out due to inactivity.");
        setShowWarning(false);
      } else if (idleTime >= WARNING_MS && !showWarning) {
        setShowWarning(true);
      }
    }, 10000);

    // Cleanup listeners and interval on unmount
    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated, lastActivity, showWarning, logout, handleActivity]);

  const handleStayLoggedIn = () => {
    handleActivity();
  };

  const handleLogOutNow = () => {
    logout();
    setShowWarning(false);
  };

  return (
    <Dialog open={showWarning} onClose={handleStayLoggedIn}>
      <DialogTitle>Session Timeout Warning</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Your session will expire in 1 minute due to inactivity. Do you want to stay logged in?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleLogOutNow} color="error">
          Log Out Now
        </Button>
        <Button
          onClick={handleStayLoggedIn}
          color="primary"
          variant="contained"
          autoFocus
        >
          Stay Logged In
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionTimeoutManager;
