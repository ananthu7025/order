import { AppShell } from "@/components/AppShell";
import { ProductForm } from "@/components/ProductForm";

export default function NewProductPage() {
  return (
    <AppShell>
      <div className="breadcrumb">
        <span>Home</span>
        <span className="sep">&gt;</span>
        <span>Products / Services</span>
        <span className="sep">&gt;</span>
        <span className="current">Add Product / Service</span>
      </div>

      <div className="page-header">
        <div>
          <h1>Add Product / Service</h1>
          <p>Structured, detailed listings help buyers and future AI matching find you faster.</p>
        </div>
      </div>

      <ProductForm />
    </AppShell>
  );
}
