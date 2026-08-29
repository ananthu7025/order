import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ---------------------------------------------------------------------------
// Manufacturer — single hardcoded row for this MVP (no auth). Seeded once via
// lib/db/seed.ts. Every other table references manufacturerId so a real
// multi-tenant/auth layer can be dropped in later without a schema rewrite.
// ---------------------------------------------------------------------------
export const manufacturers = pgTable("manufacturers", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  companyName: text("company_name").notNull(),
  businessType: text("business_type").notNull().default("Manufacturer"),
  aboutCompany: text("about_company"),
  yearEstablished: text("year_established"),
  gstin: text("gstin"),
  website: text("website"),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  businessLocation: text("business_location"),
  manufacturingLocations: text("manufacturing_locations"),
  logoUrl: text("logo_url"),
  categories: text("categories").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productStatusEnum = pgEnum("product_status", [
  "DRAFT",
  "PUBLISHED",
  "INACTIVE",
]);

export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  manufacturerId: text("manufacturer_id")
    .notNull()
    .references(() => manufacturers.id),

  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  status: productStatusEnum("status").notNull().default("DRAFT"),

  // Specifications (flexible, category-dependent — kept as plain strings for MVP)
  material: text("material"),
  size: text("size"),
  gsmOrThickness: text("gsm_or_thickness"),
  color: text("color"),
  weight: text("weight"),
  capacity: text("capacity"),
  customization: text("customization"),
  otherSpecs: text("other_specs"),

  // Commercial
  moq: text("moq"),
  priceMin: numeric("price_min", { precision: 12, scale: 2 }),
  priceMax: numeric("price_max", { precision: 12, scale: 2 }),
  packingCharges: text("packing_charges"),
  shippingCharges: text("shipping_charges"),
  otherCharges: text("other_charges"),
  paymentTerms: text("payment_terms"),

  // Production / delivery
  leadTime: text("lead_time"),
  availableCapacity: text("available_capacity"),
  deliveryLocations: text("delivery_locations"),
  customManufacturing: boolean("custom_manufacturing").notNull().default(false),

  coverImageUrl: text("cover_image_url"),
  images: text("images").array().notNull().default([]),
  documents: text("documents").array().notNull().default([]),

  viewCount: integer("view_count").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leadSourceEnum = pgEnum("lead_source", [
  "WHATSAPP",
  "TELEGRAM",
  "WEBSITE",
  "MANUAL",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "QUOTED",
  "WON",
  "LOST",
]);

// Two-step ingestion so a future WhatsApp bot + LLM pipeline can:
//   1. POST /api/leads/inbound the instant a message arrives (rawMessage only)
//   2. PATCH /api/leads/:id/extract once the LLM has parsed structured fields
export const leads = pgTable("leads", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  manufacturerId: text("manufacturer_id")
    .notNull()
    .references(() => manufacturers.id),

  source: leadSourceEnum("source").notNull(),
  status: leadStatusEnum("status").notNull().default("NEW"),

  // Raw inbound data (always present)
  fromPhone: text("from_phone"),
  rawMessage: text("raw_message"),
  // Telegram chat id (distinct from fromPhone) — needed to send messages
  // and documents back to the buyer after the guided-flow session row is
  // deleted. Only set when source = TELEGRAM.
  telegramChatId: text("telegram_chat_id"),

  // Structured fields (nullable until the extraction step runs)
  buyerName: text("buyer_name"),
  businessName: text("business_name"),
  productText: text("product_text"),
  matchedProductId: text("matched_product_id").references(() => products.id),
  quantity: text("quantity"),
  specification: text("specification"),
  location: text("location"),
  deadline: text("deadline"),

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quotationStatusEnum = pgEnum("quotation_status", [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REVISION_REQUESTED",
  "DECLINED",
]);

export const quotations = pgTable("quotations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  manufacturerId: text("manufacturer_id")
    .notNull()
    .references(() => manufacturers.id),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  productId: text("product_id").references(() => products.id),

  quoteNumber: text("quote_number").notNull().unique(),
  status: quotationStatusEnum("status").notNull().default("DRAFT"),

  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }).notNull().default("18"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),

  paymentTerms: text("payment_terms"),
  leadTime: text("lead_time"),
  validTill: text("valid_till"),
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quotationLineItems = pgTable("quotation_line_items", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  quotationId: text("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),

  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
]);

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  manufacturerId: text("manufacturer_id")
    .notNull()
    .references(() => manufacturers.id),
  quotationId: text("quotation_id")
    .notNull()
    .references(() => quotations.id)
    .unique(),

  invoiceNumber: text("invoice_number").notNull().unique(),
  status: invoiceStatusEnum("status").notNull().default("UNPAID"),

  billToName: text("bill_to_name").notNull(),
  billToAddress: text("bill_to_address"),
  billToPhone: text("bill_to_phone"),

  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),

  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  dueAt: timestamp("due_at"),
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method"),
  note: text("note"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const manufacturersRelations = relations(manufacturers, ({ many }) => ({
  products: many(products),
  leads: many(leads),
  quotations: many(quotations),
  invoices: many(invoices),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [products.manufacturerId],
    references: [manufacturers.id],
  }),
  leads: many(leads),
  quotations: many(quotations),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [leads.manufacturerId],
    references: [manufacturers.id],
  }),
  matchedProduct: one(products, {
    fields: [leads.matchedProductId],
    references: [products.id],
  }),
  quotations: many(quotations),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [quotations.manufacturerId],
    references: [manufacturers.id],
  }),
  lead: one(leads, {
    fields: [quotations.leadId],
    references: [leads.id],
  }),
  product: one(products, {
    fields: [quotations.productId],
    references: [products.id],
  }),
  lineItems: many(quotationLineItems),
  invoice: one(invoices, {
    fields: [quotations.id],
    references: [invoices.quotationId],
  }),
}));

export const quotationLineItemsRelations = relations(quotationLineItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationLineItems.quotationId],
    references: [quotations.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [invoices.manufacturerId],
    references: [manufacturers.id],
  }),
  quotation: one(quotations, {
    fields: [invoices.quotationId],
    references: [quotations.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

// ---------------------------------------------------------------------------
// Telegram bot conversation state — no LLM in this MVP, so the buyer answers
// a fixed sequence of button/text prompts covering everything a manufacturer
// needs to quote without a follow-up call: product, quantity, specification/
// customization, delivery location, deadline, business name, and phone
// (collected via Telegram's native "Share Contact" button, not typed).
// This table tracks where each chat is in that sequence so a stateless
// polling loop can resume correctly, and survives a bot restart (unlike an
// in-memory Map).
// ---------------------------------------------------------------------------
export const telegramSessionStepEnum = pgEnum("telegram_session_step", [
  "AWAITING_PRODUCT",
  "AWAITING_QUANTITY",
  "AWAITING_SPECIFICATION",
  "AWAITING_LOCATION",
  "AWAITING_DEADLINE",
  "AWAITING_BUSINESS_NAME",
  "AWAITING_PHONE",
  "DONE",
]);

export const telegramSessions = pgTable("telegram_sessions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  chatId: text("chat_id").notNull().unique(),

  step: telegramSessionStepEnum("step").notNull().default("AWAITING_PRODUCT"),

  productId: text("product_id").references(() => products.id),
  quantity: text("quantity"),
  specification: text("specification"),
  location: text("location"),
  deadline: text("deadline"),
  businessName: text("business_name"),
  phone: text("phone"),

  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
