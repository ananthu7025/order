"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type DashboardData = {
  productCount: number;
  leadStatusCounts: Record<string, number>;
  totalLeads: number;
  wonLeads: number;
  topProducts: Array<{ id: string; name: string; viewCount: number }>;
};

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <AppShell>
        <div className="card card-pad">Loading…</div>
      </AppShell>
    );
  }

  const conversionRate = data.totalLeads > 0 ? Math.round((data.wonLeads / data.totalLeads) * 1000) / 10 : 0;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Reports &amp; Analytics</h1>
          <p>Track how your listings and leads are performing.</p>
        </div>
      </div>

      <div className="row row-cols-2 row-cols-lg-6 g-3 stat-grid-row">
        <StatTile label="Total Leads" value={data.totalLeads} />
        <StatTile label="New" value={data.leadStatusCounts.NEW} color="var(--blue)" />
        <StatTile label="Contacted" value={data.leadStatusCounts.CONTACTED} />
        <StatTile label="Interested" value={data.leadStatusCounts.INTERESTED} />
        <StatTile label="Quoted" value={data.leadStatusCounts.QUOTED} color="var(--orange)" />
        <StatTile label="Won" value={data.wonLeads} color="var(--green)" />
      </div>

      <div className="row">
        <div className="col-main col-lg-8">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 20 }}>
              Conversion Funnel
            </div>
            <div className="pipeline-row">
              <FunnelStage count={data.totalLeads} label="Leads" />
              <FunnelStage count={data.leadStatusCounts.CONTACTED} label="Contacted" />
              <FunnelStage count={data.leadStatusCounts.QUOTED} label="Quoted" />
              <FunnelStage count={data.wonLeads} label="Won" won />
            </div>
            <div className="divider" style={{ marginTop: 18, paddingTop: 16, display: "flex", gap: 40 }}>
              <div className="text-sm">
                <span className="text-muted">Lead → Won Conversion Rate</span>
                <br />
                <span className="font-bold" style={{ fontSize: 16, color: "var(--green-text)" }}>
                  {conversionRate}%
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 12 }}>
              <div className="card-title">Product Performance</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-500)",
                    fontWeight: 600,
                    borderTop: "1px solid var(--border-light)",
                    borderBottom: "1px solid var(--border-light)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "12px 22px" }}>Product</th>
                  <th style={{ padding: 12 }}>Views</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.length === 0 ? (
                  <tr>
                    <td style={{ padding: "16px 22px" }} colSpan={2} className="text-muted text-sm">
                      No product data yet.
                    </td>
                  </tr>
                ) : (
                  data.topProducts.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < data.topProducts.length - 1 ? "1px solid var(--border-light)" : undefined }}>
                      <td style={{ padding: "16px 22px", fontWeight: 700, fontSize: 13.5 }}>{p.name}</td>
                      <td style={{ padding: 16 }}>{p.viewCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-side col-lg-4">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Product Catalogue Size
            </div>
            <div className="stat-value" style={{ fontSize: 32 }}>
              {data.productCount}
            </div>
            <div className="text-muted text-sm">products listed</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="col">
      <div className="stat-card" style={{ flexDirection: "column", alignItems: "flex-start" }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ marginTop: 4, color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function FunnelStage({ count, label, won }: { count: number; label: string; won?: boolean }) {
  return (
    <div className={`pipeline-stage${won ? " pipeline-stage-won" : ""}`}>
      <div className="pipeline-count">{count}</div>
      <div className="text-muted text-sm">{label}</div>
    </div>
  );
}
