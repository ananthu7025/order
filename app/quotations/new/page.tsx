"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { formatCurrency } from "@/lib/format";

type LineItem = { description: string; quantity: string; rate: string };

type Lead = {
  id: string;
  businessName: string | null;
  buyerName: string | null;
  productText: string | null;
  quantity: string | null;
  specification: string | null;
  location: string | null;
  deadline: string | null;
  fromPhone: string | null;
};

const EMPTY_ITEM: LineItem = { description: "", quantity: "1", rate: "0" };

export default function NewQuotationPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="card card-pad">Loading…</div>
        </AppShell>
      }
    >
      <NewQuotationForm />
    </Suspense>
  );
}

function NewQuotationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  const [lead, setLead] = useState<Lead | null>(null);
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [gstPercent, setGstPercent] = useState("18");
  const [paymentTerms, setPaymentTerms] = useState("50% Advance, 50% Before Dispatch");
  const [leadTime, setLeadTime] = useState("7-10 days");
  const [validTill, setValidTill] = useState("7 days from issue");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/leads/${leadId}`)
      .then((res) => res.json())
      .then((data) => {
        setLead(data.lead);
        if (data.lead?.productText) {
          setItems([
            {
              description: data.lead.productText,
              quantity: data.lead.quantity?.replace(/[^\d.]/g, "") || "1",
              rate: "0",
            },
          ]);
        }
      });
  }, [leadId]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0);
  const gstAmount = Math.round(subtotal * (Number(gstPercent) / 100) * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;

  async function submit() {
    if (!leadId) {
      setError("No lead selected. Open this page from a lead's detail page.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          gstPercent,
          paymentTerms,
          leadTime,
          validTill,
          notes,
          lineItems: items.filter((item) => item.description.trim() !== ""),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create quotation");
      }
      const data = await res.json();
      router.push(`/quotations/${data.quotation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quotation");
    } finally {
      setSaving(false);
    }
  }

  const buyerName = lead?.businessName || lead?.buyerName || "buyer";

  return (
    <AppShell>
      <div className="breadcrumb">
        <span>Home</span>
        <span className="sep">&gt;</span>
        <Link href="/leads">Leads</Link>
        {leadId && (
          <>
            <span className="sep">&gt;</span>
            <Link href={`/leads/${leadId}`}>{buyerName}</Link>
          </>
        )}
        <span className="sep">&gt;</span>
        <span className="current">Create Quotation</span>
      </div>

      <div className="page-header">
        <div>
          <h1>Create Quotation</h1>
          <p>For {buyerName}{lead?.productText ? ` • ${lead.productText}` : ""}</p>
        </div>
      </div>

      {error && (
        <div className="banner banner-amber" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="row">
        <div className="col-main col-lg-8">
          {lead && (
            <div className="card card-pad" style={{ background: "var(--blue-light)", borderColor: "var(--blue-border)" }}>
              <div className="font-bold" style={{ color: "#1e3a8a" }}>
                Quoting against this requirement
              </div>
              <div style={{ fontSize: 12.5, color: "#1e40af", marginTop: 4 }}>
                {[lead.quantity, lead.specification, lead.location, lead.deadline]
                  .filter(Boolean)
                  .join(" • ") || "No structured requirement recorded yet."}
              </div>
            </div>
          )}

          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Line Items
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr auto", gap: 10, fontSize: 12.5, color: "var(--ink-500)", fontWeight: 600, paddingBottom: 8 }}>
              <div>Item</div>
              <div>Quantity</div>
              <div>Rate (₹)</div>
              <div style={{ textAlign: "right" }}>Amount (₹)</div>
              <div></div>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className={index > 0 ? "divider" : ""}
                style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr auto", gap: 10, padding: "12px 0", alignItems: "center" }}
              >
                <input
                  className="input"
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="e.g. Corrugated Box"
                />
                <input
                  className="input"
                  type="text"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                />
                <input
                  className="input"
                  type="text"
                  value={item.rate}
                  onChange={(e) => updateItem(index, { rate: e.target.value })}
                />
                <div className="font-bold text-sm" style={{ textAlign: "right" }}>
                  {formatCurrency(Number(item.quantity || 0) * Number(item.rate || 0))}
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ padding: "4px 8px" }}
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  ×
                </button>
              </div>
            ))}

            <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={addItem}>
              + Add Line Item
            </button>

            <div className="divider" style={{ marginTop: 18, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Subtotal</span>
                <span className="font-bold text-sm">{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="text-sm text-muted">GST %</span>
                <input
                  className="input"
                  style={{ width: 80, padding: "6px 10px", textAlign: "right" }}
                  type="text"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                <span className="font-bold" style={{ fontSize: 16 }}>
                  Total Quotation Amount
                </span>
                <span className="font-bold" style={{ fontSize: 18, color: "var(--blue)" }}>
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Terms &amp; Delivery
            </div>
            <div className="row row-cols-1 row-cols-md-3 g-3">
              <div className="col">
                <label className="field-label">Payment Terms</label>
                <input className="input" type="text" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
              <div className="col">
                <label className="field-label">Production Lead Time</label>
                <input className="input" type="text" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
              </div>
              <div className="col">
                <label className="field-label">Quote Valid Till</label>
                <input className="input" type="text" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="field-label">Notes to Buyer</label>
              <textarea className="ui-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-primary btn-lg" disabled={saving} onClick={submit}>
              {saving ? "Saving…" : "Save Quotation"}
            </button>
          </div>
        </div>

        <div className="col-side col-lg-4">
          {lead && (
            <div className="card card-pad">
              <div className="card-title" style={{ marginBottom: 14 }}>
                Buyer
              </div>
              <div className="font-bold">{buyerName}</div>
              <div className="text-muted text-sm">{lead.location || "Location unknown"}</div>
              <div className="divider" style={{ marginTop: 16, paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-sm text-muted">Phone</span>
                  <span className="font-bold text-sm">{lead.fromPhone || "—"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
