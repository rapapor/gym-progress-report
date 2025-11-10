import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface Props {
  canCreateReport: boolean;
  disabledReason?: string;
}

const NewReportFAB: React.FC<Props> = ({ canCreateReport, disabledReason }) => {
  const fab = (
    <Button
      size="icon"
      asChild
      className="rounded-full h-14 w-14 shadow-lg absolute bottom-20 right-6 z-20"
      disabled={!canCreateReport}
    >
      <a href="/app/reports/new">
        <Plus className="w-6 h-6" />
        <span className="sr-only">Nowy raport</span>
      </a>
    </Button>
  );

  return canCreateReport ? (
    fab
  ) : (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{fab}</TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NewReportFAB;
