import { BrowserRouter, useLocation } from "react-router-dom";
import { Box } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppRoutes from "./routes/AppRoutes";
import Sidebar from "./components/Sidebar";
import theme from "./themes/theme";
import SessionTimeoutManager from "./components/SessionTimeoutManager";

// Layout component that conditionally shows sidebar for authenticated pages
const AppLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Don't show sidebar on login page, loading page, or while auth is loading
  const hideSidebar =
    !isAuthenticated ||
    isLoading ||
    location.pathname === "/login" ||
    location.pathname === "/";

  if (hideSidebar) {
    return <AppRoutes />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <SessionTimeoutManager />
      <Sidebar />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <AppRoutes />
      </Box>
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <AppLayout />
          <ToastContainer
            position="top-center"
            autoClose={2500}
            hideProgressBar
            newestOnTop
            closeOnClick
            pauseOnHover={false}
            draggable={false}
            theme="light"
            toastStyle={{
              borderRadius: "12px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
              fontSize: "14px",
              fontWeight: 500,
              padding: "14px 20px",
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
