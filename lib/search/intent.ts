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
      "Extract what the buyer is searching for, from this message plus the conversation so far. Pass null for anything not mentioned yet — never guess or invent a value.",
    parameters: {
      type: "object",
      properties: {
        product: {
          type: ["string", "null"],
          description: "The product or service being searched for, in the buyer's own words (e.g. \"corrugated boxes\", \"packaging\"). Null if not yet clear.",
        },
        category: {
          type: ["string", "null"],
          description: "A general product category if inferable (e.g. \"Packaging Materials\"). Null if unclear.",
        },
        quantity: { type: ["string", "null"], description: "Number of units mentioned, e.g. \"5000\". Null if not mentioned." },
        location: { type: ["string", "null"], description: "A delivery city/region mentioned, e.g. \"Delhi\". Null if not mentioned." },
        attributes: {
          type: ["string", "null"],
          description: "Any other distinguishing detail mentioned — size, material, color, printing, etc — as free text. Null if none.",
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
          content:
            "You extract a structured product search query from a buyer's message on a B2B sourcing platform. You do not know what products exist — you only extract what the buyer is asking for. Never invent or assume a value that wasn't stated.",
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
