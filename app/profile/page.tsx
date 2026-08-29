"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Manufacturer = {
  companyName: string;
  businessType: string;
  aboutCompany: string | null;
  yearEstablished: string | null;
  gstin: string | null;
  website: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  businessLocation: string | null;
  manufacturingLocations: string | null;
  categories: string[];
};

const AVAILABLE_CATEGORIES = [
  "Packaging Materials",
  "Corrugated Boxes",
  "Custom Garments",
  "Promotional Products",
  "Industrial Procurement",
];

export default function ProfilePage() {
  const [form, setForm] = useState<Manufacturer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/manufacturer")
      .then((res) => res.json())
      .then((data) => setForm(data.manufacturer));
  }, []);

  function update<K extends keyof Manufacturer>(key: K, value: Manufacturer[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function toggleCategory(category: string) {
    if (!form) return;
    const has = form.categories.includes(category);
    update("categories", has ? form.categories.filter((c) => c !== category) : [...form.categories, category]);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/manufacturer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!form) {
    return (
      <AppShell>
        <div className="card card-pad">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell companyName={form.companyName}>
      <div className="page-header">
        <div>
          <h1>Company Profile</h1>
          <p>A complete profile builds buyer trust and improves future AI matching accuracy.</p>
        </div>
        <button className="btn btn-primary btn-lg" disabled={saving} onClick={save}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>

      <div className="row">
        <div className="col-main col-lg-9">
          <div className="card card-pad">
            <div className="card-title">Company Information</div>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>
              Basic details buyers will see on your profile
            </p>

            <div className="row row-cols-1 row-cols-md-2 g-3">
              <TextField label="Company Name *" value={form.companyName} onChange={(v) => update("companyName", v)} />
              <div className="col">
                <label className="field-label">Business Type</label>
                <select className="input" value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
                  <option>Manufacturer</option>
                  <option>Trader</option>
                  <option>Distributor</option>
                </select>
              </div>
              <TextField label="Year Established" value={form.yearEstablished ?? ""} onChange={(v) => update("yearEstablished", v)} />
              <TextField label="GSTIN" value={form.gstin ?? ""} onChange={(v) => update("gstin", v)} />
              <TextField label="Website" value={form.website ?? ""} onChange={(v) => update("website", v)} />
              <TextField label="Phone" value={form.phone ?? ""} onChange={(v) => update("phone", v)} />
              <TextField label="WhatsApp Number" value={form.whatsappNumber ?? ""} onChange={(v) => update("whatsappNumber", v)} />
              <TextField label="Business Location" value={form.businessLocation ?? ""} onChange={(v) => update("businessLocation", v)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="field-label">About Company</label>
              <textarea className="ui-textarea" value={form.aboutCompany ?? ""} onChange={(e) => update("aboutCompany", e.target.value)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="field-label">Manufacturing Locations</label>
              <input
                className="input"
                type="text"
                value={form.manufacturingLocations ?? ""}
                onChange={(e) => update("manufacturingLocations", e.target.value)}
              />
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">Product Categories</div>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 16 }}>
              Select the categories you operate in — used for buyer and future AI matching
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {AVAILABLE_CATEGORIES.map((category) => {
                const active = form.categories.includes(category);
                return (
                  <span
                    key={category}
                    className="variant-chip"
                    onClick={() => toggleCategory(category)}
                    style={{
                      cursor: "pointer",
                      padding: "8px 14px",
                      background: active ? "var(--blue-light)" : undefined,
                      color: active ? "var(--blue)" : undefined,
                      fontWeight: active ? 700 : undefined,
                    }}
                  >
                    {active ? "✓ " : ""}
                    {category}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-side col-lg-3">
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <img
              src="https://i.pravatar.cc/120?img=33"
              style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto 12px", display: "block" }}
              alt=""
            />
            <div className="font-bold" style={{ fontSize: 15 }}>
              {form.companyName}
            </div>
            <div className="text-muted text-sm" style={{ marginTop: 2 }}>
              {form.businessLocation}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="col">
      <label className="field-label">{label}</label>
      <input className="input" type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
