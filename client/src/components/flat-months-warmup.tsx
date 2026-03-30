import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { flatMonthsQueryOptions } from "@/hooks/use-flat-months";

/**
 * Prefetch flat-months once after auth so first visit to entries/payments/penalties
 * reuses cache (no redundant burst of identical requests).
 */
export function FlatMonthsWarmup() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isLoading || !user) return;
    queryClient.prefetchQuery(flatMonthsQueryOptions);
  }, [user, isLoading, queryClient]);

  return null;
}
