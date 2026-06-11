const DEFAULT_KNOWLEDGE = [
  {
    intent: "distances",
    keywords: ["дистанция", "дистанции", "километр", "км", "забег", "бежать", "маршрут"],
    answer: [
      "В Marathon Skills доступны дистанции 5 км, 10 км, 21 км и 42 км.",
      "5 км подходит новичкам, 10 км - уверенным любителям, 21 км - полумарафон, 42 км - полный марафон.",
      "Дистанцию можно выбрать или изменить в личном кабинете до проверки заявки администратором."
    ].join("\n")
  },
  {
    intent: "documents",
    keywords: ["документы", "паспорт", "удостоверение", "справка", "медицинская", "медсправка", "взять"],
    answer: [
      "На старт возьмите паспорт или удостоверение личности, телефон, удобную форму, воду и медицинскую справку, если она требуется организатором.",
      "Стартовый пакет выдается после проверки данных участника."
    ].join("\n")
  },
  {
    intent: "registration",
    keywords: ["регистрация", "зарегистрироваться", "заявка", "анкета", "аккаунт", "войти", "логин"],
    answer: [
      "Регистрация проходит на сайте Marathon Skills.",
      "Нужно войти через Google или email, заполнить анкету, выбрать страну и дистанцию, рассчитать BMI и сохранить заявку.",
      "После сохранения заявка появляется в личном кабинете участника и в админ-панели."
    ].join("\n")
  },
  {
    intent: "bmi",
    keywords: ["bmi", "имт", "рост", "вес", "масса", "тело", "индекс"],
    answer: [
      "BMI - это индекс массы тела. На сайте он считается по формуле: вес / рост².",
      "После расчета система показывает категорию состояния тела и сохраняет результат в заявке участника.",
      "Это не медицинский диагноз, а ориентир для самопроверки перед забегом."
    ].join("\n")
  },
  {
    intent: "schedule",
    keywords: ["старт", "время", "когда", "расписание", "год", "дата", "выдача"],
    answer: [
      "Marathon Skills проводится в 2026 году.",
      "Сбор участников начинается в 09:00. Стартовые пакеты выдаются заранее и отмечаются администратором в системе.",
      "Точное время конкретной дистанции лучше уточнять у организатора перед стартом."
    ].join("\n")
  },
  {
    intent: "status",
    keywords: ["статус", "номер", "участник", "фамилия", "допуск", "пакет"],
    answer: "Чтобы проверить заявку, отправьте команду: /status Фамилия. Например: /status Иванов"
  },
  {
    intent: "contacts",
    keywords: ["контакты", "помощь", "оператор", "админ", "поддержка", "вопрос", "связаться"],
    answer: "Напишите вопрос прямо сюда. Я сохраню обращение и передам его администратору Marathon Skills."
  },
  {
    intent: "admin",
    keywords: ["админ", "администратор", "статистика", "события", "уведомления", "дисквалификация"],
    answer: [
      "Для администратора доступны команды:",
      "/stats - статистика по базе",
      "/events - последние действия на сайте",
      "/support - новые обращения",
      "/runner Фамилия - подробная карточка участника",
      "/reply CHAT_ID текст - ответ участнику"
    ].join("\n")
  }
];

function normalizeText(text) {
  return String(text || "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((word) => word.length > 1);
}

function scoreKeywords(tokens, keywords = []) {
  const normalizedKeywords = keywords.map(normalizeText);
  return normalizedKeywords.reduce((score, keyword) => {
    if (!keyword) return score;
    if (tokens.includes(keyword)) return score + 3;
    if (tokens.some((token) => token.includes(keyword) || keyword.includes(token))) return score + 1;
    return score;
  }, 0);
}

function pickLocalAnswer(text) {
  const tokens = tokenize(text);
  if (!tokens.length) return null;

  const ranked = DEFAULT_KNOWLEDGE
    .map((item) => ({
      ...item,
      score: scoreKeywords(tokens, item.keywords)
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score > 0 ? ranked[0] : null;
}

async function pickFaqAnswer(supabase, text) {
  const tokens = tokenize(text);
  if (!tokens.length) return null;

  const { data, error } = await supabase
    .from("bot_faq")
    .select("intent,question,answer,keywords,enabled")
    .eq("enabled", true);

  if (error) return null;

  const ranked = (data || [])
    .map((item) => ({
      ...item,
      score: scoreKeywords(tokens, [
        item.intent,
        item.question,
        ...(Array.isArray(item.keywords) ? item.keywords : [])
      ])
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score > 0 ? ranked[0] : null;
}

async function getAssistantAnswer({ supabase, text }) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      intent: "help",
      confidence: 1,
      answer: "Напишите вопрос о регистрации, дистанциях, документах, BMI или статусе заявки."
    };
  }

  const faqAnswer = supabase ? await pickFaqAnswer(supabase, text) : null;
  if (faqAnswer) {
    return {
      intent: faqAnswer.intent || "faq",
      confidence: 0.9,
      answer: faqAnswer.answer
    };
  }

  const localAnswer = pickLocalAnswer(text);
  if (localAnswer) {
    return {
      intent: localAnswer.intent,
      confidence: 0.75,
      answer: localAnswer.answer
    };
  }

  return {
    intent: "support",
    confidence: 0.25,
    answer: "Я пока не нашел точный ответ. Я передам вопрос администратору, чтобы вам помогли лично."
  };
}

async function logBotInteraction(supabase, payload) {
  if (!supabase) return;
  const row = {
    chat_id: String(payload.chatId || ""),
    username: payload.username || "",
    first_name: payload.firstName || "",
    last_name: payload.lastName || "",
    user_message: payload.userMessage || "",
    bot_answer: payload.botAnswer || "",
    intent: payload.intent || "",
    confidence: Number(payload.confidence) || 0,
    is_admin_chat: Boolean(payload.isAdminChat)
  };

  await supabase.from("bot_interactions").insert(row);
}

module.exports = {
  DEFAULT_KNOWLEDGE,
  getAssistantAnswer,
  logBotInteraction,
  normalizeText
};
