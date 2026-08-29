# MOQ Pool — Manufacturer SaaS MVP

A working Next.js MVP for the manufacturer side of MOQ Pool: Dashboard, Products/Services,
Leads, Quotations, Invoices, Reports, and Company Profile — backed by a real Neon Postgres
database. No auth: there is exactly one hardcoded manufacturer, seeded once.

The UI is a direct functional port of the static HTML screens in `MoqPool/manufacturer/`,
reusing that project's own design system CSS (`public/css/`).

A Telegram bot (`scripts/telegram-bot.ts`) stands in for the eventual WhatsApp integration: a
buyer picks a product and answers a fixed sequence of questions, which auto-generates a priced
quotation and delivers it as a PDF — no LLM anywhere in this MVP.

## Stack

- Next.js (App Router, Route Handlers)
- Drizzle ORM + `@neondatabase/serverless` (HTTP driver, works well with Neon's pooled connection)
- Zod for request validation
- `pdf-lib` for quotation PDFs (template-based, no LLM)
- Telegram Bot API via long polling (`node-fetch`, no bot framework)
- No auth, no state management library — plain `fetch` + `useState` in client components

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Neon connection string:
   ```
   DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate and apply the schema (uses a plain migration, not the interactive `drizzle-kit push`,
   since that command needs a TTY that isn't always available):
   ```bash
   npm run db:generate   # writes SQL into ./drizzle — only needed after changing lib/db/schema.ts
   npm run db:migrate     # applies pending migrations to your Neon database
   ```
4. Seed the one demo manufacturer (skips if a manufacturer already exists):
   ```bash
   npm run db:seed
   ```
5. Run the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — it redirects to `/dashboard`.
6. (Optional) Run the Telegram bot to test the buyer-side flow. Add `TELEGRAM_BOT_TOKEN`
   (from [@BotFather](https://t.me/BotFather)) and `APP_URL` (defaults to
   `http://localhost:3000`) to `.env.local`, then:
   ```bash
   npm run telegram:bot
   ```
   Only run **one** instance at a time — Telegram's `getUpdates` rejects a second concurrent
   poller with a `Conflict` error.

Other scripts: `npm run db:studio` opens Drizzle Studio against your Neon DB for browsing/editing
rows directly.

## Data model

One manufacturer row (`manufacturers`) that every other table references by `manufacturerId`.
`lib/manufacturer.ts` resolves "the current manufacturer" by just taking the first row — swap that
one function for real auth later without touching anything else.

- **products** — listings (draft/published/inactive), specs, pricing, `viewCount` (incremented on
  every `GET /api/products/:id`)
- **leads** — see "Lead ingestion" below
- **quotations** + **quotationLineItems** — a quotation belongs to a lead, has line items and
  computed subtotal/GST/total
- **invoices** + **payments** — an invoice is generated 1:1 from an accepted quotation; payments
  are recorded against it and roll up into `amountPaid` / `status`

## Lead ingestion — designed for a future WhatsApp bot + LLM

This was the main design constraint: leads need to work today (manual entry, while nothing else
is connected) but the endpoint shape has to already fit a future pipeline where a WhatsApp bot
and an LLM extraction step exist.

**`POST /api/leads/inbound`** — the single entry point for every new lead, regardless of source:

```json
{ "source": "WHATSAPP", "fromPhone": "+91...", "rawMessage": "Need 5000 boxes..." }
```

A future WhatsApp bot calls this the instant a message arrives, with nothing but the raw text.
The lead is created immediately (`status: "NEW"`) with every structured field left `null` — nothing
is lost even before any AI extraction runs.

**`PATCH /api/leads/:id/extract`** — the future LLM extraction step calls this once it has parsed
the raw message into structured fields:

```json
{ "productText": "Corrugated Boxes", "quantity": "5,000 units", "location": "Kochi", "deadline": "15 September" }
```

Kept separate from the general lead PATCH so "AI just extracted this" is a distinct write path
from a human editing the lead in the dashboard.

**Manual entry today**: the "+ Add Lead Manually" button on `/leads` calls the *same*
`POST /api/leads/inbound` endpoint with `source: "MANUAL"` and the structured fields filled in
directly (a human is typing them in, so there's no need for a separate extraction step) — this
exercises the exact endpoint the bot will use later, end to end, before either the bot or the LLM
exist.

**`GET/PATCH /api/leads/:id`** — normal CRUD for the dashboard UI: status changes
(New → Contacted → Interested → Quoted → Won/Lost), notes, manual corrections.

## Telegram bot — guided flow + fully automatic quotation

No LLM: the buyer answers one fixed question at a time via `lib/telegram/conversation.ts`,
tracked per-chat in the `telegram_sessions` table (survives a bot restart, unlike an in-memory
map). Sequence: pick a published product (inline buttons) → quantity → specification/
customization (free text) → delivery location → deadline (skippable) → business name → phone
(via Telegram's native "Share Contact" button, not typed).

Once every field is collected, the bot calls `POST /api/leads/inbound` with `source: "TELEGRAM"`
— the same endpoint a real WhatsApp bot would call later. If that call fails (network blip,
server restart), the session stays at step `DONE` and silently retries on the buyer's next
message instead of losing their answers.

**The quotation itself is generated automatically, with no manufacturer involved**
(`lib/pdf/auto-quote.ts`): the moment a Telegram lead has a matched product and a parseable
quantity, it computes a rate from that product's own `priceMin`/`priceMax` (average of the two,
or whichever one is set), creates the quotation with `status: "SENT"` directly, and calls
`lib/pdf/send-quotation.ts` to render a PDF (`lib/pdf/quotation-pdf.ts`, pure template — every
value comes from the DB row, nothing is generated by a model) and deliver it via Telegram's
`sendDocument`. If the product has no price set or the quantity can't be parsed, this quietly
does nothing and the lead falls back to the normal manual pipeline below.

The manufacturer's own "Send Quotation" button (on `/quotations/:id`, for quotations created
manually from the dashboard) triggers the same PDF-generation-and-delivery step when the status
changes to `SENT` — see `app/api/quotations/[id]/route.ts`.

## Quotation → Invoice flow (manual path)

1. From a lead's detail page, "Create Quotation" opens `/quotations/new?leadId=...`, prefilled
   from the lead's structured requirement.
2. `POST /api/quotations` computes subtotal/GST/total from line items and creates the quotation
   (status `DRAFT`). Creating a quotation advances the lead to `QUOTED` — unless the lead is
   already `WON` or `LOST`, in which case its status is left alone.
3. On the quotation detail page, `PATCH /api/quotations/:id` drives the status machine:
   `DRAFT → SENT → ACCEPTED | DECLINED | REVISION_REQUESTED`. Accepting moves the lead to `WON`;
   declining moves it to `LOST`.
4. Once `ACCEPTED`, "Generate Invoice" calls `POST /api/invoices`, which copies the quotation's
   totals onto a new invoice, splitting GST evenly into CGST/SGST (India intra-state convention).
5. "Record Payment" on the invoice detail page calls `POST /api/invoices/:id/payments`, which
   inserts a payment row and recomputes `amountPaid` + `status` (`UNPAID` → `PARTIALLY_PAID` →
   `PAID`).

## What's intentionally not built

Per the MVP scope this was built against: no full CRM automation, no AI Sales Agent, no LLM
anywhere (the Telegram flow is entirely button/template-driven), no WhatsApp integration (only
the *shape* of the future inbound webhook, exercised end-to-end via Telegram instead), no real
GST compliance engine, no multi-tenant auth. All of that is future phase work — this MVP's job
is to prove the core loop (list products → receive leads → quote → invoice → get paid) with
real persistence.
