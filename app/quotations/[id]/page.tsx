"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";

type LineItem = { id: string; description: string; quantity: string; rate: string; amount: string };

type Quotation = {
  id: string;
  quoteNumber: string;
  status: string;
  leadId: string;
  subtotal: string;
  gstPercent: string;
  gstAmount: string;
  totalAmount: string;
  paymentTerms: string | null;
  leadTime: string | null;
  validTill: string | null;
  notes: string | null;
  lineItems: LineItem[];
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [leadInfo, setLeadInfo] = useState<{
    businessName: string | null;
    buyerName: string | null;
    location: string | null;
    fromPhone: string | null;
  } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  function refresh() {
    fetch(`/api/quotations/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setQuotation(data.quotation);
        if (data.quotation?.leadId) {
          fetch(`/api/leads/${data.quotation.leadId}`)
            .then((res) => res.json())
            .then((leadData) => setLeadInfo(leadData.lead));
        }
      });
  }

  useEffect(refresh, [id]);

  async function setStatus(status: string) {
    setUpdating(true);
    await fetch(`/api/quotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
    setUpdating(false);
  }

  async function generateInvoice() {
    if (!quotation) return;
    setGeneratingInvoice(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotationId: quotation.id,
        billToName: leadInfo?.businessName || leadInfo?.buyerName || "Buyer",
        billToAddress: leadInfo?.location || undefined,
        billToPhone: leadInfo?.fromPhone || undefined,
      }),
    });
    setGeneratingInvoice(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/invoices/${data.invoice.id}`);
    }
  }

  if (!quotation) {
    return (
      <AppShell>
        <div className="card card-pad">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="breadcrumb">
        <span>Home</span>
        <span className="sep">&gt;</span>
        <Link href="/quotations">Quotations</Link>
        <span className="sep">&gt;</span>
        <span className="current">{quotation.quoteNumber}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>
            {quotation.quoteNumber} <StatusBadge status={quotation.status} />
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/leads/${quotation.leadId}`} className="btn btn-outline">
            View Lead
          </Link>
          {quotation.status === "DRAFT" && (
            <button className="btn btn-primary btn-lg" disabled={updating} onClick={() => setStatus("SENT")}>
              Send Quotation
            </button>
          )}
          {quotation.status === "SENT" && (
            <>
              <button className="btn btn-outline" disabled={updating} onClick={() => setStatus("REVISION_REQUESTED")}>
                Request Revision
              </button>
              <button className="btn btn-outline" disabled={updating} onClick={() => setStatus("DECLINED")}>
                Mark Declined
              </button>
              <button className="btn btn-primary btn-lg" disabled={updating} onClick={() => setStatus("ACCEPTED")}>
                Mark Accepted
              </button>
            </>
          )}
          {quotation.status === "ACCEPTED" && (
            <button className="btn btn-primary btn-lg" disabled={generatingInvoice} onClick={generateInvoice}>
              {generatingInvoice ? "Generating…" : "Generate Invoice"}
            </button>
          )}
        </div>
      </div>

      <div className="row">
        <div className="col-main col-lg-8">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Line Items
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr", gap: 10, fontSize: 12.5, color: "var(--ink-500)", fontWeight: 600, paddingBottom: 8 }}>
              <div>Item</div>
              <div>Quantity</div>
              <div>Rate (₹)</div>
              <div style={{ textAlign: "right" }}>Amount (₹)</div>
            </div>
            {quotation.lineItems.map((item, index) => (
              <div
                key={item.id}
                className={index > 0 ? "divider" : ""}
                style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr", gap: 10, padding: "12px 0" }}
              >
                <div className="text-sm">{item.description}</div>
                <div className="text-sm">{item.quantity}</div>
                <div className="text-sm">₹{item.rate}</div>
                <div className="font-bold text-sm" style={{ textAlign: "right" }}>
                  {formatCurrency(item.amount)}
                </div>
              </div>
            ))}

            <div className="divider" style={{ marginTop: 18, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Subtotal</span>
                <span className="font-bold text-sm">{formatCurrency(quotation.subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">GST ({quotation.gstPercent}%)</span>
                <span className="font-bold text-sm">{formatCurrency(quotation.gstAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                <span className="font-bold" style={{ fontSize: 16 }}>
                  Total Quotation Amount
                </span>
                <span className="font-bold" style={{ fontSize: 18, color: "var(--blue)" }}>
                  {formatCurrency(quotation.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Terms &amp; Delivery
            </div>
            <div className="row row-cols-1 row-cols-md-3 g-3">
              <InfoRow label="Payment Terms" value={quotation.paymentTerms} />
              <InfoRow label="Production Lead Time" value={quotation.leadTime} />
              <InfoRow label="Quote Valid Till" value={quotation.validTill} />
            </div>
            {quotation.notes && (
              <div style={{ marginTop: 14 }}>
                <label className="field-label">Notes to Buyer</label>
                <p className="text-sm" style={{ color: "var(--ink-700)" }}>
                  {quotation.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="col-side col-lg-4">
          <div className="card card-pad" style={{ background: "var(--blue-light)", borderColor: "var(--blue-border)" }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              What happens next?
            </div>
            <div style={{ fontSize: 12.5, color: "#1e40af", lineHeight: 1.6 }}>
              {quotation.status === "DRAFT" && "Send this quotation to move it to the buyer. Once accepted, the lead moves to Won and you can generate an invoice."}
              {quotation.status === "SENT" && "Waiting on the buyer. Mark Accepted once they confirm, or Declined / Request Revision as needed."}
              {quotation.status === "ACCEPTED" && "This quotation was accepted — generate an invoice to start billing."}
              {quotation.status === "DECLINED" && "This quotation was declined. The related lead has been marked Lost."}
              {quotation.status === "REVISION_REQUESTED" && "The buyer requested changes to this quotation."}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="col">
      <label className="field-label">{label}</label>
      <div className="font-bold text-sm">{value || "—"}</div>
    </div>
  );
}
