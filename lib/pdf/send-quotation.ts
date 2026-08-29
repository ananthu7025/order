import { db } from "@/lib/db";
import { quotations, quotationLineItems, leads, manufacturers } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { generateQuotationPdf } from "./quotation-pdf";
import { sendMessage, sendDocument } from "@/lib/telegram/client";

/**
 * Generates the quotation PDF and delivers it to the buyer, then sends a
 * short plain-language confirmation — no LLM: the PDF is a fixed template
 * filled with numbers already in the database, and the message text is a
 * fixed string, not generated.
 *
 * Currently only wired for Telegram leads (the only channel with a chat id
 * to deliver to). Leads from other sources are skipped silently — this is
 * the same seam a future WhatsApp document-send would plug into.
 */
export async function sendQuotationPdfToBuyer(quotationId: string) {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
  if (!quotation) return { sent: false, reason: "Quotation not found" };

  const [lead] = await db.select().from(leads).where(eq(leads.id, quotation.leadId));
  if (!lead) return { sent: false, reason: "Lead not found" };

  if (lead.source !== "TELEGRAM" || !lead.telegramChatId) {
    return { sent: false, reason: "Lead has no Telegram chat to deliver to" };
  }

  const [manufacturer] = await db
    .select()
    .from(manufacturers)
    .where(eq(manufacturers.id, quotation.manufacturerId));

  const lineItems = await db
    .select()
    .from(quotationLineItems)
    .where(eq(quotationLineItems.quotationId, quotationId))
    .orderBy(asc(quotationLineItems.sortOrder));

  const pdfBytes = await generateQuotationPdf({
    quoteNumber: quotation.quoteNumber,
    manufacturerName: manufacturer.companyName,
    manufacturerGstin: manufacturer.gstin,
    manufacturerAddress: manufacturer.businessLocation,
    buyerName: lead.businessName || lead.buyerName || "Valued Customer",
    buyerLocation: lead.location,
    buyerPhone: lead.fromPhone,
    lineItems: lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
    })),
    subtotal: quotation.subtotal,
    gstPercent: quotation.gstPercent,
    gstAmount: quotation.gstAmount,
    totalAmount: quotation.totalAmount,
    paymentTerms: quotation.paymentTerms,
    leadTime: quotation.leadTime,
    validTill: quotation.validTill,
    notes: quotation.notes,
    issuedAt: new Date(),
  });

  await sendMessage(
    lead.telegramChatId,
    "🎉 Thank you for your patience! Your quotation is ready — please find it attached below."
  );
  await sendDocument(lead.telegramChatId, pdfBytes, `${quotation.quoteNumber}.pdf`);

  return { sent: true };
}
