import { db } from "@/lib/db";
import { quotations, quotationLineItems, products, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateNumber } from "@/lib/api-helpers";
import { sendQuotationPdfToBuyer } from "./send-quotation";

/**
 * Fully automatic quotation, triggered the instant a Telegram lead is
 * created with a matched product — no manufacturer action, no LLM.
 * Pricing comes entirely from the product's own listed price range and
 * commercial terms (set once when the manufacturer created the listing),
 * the same way a printed price list would quote a walk-in customer.
 *
 * Parses whatever numeric text the buyer typed for quantity; if it can't
 * be parsed, or the product has no price set, this quietly does nothing —
 * the lead stays in the normal manual pipeline rather than sending a
 * quotation with a fabricated ₹0 price.
 */
export async function autoQuoteFromLead(leadId: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  if (!lead || !lead.matchedProductId || !lead.quantity) {
    return { generated: false, reason: "Lead has no matched product or quantity" };
  }

  const [product] = await db.select().from(products).where(eq(products.id, lead.matchedProductId));
  if (!product) {
    return { generated: false, reason: "Matched product not found" };
  }

  const quantity = parseFirstNumber(lead.quantity);
  if (quantity === null || quantity <= 0) {
    return { generated: false, reason: `Could not parse a quantity from "${lead.quantity}"` };
  }

  const rate = productRate(product.priceMin, product.priceMax);
  if (rate === null) {
    return { generated: false, reason: "Product has no price set" };
  }

  const lineItems: { description: string; quantity: number; rate: number }[] = [
    { description: product.name, quantity, rate },
  ];

  const packingRate = parseFirstNumber(product.packingCharges);
  if (packingRate !== null && packingRate > 0) {
    lineItems.push({ description: "Packing Charges", quantity, rate: packingRate });
  }

  const subtotal = round2(lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0));
  const gstPercent = 18;
  const gstAmount = round2(subtotal * (gstPercent / 100));
  const totalAmount = round2(subtotal + gstAmount);

  const [quotation] = await db
    .insert(quotations)
    .values({
      manufacturerId: lead.manufacturerId,
      leadId: lead.id,
      productId: product.id,
      quoteNumber: generateNumber("QT"),
      status: "SENT",
      subtotal: String(subtotal),
      gstPercent: String(gstPercent),
      gstAmount: String(gstAmount),
      totalAmount: String(totalAmount),
      paymentTerms: product.paymentTerms ?? "As per standard terms",
      leadTime: product.leadTime ?? undefined,
      validTill: "7 days from issue",
      notes: "This quotation was generated automatically based on our standard listed pricing.",
    })
    .returning();

  await db.insert(quotationLineItems).values(
    lineItems.map((item, index) => ({
      quotationId: quotation.id,
      description: item.description,
      quantity: String(item.quantity),
      rate: String(item.rate),
      amount: String(round2(item.quantity * item.rate)),
      sortOrder: index,
    }))
  );

  await db
    .update(leads)
    .set({ status: "QUOTED", updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  const delivery = await sendQuotationPdfToBuyer(quotation.id);

  return { generated: true, quotationId: quotation.id, delivery };
}

function parseFirstNumber(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/[\d.]+/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function productRate(priceMin: string | null, priceMax: string | null): number | null {
  const min = priceMin !== null ? Number(priceMin) : null;
  const max = priceMax !== null ? Number(priceMax) : null;
  if (min !== null && max !== null) return round2((min + max) / 2);
  if (min !== null) return min;
  if (max !== null) return max;
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
