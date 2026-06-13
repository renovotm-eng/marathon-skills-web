const { sendJson } = require("./_lib/auth");

const DEFAULT_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
        resolve(raw.length ? JSON.parse(raw.toString("utf8")) : {});
      } catch {
        const error = new Error("Invalid JSON body");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeText(value, maxLength = 900) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function localAnswer(question) {
  const text = question.toLocaleLowerCase("ru");

  if (/(дистанц|км|маршрут|забег|бежать)/i.test(text)) {
    return "В Marathon Skills доступны дистанции 5 км, 10 км, 21 км и 42 км. Для первого старта лучше выбрать 5 км, для уверенного темпа подойдет 10 км, полумарафон 21 км и полный марафон 42 км требуют подготовки.";
  }

  if (/(bmi|имт|рост|вес|тело|масса)/i.test(text)) {
    return "BMI рассчитывается по формуле: вес / рост в метрах в квадрате. На сайте результат сохраняется в заявке и показывает примерную категорию состояния тела. Это не медицинский диагноз, а ориентир перед забегом.";
  }

  if (/(регистрац|заявк|анкета|аккаунт|войти|кабинет)/i.test(text)) {
    return "Чтобы зарегистрироваться, войдите через Google или email, откройте вкладку «Регистрация», заполните анкету, выберите страну, город и дистанцию, затем рассчитайте BMI и сохраните заявку.";
  }

  if (/(документ|паспорт|удостовер|справк|медицин)/i.test(text)) {
    return "На старт лучше взять удостоверение личности, телефон, удобную форму, беговую обувь и медицинскую справку, если ее требует организатор. Стартовый пакет выдается после проверки заявки.";
  }

  if (/(номер|статус|пакет|допуск|дисквалиф)/i.test(text)) {
    return "Стартовый номер и статус заявки можно посмотреть в личном кабинете после регистрации. Администратор видит полные данные участника, может выдать стартовый пакет или изменить статус допуска.";
  }

  if (/(когда|дата|время|старт|год|распис)/i.test(text)) {
    return "Marathon Skills проводится 15 июня 2026 года. Общий сбор начинается к 09:00, а приехать лучше заранее, чтобы спокойно получить стартовый пакет и подготовиться.";
  }

  return "Я могу помочь с вопросами по Marathon Skills: регистрация, дистанции, BMI, документы, личный кабинет, стартовый номер и подготовка к забегу. Сформулируйте вопрос чуть конкретнее, и я подскажу.";
}

function buildSystemPrompt(context) {
  const page = normalizeText(context?.page, 40) || "home";
  const role = normalizeText(context?.role, 40) || "guest";
  const marathonYear = normalizeText(context?.marathonYear, 12) || "2026";
  const marathonDate = normalizeText(context?.marathonDate, 40) || `15 июня ${marathonYear}`;
  const participantCount = Number(context?.participantCount) || 0;
  const registered = Boolean(context?.registered);
  const distance = normalizeText(context?.distance, 20);
  const bmiCategory = normalizeText(context?.bmiCategory, 80);

  return [
    "Ты AI ассистент сайта Marathon Skills.",
    "Отвечай на русском языке просто, дружелюбно и по делу: обычно 2-5 предложений.",
    "Тема сайта: марафон, регистрация участников, список бегунов, личный кабинет, BMI, документы, подготовка к старту, админ-панель и Telegram-помощь.",
    `Событие: Marathon Skills ${marathonYear}, дата старта: ${marathonDate}, дистанции: 5 км, 10 км, 21 км, 42 км.`,
    "Если вопрос медицинский, юридический или требует личных данных, не ставь диагноз и не запрашивай пароли/ключи; предложи обратиться к организатору или врачу.",
    "Если вопрос не относится к проекту, мягко верни пользователя к теме Marathon Skills.",
    `Контекст пользователя: страница ${page}, роль ${role}, заявка создана: ${registered ? "да" : "нет"}, дистанция: ${distance || "не выбрана"}, BMI: ${bmiCategory || "нет данных"}, заявок на сайте: ${participantCount}.`
  ].join("\n");
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((message) => ["user", "assistant"].includes(message?.role) && normalizeText(message?.content, 1200))
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: normalizeText(message.content, 1200)
    }));
}

function getAiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
  const apiUrl = process.env.AI_API_URL || process.env.DEEPSEEK_API_URL || process.env.OPENAI_API_URL || DEFAULT_API_URL;
  const model = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  return { apiKey, apiUrl, model };
}

async function callAiProvider({ question, history, context }) {
  const { apiKey, apiUrl, model } = getAiConfig();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(context) },
          ...safeHistory(history),
          { role: "user", content: question }
        ],
        temperature: 0.45,
        max_tokens: 620
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message || `AI provider returned ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    const answer = payload.choices?.[0]?.message?.content || payload.output_text || "";
    return normalizeText(answer, 2600);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson(req);
    const question = normalizeText(body.question);

    if (question.length < 2) {
      return sendJson(res, 400, { ok: false, error: "Введите вопрос для AI ассистента." });
    }

    const providerAnswer = await callAiProvider({
      question,
      history: body.history,
      context: body.context || {}
    }).catch(() => "");

    if (providerAnswer) {
      return sendJson(res, 200, {
        ok: true,
        source: "ai",
        answer: providerAnswer
      });
    }

    return sendJson(res, 200, {
      ok: true,
      source: "fallback",
      answer: localAnswer(question)
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      ok: false,
      error: status >= 500 ? "AI assistant is temporarily unavailable" : error.message
    });
  }
};
