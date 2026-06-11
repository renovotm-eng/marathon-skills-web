const { randomUUID } = require("crypto");
const { getSupabase, isSupabaseConfigured } = require("./_lib/supabase");
const { sendError, sendJson } = require("./_lib/auth");
const {
  callTelegramMethod,
  isTelegramConfigured,
  notifyTelegramAdmins,
  sendTelegramMessage
} = require("./_lib/telegram");

const BOT_COMMANDS = [
  { command: "help", description: "Помощь и список команд" },
  { command: "status", description: "Проверить участника по фамилии" },
  { command: "distances", description: "Дистанции марафона" },
  { command: "documents", description: "Документы на старт" },
  { command: "contacts", description: "Связь с организатором" },
  { command: "admin", description: "Подключить админ-уведомления" },
  { command: "stats", description: "Админ: статистика" },
  { command: "events", description: "Админ: последние действия" },
  { command: "support", description: "Админ: новые обращения" }
];

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

function getQueryValue(req, name) {
  if (req.query && req.query[name] !== undefined) return String(req.query[name]);
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `https://${host}`);
  return url.searchParams.get(name) || "";
}

function localTime(value = new Date()) {
  return new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Qyzylorda" });
}

function normalizeSurname(text) {
  return cleanText(text)
    .replace(/^\/start(@\w+)?\s*/i, "")
    .replace(/^\/status(@\w+)?\s*/i, "")
    .replace(/^\/runner(@\w+)?\s*/i, "")
    .replace(/[^\p{L}\s-]/gu, "")
    .trim()
    .split(/\s+/)[0] || "";
}

function personName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "без имени";
}

function telegramName(message) {
  const from = message.from || {};
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim()
    || from.username
    || String(message.chat.id);
}

function menuKeyboard(isAdmin) {
  const rows = [
    [{ text: "/status Фамилия" }, { text: "/distances" }],
    [{ text: "/documents" }, { text: "/contacts" }]
  ];
  if (isAdmin) rows.push([{ text: "/stats" }, { text: "/events" }, { text: "/support" }]);
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function helpText(isAdmin = false) {
  const lines = [
    "Привет! Я бот Marathon Skills.",
    "",
    "Для участника:",
    "/status Фамилия - стартовый номер и статус",
    "/distances - дистанции забега",
    "/documents - что взять на старт",
    "/contacts - как связаться с организатором",
    "",
    "Если вопрос нестандартный, просто напишите его сообщением - я передам администратору."
  ];

  if (isAdmin) {
    lines.push(
      "",
      "Для администратора:",
      "/stats - сводка по базе",
      "/events - последние действия на сайте",
      "/support - новые обращения",
      "/runner Фамилия - подробная карточка участника",
      "/reply CHAT_ID текст - ответить человеку в Telegram",
      "/admin_off - отключить уведомления"
    );
  } else {
    lines.push("", "Админ-подписка: /admin КОД");
  }

  return lines.join("\n");
}

function clientAnswer(text) {
  const lower = text.toLocaleLowerCase("ru");

  if (/^\/distances(@\w+)?$/i.test(text) || lower.includes("дистанц")) {
    return [
      "Дистанции Marathon Skills:",
      "5 км - легкий старт для новичков",
      "10 км - уверенный городской забег",
      "21 км - полумарафон",
      "42 км - полный марафон",
      "",
      "В личном кабинете можно выбрать дистанцию и сохранить заявку."
    ].join("\n");
  }

  if (/^\/documents(@\w+)?$/i.test(text) || lower.includes("документ") || lower.includes("справк")) {
    return [
      "На старт возьмите:",
      "паспорт или удостоверение личности",
      "телефон",
      "удобную форму и обувь",
      "воду",
      "медицинскую справку, если ее требует организатор"
    ].join("\n");
  }

  if (lower.includes("регистрац") || lower.includes("заявк")) {
    return "Регистрация проходит на сайте Marathon Skills: войдите через Google или email, заполните анкету, рассчитайте BMI и сохраните заявку.";
  }

  if (/^\/contacts(@\w+)?$/i.test(text) || lower.includes("контакт") || lower.includes("помощ") || lower.includes("оператор")) {
    return "Напишите вопрос прямо сюда. Я сохраню обращение и передам его администратору Marathon Skills.";
  }

  if (lower.includes("старт") || lower.includes("время") || lower.includes("год")) {
    return "Marathon Skills проводится в 2026 году. Сбор участников начинается в 09:00, стартовые пакеты выдаются заранее через кабинет администратора.";
  }

  if (lower.includes("bmi") || lower.includes("имт") || lower.includes("рост") || lower.includes("вес")) {
    return "BMI рассчитывается на сайте по формуле: вес / рост². После расчета сайт показывает категорию состояния тела и сохраняет результат в заявке.";
  }

  if (/^(привет|здравствуй|здравствуйте|начать)$/iu.test(lower)) {
    return helpText(false);
  }

  return "";
}

async function isAdminChat(chatId) {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("telegram_admin_chats")
    .select("chat_id")
    .eq("chat_id", String(chatId))
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function findRunnerValue(surname) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("marathon_bot_lookup")
    .select("surname, value")
    .ilike("surname", `${surname}%`)
    .limit(1);

  if (error) throw error;
  return data && data[0] ? data[0] : null;
}

async function findRunnerDetails(surname) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("participants")
    .select("first_name,last_name,email,phone,gender,birth_date,distance,country,city,bmi,bmi_category,status,disqualification_reason,bib_number,check_in_status,registration_date")
    .ilike("last_name", `${surname}%`)
    .order("registration_date", { ascending: false })
    .limit(3);

  if (error) throw error;
  return data || [];
}

