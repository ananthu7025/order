"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelativeTime } from "@/lib/format";
import { Building2, Phone } from "lucide-react";

type Lead = {
  id: string;
  source: string;
  status: "NEW" | "CONTACTED" | "INTERESTED" | "QUOTED" | "WON" | "LOST";
  fromPhone: string | null;
  rawMessage: string | null;
  buyerName: string | null;
  businessName: string | null;
  productText: string | null;
  quantity: string | null;
  specification: string | null;
  location: string | null;
  deadline: string | null;
  notes: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = ["NEW", "CONTACTED", "INTERESTED", "QUOTED", "WON", "LOST"] as const;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  function refresh() {
    fetch(`/api/leads/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setLead(data.lead);
        setNotes(data.lead?.notes ?? "");
      });
  }

  useEffect(refresh, [id]);

  async function updateStatus(status: string) {
    setSavingStatus(true);
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
    setSavingStatus(false);
  }

  async function saveNotes() {
    setSavingNotes(true);
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSavingNotes(false);
  }

  if (!lead) {
    return (
      <AppShell>
        <div className="card card-pad">Loading…</div>
      </AppShell>
    );
  }

  const displayName = lead.businessName || lead.buyerName || "Unnamed buyer";

  return (
    <AppShell>
      <div className="breadcrumb">
        <span>Home</span>
        <span className="sep">&gt;</span>
        <Link href="/leads">Leads</Link>
        <span className="sep">&gt;</span>
        <span className="current">{displayName}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>
            {displayName} <StatusBadge status={lead.status} />
          </h1>
          <p>Received {formatRelativeTime(lead.createdAt)} via {lead.source.toLowerCase()}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline">
            <Phone size={16} strokeWidth={1.8} style={{ marginRight: 6 }} />
            Contact Buyer
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => router.push(`/quotations/new?leadId=${lead.id}`)}
          >
            Create Quotation
          </button>
        </div>
      </div>

      <div className="row">
        <div className="col-main col-lg-8">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Requirement
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              <InfoBlock label="Product" value={lead.productText} />
              <InfoBlock label="Quantity" value={lead.quantity} />
              <InfoBlock label="Location" value={lead.location} />
              <InfoBlock label="Deadline" value={lead.deadline} />
            </div>
          </div>

          {lead.specification && (
            <div className="card card-pad">
              <div className="card-title" style={{ marginBottom: 16 }}>
                Specification
              </div>
              <p className="text-sm" style={{ color: "var(--ink-700)", lineHeight: 1.7 }}>
                {lead.specification}
              </p>
            </div>
          )}

          {lead.rawMessage && (
            <div className="card card-pad">
              <div className="card-title" style={{ marginBottom: 12 }}>
                Buyer&apos;s Message
              </div>
              <p className="text-sm" style={{ color: "var(--ink-700)", lineHeight: 1.7 }}>
                &quot;{lead.rawMessage}&quot;
              </p>
            </div>
          )}

          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="card-title">Status</div>
                <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                  Update this lead as you move through your sales process.
                </div>
              </div>
              <select
                className="input"
                style={{ width: "auto", padding: "9px 14px", fontWeight: 700 }}
                value={lead.status}
                disabled={savingStatus}
                onChange={(e) => updateStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="col-side col-lg-4">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>
              Buyer
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="lead-avatar" style={{ background: "#eff6ff", color: "#2563eb", width: 44, height: 44 }}>
                <Building2 size={20} strokeWidth={1.8} />
              </div>
              <div>
                <div className="font-bold">{displayName}</div>
                <div className="text-muted text-sm">{lead.location || "Location unknown"}</div>
              </div>
            </div>
            <div className="divider" style={{ marginTop: 16, paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Phone</span>
                <span className="font-bold text-sm">{lead.fromPhone || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Source</span>
                <span className="font-bold text-sm">{lead.source}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-sm text-muted">Deadline</span>
                <span className="font-bold text-sm" style={{ color: "var(--red)" }}>
                  {lead.deadline || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 12 }}>
              Notes
            </div>
            <textarea
              className="ui-textarea"
              placeholder="Add a private note about this lead..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button className="btn btn-outline btn-block" style={{ marginTop: 10 }} disabled={savingNotes} onClick={saveNotes}>
              {savingNotes ? "Saving…" : "Save Note"}
            </button>
          </div>

          <button
            className="btn btn-outline btn-block"
            onClick={() => router.push(`/quotations/new?leadId=${lead.id}`)}
          >
            Create Quotation
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-sm">
      <b>{value || "—"}</b>
      <br />
      <span className="text-muted">{label}</span>
    </div>
  );
}
