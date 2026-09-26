import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#2e0249", // Dark purple — matches sidebar and login branding
    },
    secondary: {
      main: "#3b82f6", // Blue — matches action buttons
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          padding: 24,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none", // Prevent uppercase text on buttons
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
  },
});

export default theme;