function formatRunnerDetails(rows, surname) {
  if (!rows.length) return `Участник с фамилией «${surname}» не найден.`;

  return rows.map((row) => [
    `Участник: ${personName(row)}`,
    `Номер: ${row.bib_number || "не выдан"}`,
    `Email: ${row.email || "не указан"}`,
    `Телефон: ${row.phone || "не указан"}`,
    `Дистанция: ${row.distance || "не выбрана"}`,
    `Город: ${row.city || "не указан"}, ${row.country || "страна не указана"}`,
    `BMI: ${row.bmi || 0} (${row.bmi_category || "нет данных"})`,
    `Статус: ${row.status === "disqualified" ? "дисквалифицирован" : "допущен"}`,
    `Пакет: ${row.check_in_status === "checked-in" ? "выдан" : "ожидает выдачи"}`,
    row.disqualification_reason ? `Причина: ${row.disqualification_reason}` : ""
  ].filter(Boolean).join("\n")).join("\n\n");
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
  const title = message.chat.title || telegramName(message) || "Admin";

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
  await sendTelegramMessage(chatId, "Готово. Этот чат получает админ-уведомления Marathon Skills.", {
    replyMarkup: menuKeyboard(true)
  });
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

async function adminStatus(chatId) {
  const admin = await isAdminChat(chatId);
  return admin
    ? "Этот чат подключен как админский и получает уведомления."
    : "Этот чат не подключен как админский. Используйте /admin КОД.";
}

async function buildStats() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("participants")
    .select("distance,status,check_in_status");

  if (error) throw error;

  const rows = data || [];
  const active = rows.filter((row) => row.status !== "disqualified").length;
  const disqualified = rows.length - active;
  const checkedIn = rows.filter((row) => row.check_in_status === "checked-in").length;
  const byDistance = rows.reduce((acc, row) => {
    const distance = row.distance || "не выбрана";
    acc[distance] = (acc[distance] || 0) + 1;
    return acc;
  }, {});

  const distanceLines = Object.entries(byDistance)
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([distance, count]) => `${distance}: ${count}`);

  return [
    "Статистика Marathon Skills",
    `Всего заявок: ${rows.length}`,
    `Допущены: ${active}`,
    `Дисквалифицированы: ${disqualified}`,
    `Стартовые пакеты выданы: ${checkedIn}`,
    "",
    "По дистанциям:",
    distanceLines.length ? distanceLines.join("\n") : "пока нет заявок"
  ].join("\n");
}

