import Groq from "groq-sdk";

/**
 * Fields the guided flow needs, collected in one open-ended message instead
 * of one-question-per-field. Kept as plain strings (matches how the session
 * columns and finalizeLead already store them) — this module only decides
 * *what* was said, not how it's validated downstream.
 */
export type ExtractedDetails = {
  quantity?: string;
  specification?: string;
  location?: string;
  deadline?: string;
  businessName?: string;
};

const FIELD_LABELS: Record<keyof ExtractedDetails, string> = {
  quantity: "quantity (number of units)",
  specification: "specification (color, printing, size, customization — buyer can say \"none\")",
  location: "delivery location (city or address)",
  deadline: "deadline (a date or timeframe — optional, buyer may skip it)",
  businessName: "business or company name",
};

let client: Groq | null | undefined;

function getClient(): Groq | null {
  if (client !== undefined) return client;
  const apiKey = process.env.GROQ_API_KEY;
  client = apiKey ? new Groq({ apiKey }) : null;
  return client;
}

const extractTool: Groq.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "record_requirement_details",
    description:
      "Record any of the buyer's requirement fields that are clearly stated in their message. Omit a field entirely if it wasn't mentioned — do not guess.",
    parameters: {
      type: "object",
      properties: {
        quantity: { type: "string", description: "Number of units requested, e.g. \"5000\"" },
        specification: {
          type: "string",
          description: "Color, printing, size, customization, or other requirements. Use \"None\" if the buyer explicitly said they have none.",
        },
        location: { type: "string", description: "Delivery city or address" },
        deadline: { type: "string", description: "Requested delivery date or timeframe" },
        businessName: { type: "string", description: "Buyer's business or company name" },
      },
      additionalProperties: false,
    },
  },
};

/**
 * Runs the buyer's free-text message through Groq to pull out whichever of
 * the still-missing fields it mentions. Returns an empty object (never
 * throws) if Groq isn't configured or the call fails, so the caller can
 * transparently fall back to asking one field at a time.
 */
export async function extractRequirementDetails(
  message: string,
  missingFields: (keyof ExtractedDetails)[]
): Promise<ExtractedDetails> {
  const groq = getClient();
  if (!groq || missingFields.length === 0) return {};

  const fieldList = missingFields.map((f) => `- ${FIELD_LABELS[f]}`).join("\n");

  try {
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `You extract structured order details from a buyer's message to a manufacturer's sales bot. Only extract fields explicitly present in the message — never infer or fabricate a value. Still-needed fields:\n${fieldList}`,
        },
        { role: "user", content: message },
      ],
      tools: [extractTool],
      tool_choice: { type: "function", function: { name: "record_requirement_details" } },
      temperature: 0,
      max_tokens: 300,
    });

    const call = response.choices[0]?.message?.tool_calls?.[0];
    if (!call) return {};

    const parsed = JSON.parse(call.function.arguments) as Partial<Record<keyof ExtractedDetails, unknown>>;
    const result: ExtractedDetails = {};
    for (const field of missingFields) {
      const value = parsed[field];
      if (typeof value === "string" && value.trim().length > 0) {
        result[field] = value.trim();
      }
    }
    return result;
  } catch (err) {
    console.error("extractRequirementDetails: Groq call failed", err);
    return {};
  }
}
