"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";

type Payment = { id: string; amount: string; method: string | null; paidAt: string };

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  billToName: string;
  billToAddress: string | null;
  billToPhone: string | null;
  subtotal: string;
  cgstAmount: string;
  sgstAmount: string;
  totalAmount: string;
  amountPaid: string;
  issuedAt: string;
  dueAt: string | null;
  notes: string | null;
  payments: Payment[];
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank Transfer");
  const [saving, setSaving] = useState(false);

  function refresh() {
    fetch(`/api/invoices/${id}`)
      .then((res) => res.json())
      .then((data) => setInvoice(data.invoice));
  }

  useEffect(refresh, [id]);

  async function recordPayment() {
    setSaving(true);
    await fetch(`/api/invoices/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method }),
    });
    setSaving(false);
    setShowPaymentForm(false);
    setAmount("");
    refresh();
  }

  if (!invoice) {
    return (
      <AppShell>
        <div className="card card-pad">Loading…</div>
      </AppShell>
    );
  }

  const balanceDue = Math.round((Number(invoice.totalAmount) - Number(invoice.amountPaid)) * 100) / 100;
  const paidPct = Math.min(100, Math.round((Number(invoice.amountPaid) / Number(invoice.totalAmount)) * 100));

  return (
    <AppShell>
      <div className="breadcrumb">
        <span>Home</span>
        <span className="sep">&gt;</span>
        <Link href="/invoices">Invoices</Link>
        <span className="sep">&gt;</span>
        <span className="current">{invoice.invoiceNumber}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>
            Invoice <StatusBadge status={invoice.status} />
          </h1>
          <p>Bill to {invoice.billToName}</p>
        </div>
      </div>

      <div className="row">
        <div className="col-main col-lg-8">
          <div className="card card-pad" style={{ padding: 32 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingBottom: 22,
                borderBottom: "2px solid var(--ink-900)",
              }}
            >
              <div>
                <div className="font-bold" style={{ fontSize: 17 }}>
                  PackRight Industries
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="font-bold" style={{ fontSize: 22, letterSpacing: "-0.02em" }}>
                  INVOICE
                </div>
                <div className="text-muted text-sm" style={{ marginTop: 6 }}>
                  {invoice.invoiceNumber}
                </div>
                <div className="text-muted text-sm">Issued: {formatDate(invoice.issuedAt)}</div>
                {invoice.dueAt && <div className="text-muted text-sm">Due: {formatDate(invoice.dueAt)}</div>}
              </div>
            </div>

            <div className="row row-cols-2 g-3" style={{ padding: "22px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="col">
                <div className="text-sm text-muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                  BILL TO
                </div>
                <div className="font-bold text-sm">{invoice.billToName}</div>
                <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                  {invoice.billToAddress}
                  {invoice.billToAddress && <br />}
                  {invoice.billToPhone}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <div style={{ width: 280 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span className="text-sm text-muted">Subtotal</span>
                  <span className="font-bold text-sm">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span className="text-sm text-muted">CGST</span>
                  <span className="font-bold text-sm">{formatCurrency(invoice.cgstAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span className="text-sm text-muted">SGST</span>
                  <span className="font-bold text-sm">{formatCurrency(invoice.sgstAmount)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderTop: "2px solid var(--ink-900)",
                    marginTop: 4,
                  }}
                >
                  <span className="font-bold" style={{ fontSize: 15 }}>
                    Total Due
                  </span>
                  <span className="font-bold" style={{ fontSize: 17 }}>
                    {formatCurrency(invoice.totalAmount)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                  <span className="text-sm text-muted">Amount Paid</span>
                  <span className="font-bold text-sm" style={{ color: "var(--green-text)" }}>
                    {formatCurrency(invoice.amountPaid)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: 8,
                    background: "var(--orange-light)",
                    borderRadius: 6,
                  }}
                >
                  <span className="font-bold text-sm" style={{ color: "var(--orange-text)" }}>
                    Balance Due
                  </span>
                  <span className="font-bold text-sm" style={{ color: "var(--orange-text)" }}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                <div className="text-sm text-muted" style={{ fontWeight: 700, marginBottom: 6 }}>
                  NOTES
                </div>
                <div className="text-sm" style={{ color: "var(--ink-700)" }}>
                  {invoice.notes}
                </div>
              </div>
            )}
          </div>

          {invoice.payments.length > 0 && (
            <div className="card card-pad">
              <div className="card-title" style={{ marginBottom: 14 }}>
                Payment History
              </div>
              {invoice.payments.map((p, index) => (
                <div
                  key={p.id}
                  className={index > 0 ? "divider" : ""}
                  style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}
                >
                  <span className="text-sm">
                    {p.method || "Payment"} • {formatDate(p.paidAt)}
                  </span>
                  <span className="font-bold text-sm">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-side col-lg-4">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>
              Payment Status
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="text-sm text-muted">Status</span>
              <StatusBadge status={invoice.status} />
            </div>
            <div className="progress-track" style={{ height: 8, marginBottom: 14 }}>
              <div className="progress-fill fill-orange" style={{ width: `${paidPct}%` }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Total Amount</span>
                <span className="font-bold text-sm">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Received</span>
                <span className="font-bold text-sm" style={{ color: "var(--green-text)" }}>
                  {formatCurrency(invoice.amountPaid)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Balance</span>
                <span className="font-bold text-sm" style={{ color: "var(--orange-text)" }}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            {invoice.status !== "PAID" && (
              <>
                {!showPaymentForm ? (
                  <button className="btn btn-outline btn-block" style={{ marginTop: 16 }} onClick={() => setShowPaymentForm(true)}>
                    + Record Payment
                  </button>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <label className="field-label">Amount (₹)</label>
                    <input className="input" type="text" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <label className="field-label" style={{ marginTop: 10 }}>
                      Method
                    </label>
                    <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option>Bank Transfer</option>
                      <option>UPI</option>
                      <option>Cash</option>
                      <option>Cheque</option>
                    </select>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button className="btn btn-outline btn-block" onClick={() => setShowPaymentForm(false)}>
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-block" disabled={saving || !amount} onClick={recordPayment}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