async function buildEvents() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("site_events")
    .select("event_title,user_email,user_name,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) throw error;
  if (!data || !data.length) return "Событий пока нет.";

  return data.map((event) => {
    const metadata = event.metadata || {};
    const subject = metadata.fullName || event.user_name || event.user_email || "пользователь";
    const details = [
      metadata.distance ? `дистанция ${metadata.distance}` : "",
      metadata.bibNumber ? `номер ${metadata.bibNumber}` : "",
      metadata.status ? `статус ${metadata.status}` : ""
    ].filter(Boolean).join(", ");

    return [
      `${localTime(event.created_at)} - ${event.event_title}`,
      `Кто: ${subject}`,
      details ? `Детали: ${details}` : ""
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

async function buildSupportList() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("support_messages")
    .select("id,chat_id,username,first_name,last_name,message,status,created_at")
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) throw error;
  if (!data || !data.length) return "Новых обращений нет.";

  return data.map((row) => [
    `ID: ${row.id}`,
    `Chat ID: ${row.chat_id}`,
    `От: ${[row.first_name, row.last_name].filter(Boolean).join(" ") || row.username || row.chat_id}`,
    `Время: ${localTime(row.created_at)}`,
    `Сообщение: ${row.message}`,
    `Ответ: /reply ${row.chat_id} ваш текст`
  ].join("\n")).join("\n\n");
}

async function replyToSupport(message, text) {
  const match = text.match(/^\/reply(@\w+)?\s+(-?\d+)\s+([\s\S]+)/i);
  if (!match) {
    await sendTelegramMessage(message.chat.id, "Формат: /reply CHAT_ID текст ответа");
    return;
  }

  const targetChatId = match[2];
  const answer = cleanText(match[3]);
  await sendTelegramMessage(targetChatId, `Ответ администратора Marathon Skills:\n${answer}`);

  const supabase = getSupabase();
  const fullUpdate = await supabase
    .from("support_messages")
    .update({
      status: "answered",
      answered_at: new Date().toISOString(),
      answered_by_chat_id: String(message.chat.id),
      updated_at: new Date().toISOString()
    })
    .eq("chat_id", targetChatId)
    .eq("status", "new");

  if (fullUpdate.error) {
    await supabase
      .from("support_messages")
      .update({
        status: "answered",
        updated_at: new Date().toISOString()
      })
      .eq("chat_id", targetChatId)
      .eq("status", "new");
  }

  await sendTelegramMessage(message.chat.id, "Ответ отправлен, открытые обращения этого чата помечены как отвеченные.");
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

  const { error } = await supabase.from("support_messages").insert(row);
  if (error) throw error;

  await notifyTelegramAdmins([
    "Marathon Skills: новое обращение в Telegram",
    `Chat ID: ${row.chat_id}`,
    `От: ${telegramName(message)}`,
    `Сообщение: ${text}`,
    `Ответить: /reply ${row.chat_id} текст ответа`
  ].join("\n"));
}

async function setupTelegram(req) {
  const secret = process.env.TELEGRAM_ADMIN_SECRET || "";
  const provided = getQueryValue(req, "setup") || getQueryValue(req, "secret");

  if (!secret || provided !== secret) {
    return {
      ok: false,
      error: "Setup is protected. Open /api/telegram-webhook?setup=TELEGRAM_ADMIN_SECRET"
    };
  }

  if (!isTelegramConfigured()) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

  const webhook = await callTelegramMethod("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "edited_message"]
  });
  const commands = await callTelegramMethod("setMyCommands", { commands: BOT_COMMANDS });

  return { ok: true, webhookUrl, webhook, commands };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    try {
      if (getQueryValue(req, "setup") || getQueryValue(req, "secret")) {
        return sendJson(res, 200, await setupTelegram(req));
      }

      return sendJson(res, 200, {
        ok: true,
        message: "Telegram webhook is ready.",
        telegramConfigured: isTelegramConfigured(),
        supabaseConfigured: isSupabaseConfigured(),
        setup: "Open /api/telegram-webhook?setup=TELEGRAM_ADMIN_SECRET to set webhook and bot commands."
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  try {
    const update = await readJson(req);
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id;
    const text = cleanText(message?.text);

    if (!chatId) return sendJson(res, 200, { ok: true, ignored: true });

    const admin = await isAdminChat(chatId);

    if (!text || /^\/start(@\w+)?$/i.test(text) || /^\/help(@\w+)?$/i.test(text)) {
      await sendTelegramMessage(chatId, helpText(admin), { replyMarkup: menuKeyboard(admin) });
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/admin_off(@\w+)?/i.test(text)) {
      await disableAdminChat(message);
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/admin_status(@\w+)?/i.test(text)) {
      await sendTelegramMessage(chatId, await adminStatus(chatId));
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/admin(@\w+)?/i.test(text)) {
      await registerAdminChat(message, text.replace(/^\/admin(@\w+)?\s*/i, "").trim());
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/(stats|events|support|runner|reply)(@\w+)?/i.test(text) && !admin) {
      await sendTelegramMessage(chatId, "Эта команда доступна только администратору. Подключите чат командой /admin КОД.");
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/stats(@\w+)?/i.test(text)) {
      await sendTelegramMessage(chatId, await buildStats());
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/events(@\w+)?/i.test(text)) {
      await sendTelegramMessage(chatId, await buildEvents());
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/support(@\w+)?/i.test(text)) {
      await sendTelegramMessage(chatId, await buildSupportList());
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/runner(@\w+)?/i.test(text)) {
      const surname = normalizeSurname(text);
      await sendTelegramMessage(chatId, surname
        ? formatRunnerDetails(await findRunnerDetails(surname), surname)
        : "Формат: /runner Фамилия");
      return sendJson(res, 200, { ok: true });
    }

    if (/^\/reply(@\w+)?/i.test(text)) {
      await replyToSupport(message, text);
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
        ? `Фамилия ${result.surname} - значение: ${result.value}`
        : `Фамилия «${surname}» не найдена в базе`;

      await sendTelegramMessage(chatId, answer);
      return sendJson(res, 200, { ok: true });
    }

    await saveSupportMessage(message, text);
    await sendTelegramMessage(chatId, "Спасибо, вопрос передан администратору. Ответ придет в этот чат.");
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const updateChatId = req.body?.message?.chat?.id;
    if (updateChatId && isTelegramConfigured()) {
      await sendTelegramMessage(updateChatId, "Не получилось обработать запрос. Проверьте настройки базы и попробуйте позже.").catch(() => {});
    }
    return sendError(res, error);
  }
};
