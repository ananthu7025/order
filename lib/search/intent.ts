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
            "ONLY the product/item noun itself, plus a directly-attached descriptive word if any (e.g. \"corrugated boxes\", \"printed boxes\", \"packing boxes\", \"paper bags\"). Never include why or how the buyer will use it — strip out use-case/context phrases like \"for my honey business\", \"to pack my products\", \"for shipping\", \"for ecommerce\", \"for food\" entirely; those describe the buyer's business, not the product, and must not appear here even attached with \"for\"/\"to\". Keep it general, not a specific catalog product name — you don't know what products exist in the catalog. Null if the buyer named no product at all (a bare use-case like \"something for my business\" or \"I need something to pack my products\" is NOT a product — leave this null and let category stay null too, so the bot asks a clarifying question instead of guessing).",
        },
        category: {
          type: ["string", "null"],
          description:
            "A general product category if inferable from context, e.g. \"Packaging Materials\" for any mention of boxes, cartons, bags, or packing/shipping materials. This is a broad classification, not a specific product — null if genuinely unclear. Do not set this from use-case language alone (e.g. \"I need something for my honey business\" does not imply a category — leave both product and category null).",
        },
        quantity: { type: ["string", "null"], description: "Number of units mentioned, e.g. \"5000\". Null if not mentioned." },
        location: { type: ["string", "null"], description: "A delivery city/region mentioned, e.g. \"Delhi\". Null if not mentioned." },
        attributes: {
          type: ["string", "null"],
          description:
            "ONLY actual product characteristics the buyer explicitly stated — size, material, color, printing, ply count, etc. Never put use-case/context language here either (\"for my honey business\", \"to pack my products\", \"for ecommerce\", \"for food\", \"for my business\" are all use-case, not attributes — leave this null for those, do not paraphrase them into an attribute string). Never invent a size, material, ply count, or MOQ that wasn't said. Null if the buyer gave no actual product characteristic.",
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

Every buyer message can contain up to three DIFFERENT kinds of information — keep them separate:
1. PRODUCT REQUIREMENT — what the buyer wants (e.g. "bags", "boxes", "corrugated boxes", "paper bags"). This goes in "product"/"category".
2. PRODUCT ATTRIBUTES — actual characteristics of that product the buyer stated (size, material, color, printing, ply count — e.g. "12x10x8 inches", "brown", "5 ply"). This goes in "attributes".
3. USE-CASE / CONTEXT — why or how the buyer will use it (e.g. "to pack my honey", "for my food business", "for shipping my products", "for ecommerce", "to package cosmetics", "for my business"). This is NEVER part of "product", NEVER part of "attributes", and has no field of its own — just drop it entirely. It is background, not a search requirement.

Example: "I am looking for bags to pack my honey related product" -> product: "bags" (NOT "bags to pack my honey related product", NOT "bags for honey"), attributes: null (NOT "for honey related product"). The honey/product-related wording is pure use-case and must not survive into product OR attributes.

Example: "I need boxes for my ecommerce business" -> product: "boxes" (NOT "boxes for ecommerce" / "boxes for business").

The rule for ambiguity: if the buyer only describes a use-case with no explicit product noun at all (e.g. "I need something for my honey business", "I need something to pack my products", "what do you sell"), that is NOT enough to infer a product — return product: null AND category: null so the app can ask a clarifying question, rather than guessing a product from the use-case alone.

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
