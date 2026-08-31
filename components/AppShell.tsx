import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  companyName,
  searchPlaceholder,
  newLeadCount,
}: {
  children: React.ReactNode;
  companyName?: string;
  searchPlaceholder?: string;
  newLeadCount?: number;
}) {
  // Every page here is a client component (fetches its own data in
  // useEffect), so AppShell can't be async / import server-only modules
  // like next/headers. Pages that already loaded the manufacturer (e.g.
  // profile) pass companyName directly; otherwise Topbar/UserMenu fetches
  // the logged-in manufacturer's real name itself via GET /api/manufacturer.
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
