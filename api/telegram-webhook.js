const { randomUUID } = require("crypto");
const { getSupabase } = require("./_lib/supabase");
const { sendError, sendJson } = require("./_lib/auth");
const { notifyTelegramAdmins, sendTelegramMessage } = require("./_lib/telegram");

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

function cleanText(text) {
  return String(text || "").trim();
}

function normalizeSurname(text) {
  return cleanText(text)
    .replace(/^\/start\s*/i, "")
    .replace(/^\/status(@\w+)?\s*/i, "")
    .replace(/[^\p{L}\s-]/gu, "")
    .trim()
    .split(/\s+/)[0] || "";
}

function helpText() {
  return [
    "Привет! Я бот Marathon Skills.",
    "",
    "Что можно спросить:",
    "• /help - помощь",
    "• /status Фамилия - найти стартовый номер и статус",
    "• дистанции - какие есть забеги",
    "• документы - что взять на старт",
    "• регистрация - как зарегистрироваться",
    "• контакты - куда обращаться",
    "",
    "Админ-команда: /admin КОД"
  ].join("\n");
}

function clientAnswer(text) {
  const lower = text.toLocaleLowerCase("ru");
  if (lower.includes("дистанц")) {
    return "Доступны дистанции: 5 км, 10 км, 21 км и 42 км. Выберите формат по уровню подготовки.";
  }
  if (lower.includes("документ") || lower.includes("справк")) {
    return "На старт возьмите удостоверение личности, телефон, воду, удобную форму и медицинскую справку, если она требуется организатором.";
  }
  if (lower.includes("регистрац")) {
    return "Регистрация проходит на сайте Marathon Skills: войдите через Google или email, заполните анкету, рассчитайте BMI и сохраните заявку.";
  }
  if (lower.includes("контакт") || lower.includes("помощ") || lower.includes("оператор")) {
    return "Напишите вопрос прямо сюда. Я сохраню обращение и передам его администратору Marathon Skills.";
  }
  if (lower.includes("старт") || lower.includes("время")) {
    return "Старт Marathon Skills проходит 15 июня. Сбор участников начинается в 09:00.";
  }
  return "";
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

async function registerAdminChat(message, code) {
  const secret = process.env.TELEGRAM_ADMIN_SECRET || "";
  const chatId = message.chat.id;

  if (!secret) {
    await sendTelegramMessage(chatId, "Админ-подписка не настроена. Добавьте TELEGRAM_ADMIN_SECRET в Vercel.");
    return;
  }

  if (!code || code !== secret) {
    await sendTelegramMessage(chatId, "Неверный код. Используйте команду: /admin КОД");
    return;
  }

  const supabase = getSupabase();
  const from = message.from || {};
  const title = message.chat.title || [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "Admin";

  const { error } = await supabase
    .from("telegram_admin_chats")
    .upsert({
      chat_id: String(chatId),
      title,
      username: from.username || "",
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "chat_id" });

  if (error) throw error;
  await sendTelegramMessage(chatId, "Готово. Этот чат теперь получает админ-уведомления Marathon Skills.");
}

async function disableAdminChat(message) {
  const supabase = getSupabase();
  const chatId = String(message.chat.id);
  await supabase
    .from("telegram_admin_chats")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);
  await sendTelegramMessage(chatId, "Админ-уведомления для этого чата отключены.");
}

async function saveSupportMessage(message, text) {
  const supabase = getSupabase();
  const from = message.from || {};
  const row = {
    id: randomUUID(),
    chat_id: String(message.chat.id),
    username: from.username || "",
    first_name: from.first_name || "",
    last_name: from.last_name || "",
    message: text,
    status: "new",
    created_at: new Date().toISOString()
  };

  await supabase.from("support_messages").insert(row);
  await notifyTelegramAdmins([
    "Marathon Skills: новое обращение в Telegram",
    `От: ${[row.first_name, row.last_name].filter(Boolean).join(" ") || row.username || row.chat_id}`,
    `Сообщение: ${text}`
  ].join("\n"));
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
    const text = cleanText(message?.text);

    if (!chatId) return sendJson(res, 200, { ok: true, ignored: true });

    if (!text || text === "/start" || text === "/help") {
      await sendTelegramMessage(chatId, helpText());
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/admin_off(@\w+)?/i.test(text)) {
      await disableAdminChat(message);
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/admin(@\w+)?/i.test(text)) {
      await registerAdminChat(message, text.replace(/^\/admin(@\w+)?\s*/i, "").trim());
      return sendJson(res, 200, { ok: true });
    }

    const directAnswer = clientAnswer(text);
    if (directAnswer) {
      await sendTelegramMessage(chatId, directAnswer);
      return sendJson(res, 200, { ok: true });
    }

    const surname = normalizeSurname(text);
    if (surname && (/^\/status(@\w+)?/i.test(text) || /^[\p{L}-]+$/u.test(text))) {
      const result = await findRunnerValue(surname);
      const answer = result
        ? `Фамилия ${result.surname} → значение: ${result.value}`
        : `Фамилия «${surname}» не найдена в базе`;

      await sendTelegramMessage(chatId, answer);
      return sendJson(res, 200, { ok: true });
    }

    await saveSupportMessage(message, text);
    await sendTelegramMessage(chatId, "Спасибо, вопрос передан администратору. Ответ придет в этот чат.");
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
};
