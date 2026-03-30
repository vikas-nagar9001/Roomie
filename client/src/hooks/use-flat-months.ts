import { useMemo } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export type FlatMonthRow = {
  _id: string;
  flatId: string;
  monthKey: string;
  status: "active" | "locked";
  closedAt?: string;
  reopenedAt?: string;
};

export const FLAT_MONTHS_QUERY_KEY = ["/api/flat-months"] as const;

const STALE_MS = 5 * 60_000;
const GC_MS = 30 * 60_000;

/** Shared fetcher for prefetch + `useQuery` (single cache entry). */
export async function fetchFlatMonths(): Promise<FlatMonthRow[]> {
  const r = await fetch("/api/flat-months", { credentials: "include" });
  if (!r.ok) {
    throw new Error(`flat-months failed: ${r.status}`);
  }
  const json: unknown = await r.json();
  return Array.isArray(json) ? (json as FlatMonthRow[]) : [];
}

export const flatMonthsQueryOptions: Pick<
  UseQueryOptions<FlatMonthRow[]>,
  "queryKey" | "queryFn" | "staleTime" | "gcTime" | "retry" | "refetchOnWindowFocus"
> = {
  queryKey: FLAT_MONTHS_QUERY_KEY,
  queryFn: fetchFlatMonths,
  staleTime: STALE_MS,
  gcTime: GC_MS,
  retry: 1,
  refetchOnWindowFocus: false,
};

/**
 * `/api/flat-months` via React Query — one network subscription per cache key.
 * On error with no cached data, `lockDataUnavailable` is true (fail closed for mutations).
 */
export function useFlatMonths() {
  const query = useQuery<FlatMonthRow[]>({
    ...flatMonthsQueryOptions,
  });

  const data = query.data;

  const lockedMonthKeys = useMemo(() => {
    const s = new Set<string>();
    const rows = data ?? [];
    for (const row of rows) {
      if (row.status === "locked") s.add(row.monthKey);
    }
    return s;
  }, [data]);

  const isMonthLocked = (monthKey: string) => lockedMonthKeys.has(monthKey);

  /** No successful response in cache (initial load failed or hard error). */
  const lockDataUnavailable = query.isError && data === undefined;

  return {
    ...query,
    flatMonths: data ?? [],
    lockedMonthKeys,
    isMonthLocked,
    lockDataUnavailable,
  };
}
