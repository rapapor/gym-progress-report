import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  ok: boolean;
}

const StatusBadge: React.FC<Props> = ({ ok }) => {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
      <CheckCircle2 className="w-4 h-4" /> Raport wysłany
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm text-yellow-700 dark:text-yellow-400">
      <AlertTriangle className="w-4 h-4" /> Brak raportu
    </span>
  );
};

export default StatusBadge;
