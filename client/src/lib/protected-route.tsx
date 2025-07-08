import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useEffect, useRef } from "react";
import { initializePushNotifications } from "@/services/pushNotificationService";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element | null;
}) {
  const { user, isLoading } = useAuth();
  const pushInitialized = useRef(false);

  // Initialize push notifications when user is available
  useEffect(() => {
    if (user && !pushInitialized.current) {
      pushInitialized.current = true;
      initializePushNotifications(user._id).then((success) => {
        if (success) {
          console.log('🔔 Push notifications initialized successfully for user:', user._id);
        } else {
          console.log('❌ Push notifications failed to initialize for user:', user._id);
        }
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Component />
}
