const { getSupabase } = require("./_lib/supabase");
const { sendError, sendJson } = require("./_lib/auth");

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

function normalizeSurname(text) {
  return String(text || "")
    .replace(/^\/start\s*/i, "")
    .replace(/[^\p{L}\s-]/gu, "")
    .trim()
    .split(/\s+/)[0] || "";
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
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
      text
    })
  });

  if (!response.ok) {
    const error = new Error(`Telegram API returned ${response.status}`);
    error.statusCode = 502;
    throw error;
  }
}

async function findRunnerValue(surname) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("marathon_bot_lookup")
    .select("surname, value")
    .ilike("surname", surname)
    .limit(1);

  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 200, {
      ok: true,
      message: "Telegram webhook is ready. Send POST requests from Telegram."
    });
  }

  try {
    const update = await readJson(req);
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id;
    const surname = normalizeSurname(message?.text);

    if (!chatId) return sendJson(res, 200, { ok: true, ignored: true });

    if (!surname) {
      await sendTelegramMessage(chatId, "Введите фамилию участника, например: Иванов");
      return sendJson(res, 200, { ok: true });
    }

    const result = await findRunnerValue(surname);
    const answer = result
      ? `Фамилия ${result.surname} → значение: ${result.value}`
      : `Фамилия «${surname}» не найдена в базе`;

    await sendTelegramMessage(chatId, answer);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
};
