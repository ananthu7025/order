import { Search, Bell, ChevronDown } from "lucide-react";

export function Topbar({
  searchPlaceholder = "Search products, leads or customers...",
  companyName,
}: {
  searchPlaceholder?: string;
  companyName: string;
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
        <div className="user-chip">
          <div className="avatar-wrap">
            <img className="avatar" src="https://i.pravatar.cc/80?img=33" alt="" />
            <span className="dot"></span>
          </div>
          <div>
            <div className="name">{companyName}</div>
            <div className="role">Manufacturer</div>
          </div>
          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  );
}
