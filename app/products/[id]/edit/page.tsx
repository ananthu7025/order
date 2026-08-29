"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProductForm, ProductFormValues } from "@/components/ProductForm";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [values, setValues] = useState<Partial<ProductFormValues> | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((res) => res.json())
      .then((data) => {
        const p = data.product;
        setValues({
          name: p.name ?? "",
          category: p.category ?? "Packaging Materials",
          description: p.description ?? "",
          material: p.material ?? "",
          size: p.size ?? "",
          gsmOrThickness: p.gsmOrThickness ?? "",
          color: p.color ?? "",
          weight: p.weight ?? "",
          capacity: p.capacity ?? "",
          customization: p.customization ?? "",
          otherSpecs: p.otherSpecs ?? "",
          moq: p.moq ?? "",
          priceMin: p.priceMin ?? "",
          priceMax: p.priceMax ?? "",
          packingCharges: p.packingCharges ?? "",
          shippingCharges: p.shippingCharges ?? "",
          otherCharges: p.otherCharges ?? "",
          paymentTerms: p.paymentTerms ?? "",
          leadTime: p.leadTime ?? "",
          availableCapacity: p.availableCapacity ?? "",
          deliveryLocations: p.deliveryLocations ?? "",
          customManufacturing: p.customManufacturing ?? false,
        });
      });
  }, [id]);

  return (
    <AppShell>
      <div className="breadcrumb">
        <span>Home</span>
        <span className="sep">&gt;</span>
        <span>Products / Services</span>
        <span className="sep">&gt;</span>
        <span className="current">Edit Product</span>
      </div>

      <div className="page-header">
        <div>
          <h1>Edit Product / Service</h1>
        </div>
      </div>

      {values ? <ProductForm productId={id} initialValues={values} /> : <div className="card card-pad">Loading…</div>}
    </AppShell>
  );
}
