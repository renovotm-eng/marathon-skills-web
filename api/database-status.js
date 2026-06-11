const { getSupabase, isSupabaseConfigured } = require("./_lib/supabase");
const { sendError, sendJson } = require("./_lib/auth");

const REQUIRED_RELATIONS = [
  "participants",
  "user_profiles",
  "admin_tasks",
  "site_events",
  "support_messages",
  "telegram_admin_chats",
  "app_settings",
  "bot_faq",
  "bot_interactions",
  "marathon_bot_lookup"
];

const ADMIN_TASKS = [
  { id: "route", completed: false },
  { id: "medical", completed: false },
  { id: "volunteers", completed: false },
  { id: "water", completed: false }
];

const FAQ_ROWS = [
  {
    intent: "distances",
    question: "Какие дистанции есть на марафоне?",
    answer: "Доступны дистанции 5 км, 10 км, 21 км и 42 км. 5 км подходит новичкам, 10 км - любителям, 21 км - полумарафон, 42 км - полный марафон.",
    keywords: ["дистанции", "дистанция", "км", "забег", "маршрут"]
  },
  {
    intent: "documents",
    question: "Какие документы нужны на старт?",
    answer: "Возьмите паспорт или удостоверение личности, телефон, удобную форму, воду и медицинскую справку, если она требуется организатором.",
    keywords: ["документы", "паспорт", "справка", "медицинская"]
  },
  {
    intent: "registration",
    question: "Как зарегистрироваться?",
    answer: "Войдите на сайт через Google или email, заполните анкету, выберите дистанцию, рассчитайте BMI и сохраните заявку.",
    keywords: ["регистрация", "заявка", "анкета", "аккаунт"]
  },
  {
    intent: "bmi",
    question: "Что такое BMI?",
    answer: "BMI - индекс массы тела. На сайте он считается по формуле: вес / рост² и помогает примерно оценить состояние тела перед забегом.",
    keywords: ["bmi", "имт", "рост", "вес", "индекс"]
  },
  {
    intent: "contacts",
    question: "Как связаться с организатором?",
    answer: "Напишите вопрос прямо в этот Telegram-чат. Бот сохранит обращение и передаст его администратору Marathon Skills.",
    keywords: ["контакты", "помощь", "оператор", "поддержка"]
  },
  {
    intent: "schedule",
    question: "Когда проходит старт?",
    answer: "Marathon Skills проводится в 2026 году. Сбор участников начинается в 09:00, стартовые пакеты выдаются заранее.",
    keywords: ["старт", "время", "расписание", "год"]
  }
];

function getQueryValue(req, name) {
  if (req.query && req.query[name] !== undefined) return String(req.query[name]);
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `https://${host}`);
  return url.searchParams.get(name) || "";
}

function assertSetupAccess(req) {
  const secret = process.env.TELEGRAM_ADMIN_SECRET || "";
  const provided = getQueryValue(req, "secret") || getQueryValue(req, "setup");

  if (!secret || provided !== secret) {
    const error = new Error("Setup secret is required");
    error.statusCode = 403;
    throw error;
  }
}

async function checkRelation(supabase, relation) {
  const { count, error } = await supabase
    .from(relation)
    .select("*", { count: "exact", head: true });

  return {
    relation,
    ok: !error,
    count: error ? null : count,
    error: error ? error.message : ""
  };
}

async function seedAdminTasks(supabase) {
  const { error } = await supabase
    .from("admin_tasks")
    .upsert(ADMIN_TASKS, { onConflict: "id", ignoreDuplicates: true });

  if (error) throw error;
  return ADMIN_TASKS.length;
}

async function seedAppSettings(supabase) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({
      key: "marathon_info",
      value: {
        name: "Marathon Skills",
        year: 2026,
        start_time: "09:00",
        distances: ["5 км", "10 км", "21 км", "42 км"]
      },
      updated_at: new Date().toISOString()
    }, { onConflict: "key" });

  if (error) throw error;
  return 1;
}

async function seedFaq(supabase) {
  let inserted = 0;

  for (const faq of FAQ_ROWS) {
    const existing = await supabase
      .from("bot_faq")
      .select("id")
      .eq("question", faq.question)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) continue;

    const { error } = await supabase.from("bot_faq").insert(faq);
    if (error) throw error;
    inserted += 1;
  }

  return inserted;
}

async function seedDatabase(supabase, statuses) {
  const available = new Set(statuses.filter((status) => status.ok).map((status) => status.relation));
  const result = {};

  async function runSeed(name, action) {
    try {
      result[name] = {
        ok: true,
        affected: await action()
      };
    } catch (error) {
      result[name] = {
        ok: false,
        error: error.message
      };
    }
  }

  if (available.has("admin_tasks")) await runSeed("adminTasks", () => seedAdminTasks(supabase));
  if (available.has("app_settings")) await runSeed("appSettings", () => seedAppSettings(supabase));
  if (available.has("bot_faq")) await runSeed("botFaq", () => seedFaq(supabase));

  return result;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    assertSetupAccess(req);

    if (!isSupabaseConfigured()) {
      return sendJson(res, 500, {
        ok: false,
        error: "Supabase is not configured"
      });
    }

    const supabase = getSupabase();
    const statuses = await Promise.all(REQUIRED_RELATIONS.map((relation) => checkRelation(supabase, relation)));
    const seed = getQueryValue(req, "seed") === "1" || req.method === "POST";
    const seedResult = seed ? await seedDatabase(supabase, statuses) : null;
    const missing = statuses.filter((status) => !status.ok).map((status) => status.relation);

    return sendJson(res, 200, {
      ok: missing.length === 0 && (!seedResult || Object.values(seedResult).every((item) => item.ok)),
      seeded: Boolean(seedResult),
      seedResult,
      missing,
      relations: statuses,
      nextStep: missing.length
        ? "Open Supabase SQL Editor and run supabase-schema.sql, then call this endpoint again with seed=1."
        : "Database is ready."
    });
  } catch (error) {
    return sendError(res, error);
  }
};
