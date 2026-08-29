import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  companyName = "PackRight Industries",
  searchPlaceholder,
  newLeadCount,
}: {
  children: React.ReactNode;
  companyName?: string;
  searchPlaceholder?: string;
  newLeadCount?: number;
}) {
  return (
    <div className="app row g-0">
      <Sidebar newLeadCount={newLeadCount} />
      <div className="main col">
        <Topbar companyName={companyName} searchPlaceholder={searchPlaceholder} />
        <div className="content container-fluid">{children}</div>
      </div>
    </div>
  );
}
