import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type QuotationPdfData = {
  quoteNumber: string;
  manufacturerName: string;
  manufacturerGstin: string | null;
  manufacturerAddress: string | null;
  buyerName: string;
  buyerLocation: string | null;
  buyerPhone: string | null;
  lineItems: { description: string; quantity: string; rate: string; amount: string }[];
  subtotal: string;
  gstPercent: string;
  gstAmount: string;
  totalAmount: string;
  paymentTerms: string | null;
  leadTime: string | null;
  validTill: string | null;
  notes: string | null;
  issuedAt: Date;
};

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

/**
 * Deterministic, template-based quotation PDF — no LLM involved. Every
 * value here comes straight from the quotation/lead/manufacturer rows
 * already in the database; this function only lays them out on a page.
 */
export async function generateQuotationPdf(data: QuotationPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  function text(
    str: string,
    x: number,
    yPos: number,
    opts?: { size?: number; font?: typeof font; color?: ReturnType<typeof rgb> }
  ) {
    page.drawText(str, {
      x,
      y: yPos,
      size: opts?.size ?? 10,
      font: opts?.font ?? font,
      color: opts?.color ?? rgb(0.06, 0.09, 0.16),
    });
  }

  function line(yPos: number, thickness = 1) {
    page.drawLine({
      start: { x: MARGIN, y: yPos },
      end: { x: PAGE_WIDTH - MARGIN, y: yPos },
      thickness,
      color: rgb(0.85, 0.86, 0.88),
    });
  }

  // Header
  text(data.manufacturerName, MARGIN, y, { size: 16, font: bold });
  text("QUOTATION", PAGE_WIDTH - MARGIN - 110, y, { size: 18, font: bold });
  y -= 18;
  if (data.manufacturerAddress) {
    text(data.manufacturerAddress, MARGIN, y, { size: 9, color: rgb(0.4, 0.42, 0.46) });
  }
  text(data.quoteNumber, PAGE_WIDTH - MARGIN - 110, y, { size: 10, color: rgb(0.4, 0.42, 0.46) });
  y -= 12;
  if (data.manufacturerGstin) {
    text(`GSTIN: ${data.manufacturerGstin}`, MARGIN, y, { size: 9, color: rgb(0.4, 0.42, 0.46) });
  }
  text(
    `Issued: ${data.issuedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    PAGE_WIDTH - MARGIN - 110,
    y,
    { size: 9, color: rgb(0.4, 0.42, 0.46) }
  );

  y -= 24;
  line(y, 1.5);
  y -= 26;

  // Bill to
  text("QUOTED TO", MARGIN, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
  y -= 14;
  text(data.buyerName, MARGIN, y, { size: 11, font: bold });
  y -= 14;
  if (data.buyerLocation) {
    text(data.buyerLocation, MARGIN, y, { size: 9.5, color: rgb(0.3, 0.32, 0.36) });
    y -= 12;
  }
  if (data.buyerPhone) {
    text(data.buyerPhone, MARGIN, y, { size: 9.5, color: rgb(0.3, 0.32, 0.36) });
    y -= 12;
  }

  y -= 16;

  // Line items table header
  const col = { desc: MARGIN, qty: 330, rate: 400, amount: 470 };
  text("DESCRIPTION", col.desc, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
  text("QTY", col.qty, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
  text("RATE (Rs.)", col.rate, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
  text("AMOUNT (Rs.)", col.amount, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
  y -= 8;
  line(y);
  y -= 18;

  for (const item of data.lineItems) {
    text(item.description, col.desc, y, { size: 10 });
    text(item.quantity, col.qty, y, { size: 10 });
    text(item.rate, col.rate, y, { size: 10 });
    text(item.amount, col.amount, y, { size: 10, font: bold });
    y -= 20;
  }

  y -= 4;
  line(y);
  y -= 22;

  // Totals
  function totalRow(label: string, value: string, opts?: { bold?: boolean; size?: number }) {
    text(label, 380, y, { size: opts?.size ?? 10, color: opts?.bold ? undefined : rgb(0.4, 0.42, 0.46) });
    text(`Rs. ${value}`, col.amount, y, { size: opts?.size ?? 10, font: opts?.bold ? bold : font });
    y -= 18;
  }

  totalRow("Subtotal", data.subtotal);
  totalRow(`GST (${data.gstPercent}%)`, data.gstAmount);
  y -= 4;
  line(y);
  y -= 20;
  totalRow("Total Amount", data.totalAmount, { bold: true, size: 12 });

  y -= 20;

  // Terms
  text("TERMS", MARGIN, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
  y -= 16;
  if (data.paymentTerms) {
    text(`Payment Terms: ${data.paymentTerms}`, MARGIN, y, { size: 9.5 });
    y -= 14;
  }
  if (data.leadTime) {
    text(`Production Lead Time: ${data.leadTime}`, MARGIN, y, { size: 9.5 });
    y -= 14;
  }
  if (data.validTill) {
    text(`Quote Valid Till: ${data.validTill}`, MARGIN, y, { size: 9.5 });
    y -= 14;
  }

  if (data.notes) {
    y -= 10;
    text("NOTES", MARGIN, y, { size: 9, font: bold, color: rgb(0.4, 0.42, 0.46) });
    y -= 16;
    text(data.notes, MARGIN, y, { size: 9.5 });
  }

  return pdfDoc.save();
}
