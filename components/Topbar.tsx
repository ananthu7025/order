import { Search, Bell } from "lucide-react";
import { UserMenu } from "./UserMenu";

export function Topbar({
  searchPlaceholder = "Search products, leads or customers...",
  companyName,
}: {
  searchPlaceholder?: string;
  companyName?: string;
}) {
  return (
    <header className="topbar">
      <div className="hamburger">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="searchbar">
        <Search size={16} />
        {searchPlaceholder}
        <span className="kbd">⌘ K</span>
      </div>
      <div className="topbar-right">
        <div className="bell">
          <Bell size={20} />
        </div>
        <UserMenu companyName={companyName} />
      </div>
    </header>
  );
}
