import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import ManageUsers from "@/pages/manage-users";
import EntriesPage from "@/pages/entries";
import SetPasswordPage from "@/pages/set-password";
import ResetPasswordPage from "@/pages/reset-password";
import ProfilePage from "@/pages/profile";
import PaymentsPage from "@/pages/payments";
import PenaltiesPage from "@/pages/penalties";
import { ProtectedRoute } from "./lib/protected-route";
import Loader from "@/components/common/Loader";
import { useLoader } from "@/services/loaderService";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/set-password" component={SetPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/manage-users" component={ManageUsers} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/entries" component={EntriesPage} />
      <ProtectedRoute path="/payments" component={PaymentsPage} />
      <ProtectedRoute path="/penalties" component={PenaltiesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    checkForNewVersion(); // ✅ Run check on app load
  }, []);

  const isLoading = useLoader();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />

        {/* ✅ React Hot Toast Only */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
            },
          }}
        />

        {isLoading && <Loader />}
      </AuthProvider>
    </QueryClientProvider>
  );
}

// 🔁 Version Check Logic (unchanged)
const checkForNewVersion = async () => {
  try {
    console.log("checking app version");
    const response = await apiRequest("GET", "/api/version");
    const latestVersion = (await response.json()).version;
    let storedVersion = localStorage.getItem("app_version");

    if (!storedVersion) {
      console.log("🆕 No previous version found. Setting initial version...");
      storedVersion = "1.0";
      localStorage.setItem("app_version", storedVersion);
      return;
    }

    if (storedVersion !== latestVersion) {
      console.log(`🔄 New version detected! Clearing cache... (Old: ${storedVersion}, New: ${latestVersion})`);
      clearAllCache();
      localStorage.setItem("app_version", latestVersion);
    } else {
      console.log("✅ App is up-to-date.");
    }
  } catch (error) {
    console.error("❌ Error checking version:", error);
  }
};

const clearAllCache = () => {
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
  window.location.reload();
};

export default App;
