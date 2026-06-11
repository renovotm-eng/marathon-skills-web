const { getSupabase, isSupabaseConfigured } = require("./supabase");

function getTelegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function isTelegramConfigured() {
  return Boolean(getTelegramToken());
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const token = getTelegramToken();
  if (!token) {
    const error = new Error("TELEGRAM_BOT_TOKEN is not configured");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options.parseMode,
      disable_web_page_preview: true,
      reply_markup: options.replyMarkup
    })
  });

  if (!response.ok) {
    const error = new Error(`Telegram API returned ${response.status}`);
    error.statusCode = 502;
    throw error;
  }
}

async function callTelegramMethod(method, payload = {}) {
  const token = getTelegramToken();
  if (!token) {
    const error = new Error("TELEGRAM_BOT_TOKEN is not configured");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    const error = new Error(data.description || `Telegram API returned ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return data;
}

async function notifyTelegramAdmins(text) {
  if (!isTelegramConfigured() || !isSupabaseConfigured()) return { sent: 0 };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("telegram_admin_chats")
    .select("chat_id")
    .eq("enabled", true);

  if (error) throw error;

  const chats = data || [];
  await Promise.allSettled(chats.map((chat) => sendTelegramMessage(chat.chat_id, text)));
  return { sent: chats.length };
}

module.exports = {
  callTelegramMethod,
  isTelegramConfigured,
  notifyTelegramAdmins,
  sendTelegramMessage
};
