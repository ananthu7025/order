"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
import {
  Package,
  Inbox,
  Activity,
  Trophy,
  Building2,
} from "lucide-react";

type DashboardData = {
  productCount: number;
  leadStatusCounts: Record<string, number>;
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  lostLeads: number;
  recentLeads: Array<{
    id: string;
    businessName: string | null;
    buyerName: string | null;
    productText: string | null;
    quantity: string | null;
    location: string | null;
    status: string;
    createdAt: string;
  }>;
  topProducts: Array<{ id: string; name: string; viewCount: number }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell newLeadCount={data?.leadStatusCounts.NEW}>
      <div className="page-header">
        <div>
          <h1>Welcome back, PackRight 👋</h1>
          <p>Here&apos;s an overview of your listings and leads.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Link href="/products/new" className="btn btn-outline">
            + Add Product
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="card card-pad">Loading dashboard…</div>
      ) : !data ? (
        <div className="card card-pad">Failed to load dashboard data.</div>
      ) : (
        <>
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3 stat-grid-row">
            <StatCard
              icon={<Package />}
              bg="#eff6ff"
              color="#2563eb"
              label="Products / Services"
              value={data.productCount}
              href="/products"
            />
            <StatCard
              icon={<Inbox />}
              bg="#f0fdf4"
              color="#16a34a"
              label="New Leads"
              value={data.leadStatusCounts.NEW}
              href="/leads"
            />
            <StatCard
              icon={<Activity />}
              bg="#fff7ed"
              color="#ea580c"
              label="Active Leads"
              value={data.activeLeads}
              href="/leads"
            />
            <StatCard
              icon={<Trophy />}
              bg="#f5f3ff"
              color="#7c3aed"
              label="Won Leads"
              value={data.wonLeads}
              href="/leads"
            />
          </div>

          <div className="row">
            <div className="col-main col-lg-8">
              <div className="card card-pad">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="card-title">Recent Leads</div>
                  <Link className="stat-link" href="/leads">
                    View all →
                  </Link>
                </div>

                {data.recentLeads.length === 0 ? (
                  <EmptyLeads />
                ) : (
                  data.recentLeads.map((lead, index) => (
                    <div
                      key={lead.id}
                      className={`lead-row${index > 0 ? " divider" : ""}`}
                    >
                      <div className="lead-row-main">
                        <div
                          className="lead-avatar"
                          style={{ background: "#eff6ff", color: "#2563eb" }}
                        >
                          <Building2 size={18} strokeWidth={1.8} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="font-bold text-sm">
                              {lead.businessName || lead.buyerName || "Unnamed buyer"}
                            </div>
                            <StatusBadge status={lead.status} />
                          </div>
                          <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                            {lead.productText || "No product specified"}
                            {lead.quantity ? ` • Qty: ${lead.quantity}` : ""}
                            {lead.location ? ` • ${lead.location}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="lead-row-meta">
                        <div className="text-muted text-sm">Received</div>
                        <div className="font-bold text-sm">
                          {formatRelativeTime(lead.createdAt)}
                        </div>
                      </div>
                      <Link className="btn btn-outline btn-sm" href={`/leads/${lead.id}`}>
                        View Lead
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="col-side col-lg-4">
              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 16 }}>
                  Lead Funnel
                </div>
                <FunnelRow label="New" value={data.leadStatusCounts.NEW} max={data.totalLeads} fill="fill-blue" />
                <FunnelRow
                  label="Contacted"
                  value={data.leadStatusCounts.CONTACTED}
                  max={data.totalLeads}
                  fill="fill-blue"
                />
                <FunnelRow
                  label="Quoted"
                  value={data.leadStatusCounts.QUOTED}
                  max={data.totalLeads}
                  fill="fill-orange"
                />
                <FunnelRow
                  label="Won"
                  value={data.leadStatusCounts.WON}
                  max={data.totalLeads}
                  fill="fill-green"
                />
              </div>

              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 16 }}>
                  Top Viewed Products
                </div>
                {data.topProducts.length === 0 ? (
                  <div className="text-muted text-sm">No products yet.</div>
                ) : (
                  data.topProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className={index > 0 ? "divider" : ""}
                      style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}
                    >
                      <span className="text-sm">{product.name}</span>
                      <span className="font-bold text-sm">{product.viewCount} views</span>
                    </div>
                  ))
                )}
              </div>

              <div
                className="card card-pad"
                style={{ background: "var(--blue-light)", borderColor: "var(--blue-border)" }}
              >
                <div className="card-title" style={{ marginBottom: 6 }}>
                  Complete your profile
                </div>
                <div className="text-muted text-sm" style={{ marginBottom: 14 }}>
                  A complete company profile helps buyers trust your listings.
                </div>
                <Link href="/profile" className="btn btn-outline btn-block" style={{ background: "#fff" }}>
                  Complete Company Profile
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function StatCard({
  icon,
  bg,
  color,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  bg: string;
  color: string;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <div className="col">
      <div className="stat-card">
        <div className="stat-icon" style={{ background: bg, color }}>
          {icon}
        </div>
        <div className="stat-body">
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          <Link className="stat-link" href={href}>
            View all →
          </Link>
        </div>
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  max,
  fill,
}: {
  label: string;
  value: number;
  max: number;
  fill: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="text-sm text-muted">{label}</span>
        <span className="font-bold text-sm">{value}</span>
      </div>
      <div className="progress-track" style={{ height: 6 }}>
        <div className={`progress-fill ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyLeads() {
  return (
    <div style={{ padding: "24px 0", textAlign: "center" }}>
      <div className="text-muted text-sm">
        No leads yet. Use the API (or the manual entry form once connected) to add your first lead.
      </div>
    </div>
  );
}
