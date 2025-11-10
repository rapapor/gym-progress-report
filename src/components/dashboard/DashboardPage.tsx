import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useReports } from "@/lib/hooks/useReports";
import Header from "./Header";
import ReportList from "./ReportList";
import NewReportFAB from "./NewReportFAB";
import OfflineOverlay from "./OfflineOverlay";
import BottomTabBar from "./BottomTabBar";

const DashboardPage: React.FC = () => {
  const { isOffline } = useNetworkStatus();
  // ensure a stable client instance across renders
  const [queryClient] = React.useState(() => new QueryClient());
  // todo get clientId from auth/session or params; placeholder "me"
  const clientId = "me";
  const { reports, meta, isLoading, loadMore } = useReports(clientId);

  // determine if current week report exists and weekly limit reached
  const hasCurrentWeekReport = reports.some((r) => r.weekNumber === new Date().getWeekNumber?.());
  const weeklyReportsCount = reports.filter((r) => r.weekNumber === new Date().getWeekNumber?.()).length;
  const hasReachedWeeklyLimit = weeklyReportsCount >= 2;
  const canCreateReport = !isOffline && !hasReachedWeeklyLimit;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-full w-full">
        <Header hasCurrentWeekReport={hasCurrentWeekReport} />
        <div className="flex-1 overflow-hidden">
          <ReportList reports={reports} isLoading={isLoading} onLoadMore={loadMore} />
        </div>
        <NewReportFAB
          canCreateReport={canCreateReport}
          disabledReason={
            isOffline ? "Brak połączenia z siecią" : hasReachedWeeklyLimit ? "Limit raportów na tydzień" : undefined
          }
        />
        {isOffline && <OfflineOverlay isOffline />}
        <BottomTabBar />
      </div>
    </QueryClientProvider>
  );
};

export default DashboardPage;
