const { getSupabase, isSupabaseConfigured } = require("./supabase");

let cachedDatabaseToken = "";

async function getTelegramToken() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  if (cachedDatabaseToken) return cachedDatabaseToken;
  if (!isSupabaseConfigured()) return "";

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("admin_tasks")
    .select("updated_by")
    .eq("id", "telegram_bot_token")
    .maybeSingle();

  if (error) return "";
  cachedDatabaseToken = data?.updated_by || "";
  return cachedDatabaseToken;
}

async function storeTelegramToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return false;
  if (!isSupabaseConfigured()) {
    const error = new Error("Supabase is not configured");
    error.statusCode = 500;
    throw error;
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("admin_tasks")
    .upsert({
      id: "telegram_bot_token",
      completed: false,
      updated_by: cleanToken,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (error) throw error;
  cachedDatabaseToken = cleanToken;
  return true;
}

function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN || cachedDatabaseToken);
}

async function getAdminChats() {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  const primary = await supabase
    .from("telegram_admin_chats")
    .select("chat_id")
    .eq("enabled", true);

  if (!primary.error) return primary.data || [];

  const fallback = await supabase
    .from("admin_tasks")
    .select("id")
    .like("id", "telegram_admin_chat_%")
    .eq("completed", true);

  if (fallback.error) return [];

  return (fallback.data || []).map((row) => ({
    chat_id: String(row.id).replace("telegram_admin_chat_", "")
  }));
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const token = await getTelegramToken();
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
  const token = await getTelegramToken();
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
  const token = await getTelegramToken();
  if (!token || !isSupabaseConfigured()) return { sent: 0 };

  const chats = await getAdminChats();
  await Promise.allSettled(chats.map((chat) => sendTelegramMessage(chat.chat_id, text)));
  return { sent: chats.length };
}

module.exports = {
  callTelegramMethod,
  getAdminChats,
  getTelegramToken,
  isTelegramConfigured,
  notifyTelegramAdmins,
  sendTelegramMessage,
  storeTelegramToken
};
