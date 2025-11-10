import { useEffect, useState, useCallback } from "react";
import { mapReportToCardVM } from "@/lib/mappers/reportCardMapper";
import type { ReportCardVM } from "@/components/dashboard/types";
import type { PaginationMeta, ReportListItemDTO } from "@/types";

interface UseReportsResult {
  reports: ReportCardVM[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
}

const PAGE_SIZE = 20;

export function useReports(clientId: string): UseReportsResult {
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<ReportCardVM[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageToFetch: number) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}/reports?page=${pageToFetch}&pageSize=${PAGE_SIZE}`);
        if (!res.ok) {
          // Stop further pagination on auth errors to prevent loops
          if (res.status === 401 || res.status === 403) {
            setMeta({ page: pageToFetch, pageSize: PAGE_SIZE, totalPages: pageToFetch, totalItems: 0 });
            setError(`Auth error ${res.status}`);
            return;
          }
          throw new Error(`Failed to fetch: ${res.status}`);
        }
        const json: { data: ReportListItemDTO[]; meta: PaginationMeta } = await res.json();
        setReports((prev) => [...prev, ...json.data.map(mapReportToCardVM)]);
        setMeta(json.meta);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [clientId]
  );

  // initial load and page change
  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  const loadMore = useCallback(() => {
    if (error) return;
    if (meta && page >= meta.totalPages) return;
    setPage((p) => p + 1);
  }, [meta, page, error]);

  return {
    reports,
    meta,
    isLoading,
    error,
    loadMore,
  };
}
