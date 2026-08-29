"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "INACTIVE";
  description: string | null;
  material: string | null;
  size: string | null;
  gsmOrThickness: string | null;
  color: string | null;
  weight: string | null;
  moq: string | null;
  priceMin: string | null;
  priceMax: string | null;
  packingCharges: string | null;
  shippingCharges: string | null;
  paymentTerms: string | null;
  leadTime: string | null;
  availableCapacity: string | null;
  deliveryLocations: string | null;
  coverImageUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((res) => res.json())
      .then((data) => setProduct(data.product));
  }, [id]);

  if (!product) {
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
        <Link href="/products">Products / Services</Link>
        <span className="sep">&gt;</span>
        <span className="current">{product.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>
            {product.name} <StatusBadge status={product.status} />
          </h1>
          <p>
            {product.category} • Listed on {formatDate(product.createdAt)}
          </p>
        </div>
        <Link href={`/products/${product.id}/edit`} className="btn btn-primary btn-lg">
          Edit Listing
        </Link>
      </div>

      <div className="row row-cols-2 g-3 stat-grid-row">
        <div className="col">
          <div className="stat-card">
            <div className="stat-body">
              <div className="stat-label">Views</div>
              <div className="stat-value">{product.viewCount}</div>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="stat-card">
            <div className="stat-body">
              <div className="stat-label">MOQ</div>
              <div className="stat-value">{product.moq || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-main col-lg-8">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 10 }}>
              Description
            </div>
            <p className="text-sm" style={{ color: "var(--ink-700)", lineHeight: 1.7 }}>
              {product.description || "No description provided."}
            </p>
          </div>

          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 16 }}>
              Specifications
            </div>
            <div className="row row-cols-1 row-cols-md-2 g-3">
              <SpecRow label="Material" value={product.material} />
              <SpecRow label="Size / Dimensions" value={product.size} />
              <SpecRow label="GSM / Thickness" value={product.gsmOrThickness} />
              <SpecRow label="Color" value={product.color} />
              <SpecRow label="Weight" value={product.weight} />
            </div>
          </div>

          <div className="row row-cols-1 row-cols-md-2 g-3">
            <div className="col">
              <div className="card card-pad" style={{ height: "100%" }}>
                <div className="card-title" style={{ marginBottom: 16 }}>
                  Commercial Information
                </div>
                <SpecRow label="MOQ" value={product.moq} />
                <SpecRow
                  label="Price Range"
                  value={
                    product.priceMin || product.priceMax
                      ? `₹${product.priceMin ?? "?"} – ₹${product.priceMax ?? "?"}`
                      : null
                  }
                />
                <SpecRow label="Packing Charges" value={product.packingCharges} />
                <SpecRow label="Shipping Charges" value={product.shippingCharges} />
                <SpecRow label="Payment Terms" value={product.paymentTerms} />
              </div>
            </div>
            <div className="col">
              <div className="card card-pad" style={{ height: "100%" }}>
                <div className="card-title" style={{ marginBottom: 16 }}>
                  Production &amp; Delivery
                </div>
                <SpecRow label="Lead Time" value={product.leadTime} />
                <SpecRow label="Available Capacity" value={product.availableCapacity} />
                <SpecRow label="Delivery Locations" value={product.deliveryLocations} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-side col-lg-4">
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>
              Listing Status
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="text-sm text-muted">Status</span>
              <StatusBadge status={product.status} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Category</span>
              <span className="font-bold text-sm">{product.category}</span>
            </div>
            <div className="divider" style={{ marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Listed On</span>
              <span className="font-bold text-sm">{formatDate(product.createdAt)}</span>
            </div>
            <div className="divider" style={{ marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span className="text-sm text-muted">Last Updated</span>
              <span className="font-bold text-sm">{formatDate(product.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="col" style={{ display: "flex", justifyContent: "space-between", maxWidth: 420, marginBottom: 12 }}>
      <span className="text-sm text-muted">{label}</span>
      <span className="font-bold text-sm">{value || "—"}</span>
    </div>
  );
}
