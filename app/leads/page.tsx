"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
import { Building2 } from "lucide-react";

type Lead = {
  id: string;
  source: "WHATSAPP" | "TELEGRAM" | "WEBSITE" | "MANUAL";
  status: "NEW" | "CONTACTED" | "INTERESTED" | "QUOTED" | "WON" | "LOST";
  businessName: string | null;
  buyerName: string | null;
  productText: string | null;
  quantity: string | null;
  location: string | null;
  rawMessage: string | null;
  createdAt: string;
};

const STATUS_TABS = ["ALL", "NEW", "CONTACTED", "INTERESTED", "QUOTED", "WON", "LOST"] as const;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const [showAddForm, setShowAddForm] = useState(false);

  function refresh() {
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => setLeads(data.leads ?? []));
  }

  useEffect(refresh, []);

  const filtered = leads?.filter((l) => tab === "ALL" || l.status === tab) ?? [];

  return (
    <AppShell newLeadCount={leads?.filter((l) => l.status === "NEW").length}>
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Buyer requirements matched to your products, ready for you to respond.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Close" : "+ Add Lead Manually"}
        </button>
      </div>

      {showAddForm && (
        <AddLeadForm
          onCreated={() => {
            setShowAddForm(false);
            refresh();
          }}
        />
      )}

      <div className="tabs" style={{ marginBottom: 20 }}>
        {STATUS_TABS.map((s) => (
          <div
            key={s}
            className={`tab${tab === s ? " active" : ""}`}
            onClick={() => setTab(s)}
            style={{ cursor: "pointer" }}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            <span className="count">
              {s === "ALL" ? leads?.length ?? 0 : leads?.filter((l) => l.status === s).length ?? 0}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        {leads === null ? (
          <div className="card-pad">Loading leads…</div>
        ) : filtered.length === 0 ? (
          <div className="card-pad" style={{ textAlign: "center", padding: 48 }}>
            <div className="font-bold" style={{ marginBottom: 8 }}>
              No leads{tab !== "ALL" ? ` with status ${tab.toLowerCase()}` : ""} yet
            </div>
            <p className="text-muted">
              Leads will appear here once your WhatsApp bot sends them to <code>/api/leads/inbound</code>, or add one manually above.
            </p>
          </div>
        ) : (
          filtered.map((lead, index) => (
            <div key={lead.id} className={`lead-row${index > 0 ? " divider" : ""}`} style={{ padding: "16px 22px" }}>
              <div className="lead-row-main">
                <div className="lead-avatar" style={{ background: "#eff6ff", color: "#2563eb" }}>
                  <Building2 size={18} strokeWidth={1.8} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="font-bold text-sm">{lead.businessName || lead.buyerName || "Unnamed buyer"}</div>
                    <StatusBadge status={lead.status} />
                  </div>
                  <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                    {lead.productText ||
                      (lead.rawMessage ? lead.rawMessage.slice(0, 80) : "No details yet")}
                    {lead.quantity ? ` • Quantity: ${lead.quantity}` : ""}
                    {lead.location ? ` • ${lead.location}` : ""}
                  </div>
                </div>
              </div>
              <div className="lead-row-meta">
                <div className="text-muted text-sm">Received</div>
                <div className="font-bold text-sm">{formatRelativeTime(lead.createdAt)}</div>
              </div>
              <Link className="btn btn-outline btn-sm" href={`/leads/${lead.id}`}>
                View Lead
              </Link>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

function AddLeadForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    businessName: "",
    buyerName: "",
    fromPhone: "",
    productText: "",
    quantity: "",
    specification: "",
    location: "",
    deadline: "",
    rawMessage: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "MANUAL", ...form }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create lead");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="card-title" style={{ marginBottom: 16 }}>
        Add Lead Manually
      </div>
      {error && (
        <div className="banner banner-amber" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <div className="row row-cols-1 row-cols-md-3 g-3">
        <Field label="Business Name" value={form.businessName} onChange={(v) => setForm((f) => ({ ...f, businessName: v }))} />
        <Field label="Buyer Name" value={form.buyerName} onChange={(v) => setForm((f) => ({ ...f, buyerName: v }))} />
        <Field label="Phone" value={form.fromPhone} onChange={(v) => setForm((f) => ({ ...f, fromPhone: v }))} />
        <Field label="Product" value={form.productText} onChange={(v) => setForm((f) => ({ ...f, productText: v }))} />
        <Field label="Quantity" value={form.quantity} onChange={(v) => setForm((f) => ({ ...f, quantity: v }))} />
        <Field label="Location" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
        <Field label="Deadline" value={form.deadline} onChange={(v) => setForm((f) => ({ ...f, deadline: v }))} />
        <Field label="Specification" value={form.specification} onChange={(v) => setForm((f) => ({ ...f, specification: v }))} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="field-label">Buyer&apos;s Message (optional)</label>
        <textarea
          className="ui-textarea"
          value={form.rawMessage}
          onChange={(e) => setForm((f) => ({ ...f, rawMessage: e.target.value }))}
        />
      </div>
      <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={saving} onClick={submit}>
        {saving ? "Saving…" : "Create Lead"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="col">
      <label className="field-label">{label}</label>
      <input className="input" type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
