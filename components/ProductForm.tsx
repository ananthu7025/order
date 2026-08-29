"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProductFormValues = {
  name: string;
  category: string;
  description: string;
  material: string;
  size: string;
  gsmOrThickness: string;
  color: string;
  weight: string;
  capacity: string;
  customization: string;
  otherSpecs: string;
  moq: string;
  priceMin: string;
  priceMax: string;
  packingCharges: string;
  shippingCharges: string;
  otherCharges: string;
  paymentTerms: string;
  leadTime: string;
  availableCapacity: string;
  deliveryLocations: string;
  customManufacturing: boolean;
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  category: "Packaging Materials",
  description: "",
  material: "",
  size: "",
  gsmOrThickness: "",
  color: "",
  weight: "",
  capacity: "",
  customization: "",
  otherSpecs: "",
  moq: "",
  priceMin: "",
  priceMax: "",
  packingCharges: "",
  shippingCharges: "",
  otherCharges: "",
  paymentTerms: "",
  leadTime: "",
  availableCapacity: "",
  deliveryLocations: "",
  customManufacturing: false,
};

export function ProductForm({
  productId,
  initialValues,
}: {
  productId?: string;
  initialValues?: Partial<ProductFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save(status: "DRAFT" | "PUBLISHED") {
    setSaving(true);
    setError(null);

    const payload = {
      ...values,
      priceMin: values.priceMin || undefined,
      priceMax: values.priceMax || undefined,
      status,
    };

    try {
      const res = await fetch(productId ? `/api/products/${productId}` : "/api/products", {
        method: productId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save product");
      }

      router.push("/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="row">
      <div className="col-main col-lg-9">
        {error && (
          <div className="banner banner-amber" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="card card-pad">
          <div className="card-title">1. Basic Information</div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>
            Tell buyers what you offer
          </p>

          <div className="row row-cols-1 row-cols-md-2 g-3">
            <div className="col">
              <label className="field-label">
                Product / Service Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Corrugated Box"
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div className="col">
              <label className="field-label">
                Category <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <select className="input" value={values.category} onChange={(e) => update("category", e.target.value)}>
                <option>Packaging Materials</option>
                <option>Custom Garments</option>
                <option>Promotional Products</option>
                <option>Industrial Procurement</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="field-label">
              Short Description <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <textarea
              className="ui-textarea"
              placeholder="Briefly describe this product or service..."
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title">2. Specifications</div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>
            Flexible fields based on your product category
          </p>

          <div className="row row-cols-1 row-cols-md-3 g-3">
            <TextField label="Material" value={values.material} onChange={(v) => update("material", v)} placeholder="e.g. 5-ply Kraft" />
            <TextField label="Size / Dimensions" value={values.size} onChange={(v) => update("size", v)} placeholder="e.g. 12 x 10 x 8 inch" />
            <TextField label="GSM / Thickness" value={values.gsmOrThickness} onChange={(v) => update("gsmOrThickness", v)} placeholder="e.g. 180 GSM" />
            <TextField label="Color" value={values.color} onChange={(v) => update("color", v)} placeholder="e.g. Brown, White" />
            <TextField label="Weight" value={values.weight} onChange={(v) => update("weight", v)} placeholder="e.g. 250 g/pc" />
            <TextField label="Capacity" value={values.capacity} onChange={(v) => update("capacity", v)} placeholder="e.g. Up to 5 kg" />
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="field-label">Customization Options</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Printing, embossing, custom sizes"
              value={values.customization}
              onChange={(e) => update("customization", e.target.value)}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="field-label">Other Specifications</label>
            <textarea
              className="ui-textarea"
              placeholder="Any additional technical details..."
              value={values.otherSpecs}
              onChange={(e) => update("otherSpecs", e.target.value)}
            />
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title">3. Commercial Information</div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>
            Pricing and order terms
          </p>

          <div className="row row-cols-1 row-cols-md-3 g-3">
            <TextField label="MOQ *" value={values.moq} onChange={(v) => update("moq", v)} placeholder="e.g. 500 units" />
            <TextField label="Min Price (₹)" value={values.priceMin} onChange={(v) => update("priceMin", v)} placeholder="e.g. 12" />
            <TextField label="Max Price (₹)" value={values.priceMax} onChange={(v) => update("priceMax", v)} placeholder="e.g. 25" />
            <TextField label="Payment Terms" value={values.paymentTerms} onChange={(v) => update("paymentTerms", v)} placeholder="e.g. 50% advance" />
            <TextField label="Packing Charges" value={values.packingCharges} onChange={(v) => update("packingCharges", v)} placeholder="e.g. ₹0.50/unit" />
            <TextField label="Shipping Charges" value={values.shippingCharges} onChange={(v) => update("shippingCharges", v)} placeholder="e.g. At actuals" />
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title">4. Production &amp; Delivery</div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>
            Capacity and fulfillment details
          </p>

          <div className="row row-cols-1 row-cols-md-2 g-3">
            <TextField label="Manufacturing Lead Time" value={values.leadTime} onChange={(v) => update("leadTime", v)} placeholder="e.g. 7-10 days" />
            <TextField
              label="Available Quantity / Capacity"
              value={values.availableCapacity}
              onChange={(v) => update("availableCapacity", v)}
              placeholder="e.g. 50,000 units / month"
            />
            <TextField label="Delivery Locations" value={values.deliveryLocations} onChange={(v) => update("deliveryLocations", v)} placeholder="e.g. All India" />
            <div className="col">
              <label className="field-label">Custom Manufacturing Availability</label>
              <select
                className="input"
                value={values.customManufacturing ? "yes" : "no"}
                onChange={(e) => update("customManufacturing", e.target.value === "yes")}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-outline btn-lg" disabled={saving} onClick={() => save("DRAFT")}>
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button className="btn btn-primary btn-lg" disabled={saving} onClick={() => save("PUBLISHED")}>
            {saving ? "Saving…" : "Publish"}
          </button>
        </div>
      </div>

      <div className="col-side col-lg-3">
        <div className="card card-pad" style={{ background: "var(--blue-light)", borderColor: "var(--blue-border)" }}>
          <div className="card-title" style={{ marginBottom: 6 }}>
            Why detail matters
          </div>
          <div style={{ fontSize: 12.5, color: "#1e40af", lineHeight: 1.5 }}>
            Structured specs (material, size, MOQ, capacity) are what power accurate buyer
            matching — the more complete your listing, the more qualified leads you receive.
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="col">
      <label className="field-label">{label}</label>
      <input className="input" type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
