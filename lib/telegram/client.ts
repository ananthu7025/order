const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set. Add it to .env.local.");
  }
  return token;
}

async function callTelegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getBotToken();
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${data.description ?? "unknown error"}`);
  }
  return data.result as T;
}

export type InlineKeyboardButton = { text: string; callback_data: string };

export function inlineKeyboard(rows: InlineKeyboardButton[][]) {
  return { inline_keyboard: rows };
}

export function replyKeyboard(rows: { text: string; request_contact?: boolean }[][]) {
  return { keyboard: rows, one_time_keyboard: true, resize_keyboard: true };
}

export function removeKeyboard() {
  return { remove_keyboard: true } as const;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: {
    reply_markup?: ReturnType<typeof inlineKeyboard> | ReturnType<typeof replyKeyboard> | ReturnType<typeof removeKeyboard>;
  }
) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

/**
 * Sends a binary file (e.g. a generated quotation PDF) to a chat. Uses
 * multipart/form-data since Telegram's sendDocument doesn't accept a plain
 * JSON body for the file payload, unlike every other method here.
 */
export async function sendDocument(
  chatId: string | number,
  file: Uint8Array,
  filename: string,
  caption?: string
) {
  const token = getBotToken();
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  const buffer = new Uint8Array(file).buffer as ArrayBuffer;
  form.append("document", new Blob([buffer], { type: "application/pdf" }), filename);

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (sendDocument): ${data.description ?? "unknown error"}`);
  }
  return data.result;
}

export type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    contact?: { phone_number: string };
    from?: { username?: string; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
    from?: { username?: string; first_name?: string };
  };
};

export async function getUpdates(offset: number): Promise<TelegramUpdate[]> {
  return callTelegramApi<TelegramUpdate[]>("getUpdates", {
    offset,
    timeout: 30,
    allowed_updates: ["message", "callback_query"],
  });
}
