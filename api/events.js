const { randomUUID } = require("crypto");
const { getSupabase } = require("./_lib/supabase");
const { requireUser, sendError, sendJson } = require("./_lib/auth");
const { notifyTelegramAdmins } = require("./_lib/telegram");

const EVENT_LABELS = {
  account_signup: "Создан аккаунт",
  user_login: "Вход на сайт",
  race_registration: "Регистрация на забег",
  race_update: "Обновление заявки",
  participant_update: "Изменение участника",
  participant_delete: "Удаление участника",
  participant_clear: "Очистка списка участников",
  disqualification: "Дисквалификация",
  restore_access: "Возврат допуска",
  check_in: "Выдача стартового пакета",
  check_in_cancel: "Отмена выдачи пакета",
  admin_tasks_update: "Обновление чек-листа админа",
  export_csv: "Экспорт CSV"
};

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

function normalizeString(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function cleanMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue === undefined || rawValue === null) continue;
    if (key.toLowerCase().includes("password") || key.toLowerCase().includes("token")) continue;
    if (typeof rawValue === "string") result[key] = rawValue.slice(0, 500);
    else if (typeof rawValue === "number" || typeof rawValue === "boolean") result[key] = rawValue;
    else if (Array.isArray(rawValue)) result[key] = rawValue.slice(0, 20).map((item) => String(item).slice(0, 80));
    else result[key] = JSON.stringify(rawValue).slice(0, 500);
  }
  return result;
}

function buildNotification(user, eventType, metadata) {
  const title = EVENT_LABELS[eventType] || eventType;
  const role = user.isAdmin ? "админ" : "участник";
  const lines = [
    `Marathon Skills: ${title}`,
    `Пользователь: ${user.name || user.email} (${role})`,
    `Email: ${user.email || "не указан"}`
  ];

  if (metadata.fullName) lines.push(`Участник: ${metadata.fullName}`);
  if (metadata.distance) lines.push(`Дистанция: ${metadata.distance}`);
  if (metadata.bibNumber) lines.push(`Номер: ${metadata.bibNumber}`);
  if (metadata.status) lines.push(`Статус: ${metadata.status}`);
  if (metadata.reason) lines.push(`Причина: ${metadata.reason}`);
  if (metadata.count !== undefined) lines.push(`Количество: ${metadata.count}`);
  lines.push(`Время: ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Qyzylorda" })}`);

  return lines.join("\n");
}

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabase();

    if (req.method === "GET") {
      if (!user.isAdmin) {
        return sendJson(res, 403, { ok: false, error: "Admin access is required" });
      }

      const limit = Math.min(Number(req.query.limit) || 80, 200);
      const { data, error } = await supabase
        .from("site_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return sendJson(res, 200, { ok: true, events: data || [] });
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    const body = await readJson(req);
    const eventType = normalizeString(body.type, 80);
    const metadata = cleanMetadata(body.metadata);

    if (!eventType) return sendJson(res, 400, { ok: false, error: "Event type is required" });

    const profile = {
      user_id: user.uid,
      email: user.email,
      display_name: user.name || "",
      photo_url: user.picture || "",
      role: user.isAdmin ? "admin" : "runner",
      provider: normalizeString(body.provider || metadata.provider || "firebase", 60),
      updated_at: new Date().toISOString()
    };
    if (eventType === "user_login") profile.last_login_at = new Date().toISOString();

    await supabase
      .from("user_profiles")
      .upsert(profile, { onConflict: "user_id" });

    const eventRow = {
      id: randomUUID(),
      user_id: user.uid,
      user_email: user.email,
      user_name: user.name || "",
      user_role: user.isAdmin ? "admin" : "runner",
      event_type: eventType,
      event_title: EVENT_LABELS[eventType] || eventType,
      metadata,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from("site_events").insert(eventRow);
    if (error) throw error;

    const notification = buildNotification(user, eventType, metadata);
    const telegram = await notifyTelegramAdmins(notification).catch((error) => ({
      sent: 0,
      error: error.message
    }));

    return sendJson(res, 200, { ok: true, event: eventRow, telegram });
  } catch (error) {
    return sendError(res, error);
  }
};
