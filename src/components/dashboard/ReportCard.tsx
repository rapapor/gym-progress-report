import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ReportCardVM } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  report: ReportCardVM;
  onClick?: () => void;
}

const ReportCard: React.FC<Props> = ({ report, onClick }) => {
  return (
    <Card onClick={onClick} className="cursor-pointer transition hover:shadow-md overflow-hidden">
      <CardContent className="p-4 grid grid-cols-[auto_1fr] gap-4 items-center">
        <div className="flex flex-col items-center text-center">
          <span className="text-2xl font-bold leading-none">{report.weekNumber}</span>
          <span className="text-xs text-muted-foreground">tydzień</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {new Intl.DateTimeFormat("pl-PL", {
                day: "2-digit",
                month: "2-digit",
              }).format(new Date(report.createdAt))}
            </span>
            <span className="text-xs text-muted-foreground">#{report.sequence}</span>
          </div>
          <div className="flex gap-1">
            {report.imageThumbUrls.slice(0, 3).map((url) => (
              <img key={url} src={url} alt="Miniaturka" loading="lazy" className="w-12 h-12 object-cover rounded" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportCard;
