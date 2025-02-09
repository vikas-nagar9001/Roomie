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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;