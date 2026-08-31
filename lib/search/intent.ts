import Groq from "groq-sdk";

export type SearchIntent = {
  product: string | null;
  category: string | null;
  quantity: string | null;
  location: string | null;
  attributes: string | null;
};

let client: Groq | null | undefined;

function getClient(): Groq | null {
  if (client !== undefined) return client;
  const apiKey = process.env.GROQ_API_KEY;
  client = apiKey ? new Groq({ apiKey }) : null;
  return client;
}

const parseIntentTool: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "record_search_intent",
    description:
      "Extract what the buyer is searching for, from this message plus the conversation so far. Pass null for anything not mentioned yet — never guess, infer, or invent a value that wasn't actually said.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: ["string", "null"],
          description:
            "The product or service being searched for, normalized to a short, general search phrase in plain words — e.g. buyer says \"packing boxes\", \"carton boxes\", \"boxes for shipping\", or \"corrugated boxes\" all become a short phrase built around \"box(es)\" plus whatever descriptive word they used (corrugated, shipping, packing, carton, packaging). Keep it general, not a specific product name — you don't know what products exist in the catalog. Null if not yet clear what they want.",
        },
        category: {
          type: ["string", "null"],
          description:
            "A general product category if inferable from context, e.g. \"Packaging Materials\" for any mention of boxes, cartons, bags, or packing/shipping materials. This is a broad classification, not a specific product — null if genuinely unclear.",
        },
        quantity: { type: ["string", "null"], description: "Number of units mentioned, e.g. \"5000\". Null if not mentioned." },
        location: { type: ["string", "null"], description: "A delivery city/region mentioned, e.g. \"Delhi\". Null if not mentioned." },
        attributes: {
          type: ["string", "null"],
          description:
            "Any other distinguishing detail the buyer ACTUALLY STATED — size, material, color, printing, ply count, etc — as free text. Only include details explicitly mentioned in the conversation. Never invent a size, material, ply count, or MOQ that wasn't said, even if it would be typical for this kind of product. Null if the buyer gave no such detail.",
        },
      },
      required: ["product", "category", "quantity", "location", "attributes"],
      additionalProperties: false,
    },
  },
};

/**
 * Turns the buyer's free-text message (plus recent conversation) into a
 * structured search query. This is the ONLY thing the LLM is allowed to do
 * before a search runs — it never sees or invents actual product data here,
 * it only decides what the buyer is asking for. Returns nulls across the
 * board (a no-op search) if Groq isn't configured or the call fails, so a
 * bad turn degrades to "no intent extracted" rather than crashing.
 */
export async function parseSearchIntent(
  message: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<SearchIntent> {
  const empty: SearchIntent = { product: null, category: null, quantity: null, location: null, attributes: null };

  const groq = getClient();
  if (!groq) return empty;

  try {
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `You extract a structured product search query from a buyer's message on a B2B sourcing platform. You do not know what products exist in the catalog — you only extract what the buyer actually said they want.

Buyers describe the same thing many different ways — treat these as equivalent when normalizing "product":
- "packing boxes", "packaging boxes", "carton boxes", "shipping boxes", "corrugated boxes", "boxes for shipping", "boxes for packaging" all describe box-type packaging; extract the general phrase they used, do not narrow it to one specific product name.

Rules:
- Never invent or assume a value that wasn't stated — especially specific attributes like size, ply count, material, color, or MOQ. A generic message like "I need packing boxes" must NOT produce invented attributes such as "5 ply" or "12x10x8 inches".
- A greeting ("hello", "hi") or a message with no product mentioned at all ("I need something", "can you help me") must return product: null, category: null — do not guess a product just because the buyer is clearly starting a shopping conversation.
- category is a broad classification (e.g. "Packaging Materials"), never a specific product name.`,
        },
        ...history,
        { role: "user", content: message },
      ],
      tools: [parseIntentTool],
      tool_choice: { type: "function", function: { name: "record_search_intent" } },
      temperature: 0,
      max_tokens: 300,
    });

    const call = response.choices[0]?.message?.tool_calls?.[0];
    if (!call) return empty;

    const parsed = JSON.parse(call.function.arguments) as Record<string, unknown>;
    const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

    return {
      product: asString(parsed.product),
      category: asString(parsed.category),
      quantity: asString(parsed.quantity),
      location: asString(parsed.location),
      attributes: asString(parsed.attributes),
    };
  } catch (err) {
    console.error("parseSearchIntent: Groq call failed", err);
    return empty;
  }
}
