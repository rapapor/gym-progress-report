import React from "react";

interface Props {
  isOffline: boolean;
}

const OfflineOverlay: React.FC<Props> = ({ isOffline }) => {
  if (!isOffline) return null;
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur flex items-center justify-center z-30">
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">Brak połączenia z siecią</p>
        <p className="text-sm text-muted-foreground">Niektóre funkcje są niedostępne</p>
      </div>
    </div>
  );
};

export default OfflineOverlay;
