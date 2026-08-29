"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

type Product = {
  id: string;
  name: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "INACTIVE";
  moq: string | null;
  priceMin: string | null;
  priceMax: string | null;
  coverImageUrl: string | null;
  viewCount: number;
};

const FILTERS = ["ALL", "PUBLISHED", "DRAFT", "INACTIVE"] as const;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data.products ?? []));
  }, []);

  const filtered = products?.filter((p) => filter === "ALL" || p.status === filter) ?? [];

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>My Products</h1>
          <p>Manage the products and services you list for buyers to discover.</p>
        </div>
        <Link href="/products/new" className="btn btn-primary btn-lg">
          + Add Product / Service
        </Link>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <div
            key={f}
            className={`tab${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
            style={{ cursor: "pointer" }}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            <span className="count">
              {f === "ALL" ? products?.length ?? 0 : products?.filter((p) => p.status === f).length ?? 0}
            </span>
          </div>
        ))}
      </div>

      {products === null ? (
        <div className="card card-pad">Loading products…</div>
      ) : filtered.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", padding: 48 }}>
          <div className="font-bold" style={{ marginBottom: 8 }}>
            No products{filter !== "ALL" ? ` with status ${filter.toLowerCase()}` : ""} yet
          </div>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            Add your first product to start receiving leads.
          </p>
          <Link href="/products/new" className="btn btn-primary">
            + Add Product / Service
          </Link>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-lg-2 row-cols-xl-3 g-3">
          {filtered.map((product) => (
            <div className="col" key={product.id}>
              <div className="catalogue-card">
                <img
                  src={
                    product.coverImageUrl ||
                    "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=400&h=300&fit=crop"
                  }
                  alt=""
                />
                <div className="catalogue-card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div className="font-bold" style={{ fontSize: 15 }}>
                      {product.name}
                    </div>
                    <StatusBadge status={product.status} />
                  </div>
                  <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                    {product.category}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                    <div className="text-sm">
                      <span className="text-muted">MOQ</span> <b>{product.moq || "—"}</b>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted">Price</span>{" "}
                      <b>
                        {product.priceMin || product.priceMax
                          ? `₹${product.priceMin ?? "?"}–₹${product.priceMax ?? "?"}`
                          : "Not set"}
                      </b>
                    </div>
                  </div>
                  <div className="divider" style={{ marginTop: 12, paddingTop: 12, display: "flex", gap: 20 }}>
                    <div className="text-sm">{product.viewCount} Views</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <Link href={`/products/${product.id}/edit`} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                      Edit
                    </Link>
                    <Link href={`/products/${product.id}`} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                      View
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
