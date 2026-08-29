"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Factory,
  LayoutDashboard,
  Package,
  Inbox,
  FileText,
  Receipt,
  BarChart2,
  Briefcase,
  Settings,
  HelpCircle,
  BadgeCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products / Services", icon: Package },
  { href: "/leads", label: "Leads", icon: Inbox, badgeKey: "leads" as const },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart2 },
  { href: "/profile", label: "Company Profile", icon: Briefcase },
];

export function Sidebar({ newLeadCount }: { newLeadCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar col-auto">
      <div className="sidebar-logo">
        <div className="mark">
          <Factory size={20} />
        </div>
        <div>
          <div className="brand-name">MOQ Pool</div>
          <div className="brand-tag">Manufacturer</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {item.label}
              {item.badgeKey === "leads" && newLeadCount ? (
                <span className="nav-badge">{newLeadCount}</span>
              ) : null}
            </Link>
          );
        })}
        <a className="nav-item">
          <Settings size={18} strokeWidth={1.8} />
          Settings
        </a>
        <a className="nav-item">
          <HelpCircle size={18} strokeWidth={1.8} />
          Help &amp; Support
        </a>
      </nav>

      <div className="sidebar-promo">
        <div className="icon-badge">
          <BadgeCheck size={16} />
        </div>
        <h4>Get Verified</h4>
        <p>Verified manufacturers receive more qualified leads.</p>
        <Link className="btn-invite" href="/profile">
          Complete Profile
        </Link>
      </div>
    </aside>
  );
}
