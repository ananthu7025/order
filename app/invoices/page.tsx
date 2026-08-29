"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  billToName: string;
  totalAmount: string;
  amountPaid: string;
  issuedAt: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    fetch("/api/invoices")
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices ?? []));
  }, []);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p>Invoices generated from accepted quotations, and their payment status.</p>
        </div>
      </div>

      <div className="card">
        {invoices === null ? (
          <div className="card-pad">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="card-pad" style={{ textAlign: "center", padding: 48 }}>
            <div className="font-bold" style={{ marginBottom: 8 }}>
              No invoices yet
            </div>
            <p className="text-muted">Generate an invoice from an accepted quotation.</p>
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
                <th style={{ padding: "12px 22px" }}>Invoice #</th>
                <th style={{ padding: 12 }}>Bill To</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Total</th>
                <th style={{ padding: 12 }}>Paid</th>
                <th style={{ padding: 12 }}>Issued</th>
                <th style={{ padding: 12 }}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "16px 22px", fontWeight: 700 }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: 16 }}>{inv.billToName}</td>
                  <td style={{ padding: 16 }}>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td style={{ padding: 16, fontWeight: 700 }}>{formatCurrency(inv.totalAmount)}</td>
                  <td style={{ padding: 16 }}>{formatCurrency(inv.amountPaid)}</td>
                  <td style={{ padding: 16 }}>{formatDate(inv.issuedAt)}</td>
                  <td style={{ padding: 16, textAlign: "right" }}>
                    <Link className="btn btn-outline btn-sm" href={`/invoices/${inv.id}`}>
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
