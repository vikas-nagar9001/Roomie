import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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
import { ProtectedRoute } from "./lib/protected-route";
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    checkForNewVersion(); // ✅ Run check on app load
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// cache clear

const checkForNewVersion = async () => {
  try {
    console.log("checking app version");
    const response = await apiRequest("GET", "/api/version");
    const latestVersion = (await response.json()).version;// Get latest version from backend
    let storedVersion = localStorage.getItem("app_version");

    if (!storedVersion) {
      // 🔹 First-time user or cleared storage → Set version
      console.log("🆕 No previous version found. Setting initial version...");
      storedVersion = "1.0"; // Default version
      localStorage.setItem("app_version", storedVersion);
      return; // No need to clear cache since it's the first time
    }

    if (storedVersion !== latestVersion) {
      console.log(`🔄 New version detected! Clearing cache... (Old: ${storedVersion}, New: ${latestVersion})`);

      // 🔹 Clear browser cache
      clearAllCache();

      // 🔹 Update local storage version
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

  window.location.reload(); // ✅ Hard refresh to load the latest assets
};




export default App;