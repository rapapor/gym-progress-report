import React, { useEffect, useRef } from "react";
import ReportCard from "./ReportCard";
import type { ReportCardVM } from "./types";

interface Props {
  reports: ReportCardVM[];
  isLoading: boolean;
  onLoadMore: () => void;
}

const ReportList: React.FC<Props> = ({ reports, isLoading, onLoadMore }) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [onLoadMore]);

  return (
    <div className="h-full overflow-y-auto">
      {reports.map((report) => (
        <div key={report.id} className="px-4 pb-2">
          <ReportCard
            report={report}
            onClick={() => {
              console.log("onClick", report);
              // navigate to /app/reports/:id
              /* navigate */
            }}
          />
        </div>
      ))}
      {/* sentinel element triggers loading next page */}
      <div ref={sentinelRef} />
      {isLoading && <p className="text-center py-4">Ładowanie...</p>}
    </div>
  );
};

export default ReportList;
