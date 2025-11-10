import React from "react";
import StatusBadge from "./StatusBadge";

interface Props {
  hasCurrentWeekReport: boolean;
}

const Header: React.FC<Props> = ({ hasCurrentWeekReport }) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur supports-backdrop-blur:bg-background/60 sticky top-0 z-10">
      <h1 className="text-lg font-semibold">Moje raporty</h1>
      <StatusBadge ok={hasCurrentWeekReport} />
    </header>
  );
};

export default Header;
