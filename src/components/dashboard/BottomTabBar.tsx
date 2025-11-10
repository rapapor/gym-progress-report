import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, User } from "lucide-react";

const BottomTabBar: React.FC = () => {
  return (
    <Tabs defaultValue="dashboard" className="fixed bottom-0 left-0 right-0 border-t bg-background z-10">
      <TabsList className="w-full grid grid-cols-2">
        <TabsTrigger value="dashboard" asChild>
          <a href="/app" className="flex flex-col gap-1 py-2">
            <Home className="w-5 h-5" /> Dashboard
          </a>
        </TabsTrigger>
        <TabsTrigger value="profile" asChild>
          <a href="/app/profile" className="flex flex-col gap-1 py-2">
            <User className="w-5 h-5" /> Profil
          </a>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
export default BottomTabBar;
