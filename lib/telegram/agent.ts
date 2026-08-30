import Groq from "groq-sdk";
import { db } from "@/lib/db";
import { products, telegramSessions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentManufacturer } from "@/lib/manufacturer";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AgentFields = {
  productId: string | null;
  quantity: string | null;
  specification: string | null;
  location: string | null;
  deadline: string | null;
  businessName: string | null;
};

export type AgentResult = {
  reply: string;
  fields: Partial<AgentFields>;
  readyForPhone: boolean;
};

let client: Groq | null | undefined;

function getClient(): Groq | null {
  if (client !== undefined) return client;
  const apiKey = process.env.GROQ_API_KEY;
  client = apiKey ? new Groq({ apiKey }) : null;
  return client;
}

const recordLeadTool: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "record_lead_details",
    description:
      "Record any requirement fields the buyer has stated so far, and whether every required field is now known. Call this on every turn, even if nothing new was said, so ready_for_phone stays accurate. Every field below accepts either a string or null — pass null (not an empty string) for anything not yet known.",
    parameters: {
      type: "object",
      properties: {
        product_id: {
          type: ["string", "null"],
          description: "The id of the catalog product the buyer's request matches, from the product list in the system prompt. Null if no confident match yet.",
        },
        quantity: { type: ["string", "null"], description: "Number of units requested, e.g. \"5000\". Null if not yet known." },
        specification: {
          type: ["string", "null"],
          description: "Color, printing, size, customization, or other requirements. Use \"None\" if the buyer said they have no special requirements. Null if not yet known.",
        },
        location: { type: ["string", "null"], description: "Delivery city or address. Null if not yet known." },
        deadline: {
          type: ["string", "null"],
          description: "Requested delivery date or timeframe. Use \"None\" if the buyer has no deadline / doesn't care. Null if not yet known.",
        },
        business_name: { type: ["string", "null"], description: "Buyer's business or company name. Null if not yet known." },
        ready_for_phone: {
          type: "boolean",
          description: "True only once product_id, quantity, specification, location, deadline, and business_name are ALL known (from this or earlier turns).",
        },
      },
      required: ["product_id", "quantity", "specification", "location", "deadline", "business_name", "ready_for_phone"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(
  companyName: string,
  catalog: { id: string; name: string; category: string; description: string | null }[]
) {
  const catalogText = catalog.length
    ? catalog
        .map((p) => `- id: ${p.id} | ${p.name} (${p.category})${p.description ? ` — ${p.description}` : ""}`)
        .join("\n")
    : "(no published products right now)";

  return `You are a friendly sales assistant for ${companyName}, a B2B manufacturer, chatting with a prospective buyer on Telegram. Your job is to have a natural conversation that ends with a complete quote request.

## What you need to collect (in any order, from natural conversation — never interrogate one field at a time like a form)
1. Which product they want — match it against this catalog:
${catalogText}
2. Quantity (number of units)
3. Specification — color, printing, size, customization, etc. ("None" is a valid answer)
4. Delivery location (city or address)
5. Deadline / timeframe ("None" is a valid answer if they have no deadline)
6. Their business or company name

## How to behave
- Greet the buyer warmly on their first message and ask what they're looking for.
- If they name something not in the catalog, say so honestly and ask if any listed product fits, or offer to pass the request to the team.
- Ask natural follow-up questions for whatever's still missing — you can ask about more than one thing at once if it flows naturally, but don't overwhelm them.
- Keep replies short (1-3 sentences), warm, and conversational — this is a chat, not a form.
- Once every field above is known (from this message or earlier ones), tell the buyer you just need their phone number next — the app will prompt them for it separately, so do not ask them to type it yourself.
- Never invent product availability, pricing, or capabilities that aren't in the catalog above.
- Respond with plain conversational text only. Never mention tools, functions, or write anything like a function call in your reply — that happens separately, outside this message.`;
}

/**
 * Runs one turn of the conversational lead-collection agent: sends the
 * running history (persisted on the session row — this route is stateless
 * serverless, so nothing survives between invocations except the DB) plus
 * the buyer's new message to Groq, lets it call record_lead_details, and
 * returns the reply text plus whatever fields it extracted.
 *
 * Never throws — a missing key or a failed Groq call degrades to a plain
 * apology message with no field updates, so a bad turn doesn't corrupt the
 * session or crash the webhook.
 */
export async function runLeadAgent(
  session: typeof telegramSessions.$inferSelect,
  userMessage: string
): Promise<AgentResult> {
  const fallback: AgentResult = {
    reply: "Sorry, I'm having trouble right now — could you try again in a moment?",
    fields: {},
    readyForPhone: false,
  };

  const groq = getClient();
  if (!groq) return fallback;

  try {
    const manufacturer = await getCurrentManufacturer();
    const catalog = await db
      .select({ id: products.id, name: products.name, category: products.category, description: products.description })
      .from(products)
      .where(and(eq(products.manufacturerId, manufacturer.id), eq(products.status, "PUBLISHED")));

    const history = session.history ?? [];
    const systemPrompt = buildSystemPrompt(manufacturer.companyName, catalog);
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    // Two separate calls rather than one tool_choice: "auto" call — Groq
    // often returns a tool-call-only response with empty text content when
    // a tool is offered alongside free-form replying, which left the buyer
    // with a generic filler message instead of a real follow-up question.
    // Asking for conversational text first (no tools declared) and then
    // forcing the extraction tool call in a second, separate request
    // guarantees both a natural reply and reliable field extraction.
    //
    // openai/gpt-oss-120b occasionally emits a tool-call-shaped response on
    // this first call even with no tools declared, which Groq's parser
    // rejects outright ("Tool choice is none, but model called a tool") —
    // tool_choice: "none" makes this explicit and, empirically, avoids it.
    let reply = "Could you tell me a bit more about what you're looking for?";
    try {
      const replyResponse = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages,
        tool_choice: "none",
        temperature: 0.5,
        max_tokens: 300,
      });
      const rawReply = replyResponse.choices[0]?.message?.content?.trim();
      // Defensive net: gpt-oss-120b occasionally appends a
      // "record_lead_details({...})"-shaped line to an otherwise fine
      // reply, even with tools undeclared and instructed against it —
      // strip anything from that marker onward before it reaches the buyer.
      const cleaned = rawReply?.split(/\/\/\s*record_lead_details|record_lead_details\s*\(/)[0]?.trim();
      reply = cleaned || rawReply || reply;
    } catch (err) {
      console.error("runLeadAgent: reply call failed, using generic follow-up", err);
    }

    const fields: Partial<AgentFields> = {};
    let readyForPhone = false;
    try {
      const extractionResponse = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [...messages, { role: "assistant", content: reply }],
        tools: [recordLeadTool],
        tool_choice: { type: "function", function: { name: "record_lead_details" } },
        temperature: 0,
        max_tokens: 300,
      });

      const call = extractionResponse.choices[0]?.message?.tool_calls?.[0];
      if (call) {
        const parsed = JSON.parse(call.function.arguments) as Record<string, unknown>;
        // Values are coerced to string defensively — the model occasionally
        // sends e.g. a bare number for quantity despite the string schema.
        const asString = (v: unknown): string | undefined => {
          if (typeof v === "string" && v.trim()) return v.trim();
          if (typeof v === "number") return String(v);
          return undefined;
        };
        const productId = asString(parsed.product_id);
        if (productId && catalog.some((p) => p.id === productId)) fields.productId = productId;
        const quantity = asString(parsed.quantity);
        if (quantity) fields.quantity = quantity;
        const specification = asString(parsed.specification);
        if (specification) fields.specification = specification;
        const location = asString(parsed.location);
        if (location) fields.location = location;
        const deadline = asString(parsed.deadline);
        if (deadline) fields.deadline = deadline;
        const businessName = asString(parsed.business_name);
        if (businessName) fields.businessName = businessName;
        readyForPhone = parsed.ready_for_phone === true;
      }
    } catch (err) {
      console.error("runLeadAgent: extraction call failed, keeping reply with no field updates", err);
    }

    return { reply, fields, readyForPhone };
  } catch (err) {
    console.error("runLeadAgent: Groq call failed", err);
    return fallback;
  }
}
