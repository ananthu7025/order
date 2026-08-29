"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";

type Quotation = {
  id: string;
  quoteNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  leadId: string;
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);

  useEffect(() => {
    fetch("/api/quotations")
      .then((res) => res.json())
      .then((data) => setQuotations(data.quotations ?? []));
  }, []);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Quotations</h1>
          <p>Every quotation you&apos;ve sent to a buyer, and its current status.</p>
        </div>
      </div>

      <div className="card">
        {quotations === null ? (
          <div className="card-pad">Loading quotations…</div>
        ) : quotations.length === 0 ? (
          <div className="card-pad" style={{ textAlign: "center", padding: 48 }}>
            <div className="font-bold" style={{ marginBottom: 8 }}>
              No quotations yet
            </div>
            <p className="text-muted">Create a quotation from a lead&apos;s detail page.</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-500)",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--border-light)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "12px 22px" }}>Quote #</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Amount</th>
                <th style={{ padding: 12 }}>Date</th>
                <th style={{ padding: 12 }}></th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "16px 22px", fontWeight: 700 }}>{q.quoteNumber}</td>
                  <td style={{ padding: 16 }}>
                    <StatusBadge status={q.status} />
                  </td>
                  <td style={{ padding: 16, fontWeight: 700 }}>{formatCurrency(q.totalAmount)}</td>
                  <td style={{ padding: 16 }}>{formatDate(q.createdAt)}</td>
                  <td style={{ padding: 16, textAlign: "right" }}>
                    <Link className="btn btn-outline btn-sm" href={`/quotations/${q.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
