"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE = {
  accounts: "marathonSkills.accounts.v1",
  participants: "marathonSkills.participants.v1",
  adminTasks: "marathonSkills.adminTasks.v1"
};
const countries = `Казахстан|Австралия|Австрия|Азербайджан|Албания|Алжир|Ангола|Андорра|Антигуа и Барбуда|Аргентина|Армения|Афганистан|Багамы|Бангладеш|Барбадос|Бахрейн|Беларусь|Белиз|Бельгия|Бенин|Болгария|Боливия|Босния и Герцеговина|Ботсвана|Бразилия|Бруней|Буркина-Фасо|Бурунди|Бутан|Вануату|Великобритания|Венгрия|Венесуэла|Восточный Тимор|Вьетнам|Габон|Гаити|Гайана|Гамбия|Гана|Гватемала|Гвинея|Гвинея-Бисау|Германия|Гренада|Греция|Грузия|Дания|Джибути|Доминика|Доминиканская Республика|Египет|Замбия|Зимбабве|Израиль|Индия|Индонезия|Иордания|Ирак|Иран|Ирландия|Исландия|Испания|Италия|Йемен|Кабо-Верде|Камбоджа|Камерун|Канада|Катар|Кения|Кипр|Кирибати|Китай|Колумбия|Коморы|Конго|Корейская Народно-Демократическая Республика|Коста-Рика|Кот-д'Ивуар|Куба|Кувейт|Кыргызстан|Лаос|Латвия|Лесото|Либерия|Ливан|Ливия|Литва|Лихтенштейн|Люксембург|Маврикий|Мавритания|Мадагаскар|Малави|Малайзия|Мали|Мальдивы|Мальта|Марокко|Маршалловы Острова|Мексика|Мозамбик|Молдова|Монако|Монголия|Мьянма|Намибия|Науру|Непал|Нигер|Нигерия|Нидерланды|Никарагуа|Новая Зеландия|Норвегия|Объединенные Арабские Эмираты|Оман|Пакистан|Палау|Панама|Папуа - Новая Гвинея|Парагвай|Перу|Польша|Португалия|Россия|Руанда|Румыния|Сальвадор|Самоа|Сан-Марино|Сан-Томе и Принсипи|Саудовская Аравия|Северная Македония|Сейшелы|Сербия|Сингапур|Сирия|Словакия|Словения|Соединенные Штаты Америки|Соломоновы Острова|Сомали|Судан|Суринам|Сьерра-Леоне|Таджикистан|Таиланд|Танзания|Того|Тонга|Тринидад и Тобаго|Тувалу|Тунис|Туркменистан|Турция|Уганда|Узбекистан|Украина|Уругвай|Федеративные Штаты Микронезии|Фиджи|Филиппины|Финляндия|Франция|Хорватия|Центральноафриканская Республика|Чад|Черногория|Чехия|Чили|Швейцария|Швеция|Шри-Ланка|Эквадор|Экваториальная Гвинея|Эритрея|Эсватини|Эстония|Эфиопия|Южная Корея|Южно-Африканская Республика|Южный Судан|Ямайка|Япония`.split("|");
const genders = ["Мужской", "Женский"];
const distances = ["5 км", "10 км", "21 км", "42 км"];
const runnerChecklistItems = [
  ["document", "Подготовить удостоверение личности"],
  ["medical", "Взять медицинскую справку, если она требуется"],
  ["outfit", "Проверить форму и беговую обувь"],
  ["arrival", "Запланировать прибытие к 08:00"]
];
const adminChecklistItems = [
  ["route", "Проверить разметку маршрутов"],
  ["medical", "Подтвердить готовность медицинского пункта"],
  ["volunteers", "Провести инструктаж волонтеров"],
  ["water", "Разместить воду на дистанциях"]
];

const state = {
  accounts: loadJson(STORAGE.accounts, []).map(normalizeAccount).filter((account) => account.login),
  participants: loadJson(STORAGE.participants, []).map(normalizeParticipant),
  session: null,
  draftParticipant: null,
  selectedParticipantId: null,
  bmi: null,
  participantFilters: { query: "", sortBy: "registrationDate", direction: "desc" },
  adminFilters: { query: "", status: "all", distance: "all" },
  adminTasks: loadJson(STORAGE.adminTasks, []),
  siteEvents: [],
  cloud: { configured: false, ready: false, syncing: false },
  lastTrackedLoginKey: "",
  crop: { image: null, x: 0, y: 0, width: 0, height: 0, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 }
};

const canvas = $("#photo-canvas");
const ctx = canvas.getContext("2d");
let toastTimer;

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast("Не удалось сохранить данные. Возможно, память браузера заполнена.", true);
    return false;
  }
}

function normalizeParticipant(participant) {
  const id = participant.id || crypto.randomUUID();
  return {
    ...participant,
    id,
    firstName: participant.firstName || "",
    lastName: participant.lastName || "",
    email: participant.email || "",
    phone: participant.phone || "",
    gender: participant.gender || "",
    birthDate: participant.birthDate || "",
    distance: participant.distance || "",
    country: participant.country || "",
    city: participant.city || "",
    photo: participant.photo || "",
    registrationDate: participant.registrationDate || new Date().toISOString(),
    bmi: Number(participant.bmi) || 0,
    bmiCategory: participant.bmiCategory || "",
    ownerLogin: participant.ownerLogin || "",
    height: Number(participant.height) || 0,
    weight: Number(participant.weight) || 0,
    status: participant.status === "disqualified" ? "disqualified" : "active",
    disqualificationReason: participant.disqualificationReason || "",
    adminNote: participant.adminNote || "",
    bibNumber: participant.bibNumber || buildBibNumber(id),
    checkInStatus: participant.checkInStatus === "checked-in" ? "checked-in" : "pending",
    runnerChecklist: Array.isArray(participant.runnerChecklist)
      ? participant.runnerChecklist.filter((item) => runnerChecklistItems.some(([id]) => id === item))
      : []
  };
}

function normalizeAccount(account) {
  return {
    ...account,
    firstName: account.firstName || "",
    lastName: account.lastName || "",
    login: account.login || "",
    passwordSalt: account.passwordSalt || "",
    passwordHash: account.passwordHash || ""
  };
}

function buildBibNumber(id) {
  return `MS-${String(id).replace(/-/g, "").slice(-5).toUpperCase()}`;
}

function persistParticipants(nextParticipants) {
  const previousParticipants = state.participants;
  state.participants = nextParticipants;
  if (saveJson(STORAGE.participants, state.participants)) {
    syncCloudParticipants();
    return true;
  }
  state.participants = previousParticipants;
  return false;
}

function updateParticipant(id, updates) {
  if (!state.participants.some((participant) => participant.id === id)) return false;
  const nextParticipants = state.participants.map((participant) =>
    participant.id === id ? normalizeParticipant({ ...participant, ...updates }) : participant);
  return persistParticipants(nextParticipants);
}

function updateParticipantAndOwnerAccount(id, updates) {
  const participantIndex = state.participants.findIndex((participant) => participant.id === id);
  if (participantIndex === -1) return false;

  const previousParticipants = state.participants;
  const previousAccounts = state.accounts;
  const updatedParticipant = normalizeParticipant({ ...previousParticipants[participantIndex], ...updates });
  const nextParticipants = [...previousParticipants];
  nextParticipants[participantIndex] = updatedParticipant;
  const nextAccounts = previousAccounts.map((account) =>
    account.login.toLowerCase() === updatedParticipant.ownerLogin.toLowerCase()
      ? normalizeAccount({
          ...account,
          firstName: updatedParticipant.firstName,
          lastName: updatedParticipant.lastName
        })
      : account);

  state.participants = nextParticipants;
  state.accounts = nextAccounts;
  if (saveJson(STORAGE.participants, nextParticipants) && saveJson(STORAGE.accounts, nextAccounts)) {
    syncCloudParticipants();
    return true;
  }

  state.participants = previousParticipants;
  state.accounts = previousAccounts;
  saveJson(STORAGE.participants, previousParticipants);
  saveJson(STORAGE.accounts, previousAccounts);
  return false;
}

function getCurrentRunnerAccount() {
  if (!state.session || state.session.isAdmin) return null;
  if (state.session.authProvider) {
    return {
      firstName: state.session.firstName || "",
      lastName: state.session.lastName || "",
      login: state.session.login || "",
      email: state.session.email || "",
      photoURL: state.session.photoURL || ""
    };
  }
  return state.accounts.find((account) => account.login.toLowerCase() === state.session.login.toLowerCase()) || null;
}

function getOwnParticipant() {
  if (!state.session || state.session.isAdmin) return null;
  return state.participants.find((participant) =>
    participant.ownerLogin.toLowerCase() === state.session.login.toLowerCase()) || null;
}

function linkLegacyParticipants() {
  let changed = false;
  const claimedLogins = new Set(state.participants.map((participant) => participant.ownerLogin.toLowerCase()).filter(Boolean));
  const nextParticipants = state.participants.map((participant) => {
    if (participant.ownerLogin) return participant;
    const matchingAccounts = state.accounts.filter((account) =>
      !claimedLogins.has(account.login.toLowerCase()) &&
      account.firstName.toLocaleLowerCase("ru") === participant.firstName.toLocaleLowerCase("ru") &&
      account.lastName.toLocaleLowerCase("ru") === participant.lastName.toLocaleLowerCase("ru"));
    if (matchingAccounts.length !== 1) return participant;
    changed = true;
    claimedLogins.add(matchingAccounts[0].login.toLowerCase());
    return { ...participant, ownerLogin: matchingAccounts[0].login };
  });
  if (changed && saveJson(STORAGE.participants, nextParticipants)) state.participants = nextParticipants;
}

async function cloudApi(path, options = {}) {
  if (!state.session?.authProvider || !window.MarathonCloud?.apiFetch) return null;
  const response = await window.MarathonCloud.apiFetch(path, {
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "Cloud API error");
  return payload;
}

async function trackSiteEvent(type, metadata = {}) {
  if (!state.session?.authProvider || !window.MarathonCloud?.apiFetch) return;
  try {
    const payload = await cloudApi("/api/events", {
      method: "POST",
      body: {
        type,
        provider: state.session.authProvider,
        metadata
      }
    });
    if (state.session.isAdmin && payload?.event) {
      state.siteEvents = [payload.event, ...state.siteEvents].slice(0, 12);
      renderAdminEvents();
    }
  } catch (error) {
    console.warn("Event tracking is unavailable:", error.message);
  }
}

function participantEventMeta(participant) {
  if (!participant) return {};
  return {
    participantId: participant.id,
    fullName: `${participant.firstName} ${participant.lastName}`.trim(),
    distance: participant.distance,
    bibNumber: participant.bibNumber,
    status: participant.status,
    email: participant.email,
    phone: participant.phone,
    country: participant.country,
    city: participant.city,
    bmi: participant.bmi
  };
}

async function loadCloudState(participants = null) {
  if (!state.session?.authProvider) return;
  try {
    let payload = participants ? { participants } : await cloudApi("/api/participants");
    if (payload?.participants) {
      state.participants = payload.participants.map(normalizeParticipant);
      saveJson(STORAGE.participants, state.participants);
    }
    if (state.session.isAdmin) {
      const tasksPayload = await cloudApi("/api/admin-tasks");
      if (tasksPayload?.tasks) {
        state.adminTasks = tasksPayload.tasks.filter((id) => adminChecklistItems.some(([itemId]) => itemId === id));
        saveJson(STORAGE.adminTasks, state.adminTasks);
      }
      const eventsPayload = await cloudApi("/api/events?limit=12");
      state.siteEvents = eventsPayload?.events || [];
    }
    renderParticipants();
    if (state.session.isAdmin) renderAdminDashboard();
    if (!state.session.isAdmin) renderRunnerCabinet();
  } catch (error) {
    toast(`Облачная синхронизация недоступна: ${error.message}`, true);
  }
}

async function syncCloudParticipants() {
  if (!state.session?.authProvider || state.cloud.syncing) return;
  state.cloud.syncing = true;
  try {
    await cloudApi("/api/participants", {
      method: "PUT",
      body: { participants: state.participants }
    });
  } catch (error) {
    toast(`Данные сохранены локально, но не отправлены в Supabase: ${error.message}`, true);
  } finally {
    state.cloud.syncing = false;
  }
}

async function deleteCloudParticipant(id) {
  if (!state.session?.authProvider) return;
  try {
    await cloudApi(`/api/participants?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    toast(`Участник удален локально, но Supabase не обновился: ${error.message}`, true);
  }
}

async function clearCloudParticipants() {
  if (!state.session?.authProvider) return;
  try {
    await cloudApi("/api/participants", { method: "DELETE" });
  } catch (error) {
    toast(`Список очищен локально, но Supabase не обновился: ${error.message}`, true);
  }
}

async function syncCloudAdminTasks() {
  if (!state.session?.authProvider || !state.session.isAdmin) return;
  try {
    await cloudApi("/api/admin-tasks", {
      method: "PUT",
      body: { tasks: state.adminTasks }
    });
  } catch (error) {
    toast(`Чек-лист сохранен локально, но не отправлен в Supabase: ${error.message}`, true);
  }
}

function applyCloudAuth(detail) {
  state.cloud.configured = Boolean(detail.configured);
  state.cloud.ready = true;

  if (!detail.user) {
    state.session = null;
    updateAccountUi();
    if (location.pathname === "/login") $("#login-overlay").classList.remove("hidden");
    return;
  }

  state.session = {
    isAdmin: Boolean(detail.user.isAdmin),
    login: detail.user.uid,
    email: detail.user.email,
    firstName: detail.user.firstName,
    lastName: detail.user.lastName,
    photoURL: detail.user.photoURL,
    authProvider: detail.user.provider || "firebase"
  };

  $("#login-overlay").classList.add("hidden");
  if (location.pathname === "/login") history.replaceState(null, "", "/");
  updateAccountUi();
  const loginKey = `${state.session.login}:${new Date().toISOString().slice(0, 16)}`;
  if (state.lastTrackedLoginKey !== loginKey) {
    state.lastTrackedLoginKey = loginKey;
    trackSiteEvent("user_login", {
      provider: state.session.authProvider,
      role: state.session.isAdmin ? "admin" : "runner"
    });
  }
  loadCloudState(detail.participants || null);
  showPage(state.session.isAdmin ? "admin" : "cabinet");
}

window.MarathonApp = {
  setCloudAuth: applyCloudAuth
};
window.addEventListener("marathon-cloud-auth", (event) => applyCloudAuth(event.detail || {}));

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast visible${isError ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.className = "toast", 3600);
}

function formatDateForInput(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDateRu(value) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

function getNextMarathonDate() {
  const now = new Date();
  const date = new Date(now.getFullYear(), 5, 15, 9, 0, 0);
  if (now >= date) date.setFullYear(date.getFullYear() + 1);
  return date;
}

function updateCountdown() {
  const marathonDate = getNextMarathonDate();
  const ms = Math.max(0, marathonDate - new Date());
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor(ms / 3600000) % 24;
  const minutes = Math.floor(ms / 60000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  const pad = (value) => String(value).padStart(2, "0");
  $("#timer").textContent = `До марафона осталось: ${days} дн. ${pad(hours)} ч. ${pad(minutes)} мин. ${pad(seconds)} сек.`;
  const year = marathonDate.getFullYear();
  $("#sidebar-date").textContent = `15 июня ${year}`;
  $("#footer-date").textContent = `Marathon Skills | 15 июня ${year}`;
  $("#hero-year").textContent = `Marathon Skills ${year}`;
  $("#hero-info").textContent = `Marathon Skills ${year} пройдет 15 июня. Это ежегодный забег с дистанциями 5, 10, 21 и 42 км: участники проходят регистрацию, выбирают страну и город, рассчитывают BMI и попадают в общий список бегунов.`;
}

function showPage(name) {
  if (name === "registration" && !state.session) {
    openLogin("Войдите через Google, чтобы зарегистрироваться на марафон.");
    return;
  }
  if (name === "admin" && !state.session?.isAdmin) {
    openLogin("Войдите через Google-аккаунт администратора, чтобы открыть панель управления.");
    return;
  }
  if (name === "cabinet" && !state.session) {
    openLogin("Войдите через Google, чтобы открыть личный кабинет.");
    return;
  }
  if (name === "cabinet" && state.session?.isAdmin) {
    return showPage("admin");
  }
  const targetPage = $(`#page-${name}`);
  if (!targetPage) return;
  $$(".page").forEach((page) => page.classList.remove("active"));
  targetPage.classList.add("active");
  targetPage.scrollTo({ top: 0, behavior: "smooth" });
  $$("[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === name));
  if (name === "registration" && state.session && !state.session.isAdmin) {
    if (!$("#first-name").value && !$("#last-name").value) {
      $("#first-name").value = state.session.firstName;
      $("#last-name").value = state.session.lastName;
    }
    const participant = getOwnParticipant();
    if (participant && !state.draftParticipant && !$("#email").value) fillRegistrationForm(participant);
  }
  if (name === "participants") renderParticipants();
  if (name === "admin") renderAdminDashboard();
  if (name === "cabinet") renderRunnerCabinet();
}

function updateAccountUi() {
  $("#current-account").textContent = !state.session
    ? "Вход не выполнен"
    : state.session.isAdmin ? `Админ: ${state.session.firstName} ${state.session.lastName}` : `Бегун: ${state.session.firstName} ${state.session.lastName}`;
  const photo = $("#account-photo");
  if (photo) {
    photo.src = state.session?.photoURL || "";
    photo.classList.toggle("hidden", !state.session?.photoURL);
  }
  $("#admin-actions").classList.toggle("visible", Boolean(state.session?.isAdmin));
  $$(".admin-nav").forEach((button) => button.classList.toggle("hidden", !state.session?.isAdmin));
  $$(".runner-nav").forEach((button) => button.classList.toggle("hidden", !state.session || state.session.isAdmin));
  $("#login-button").classList.toggle("hidden", Boolean(state.session));
  $("#logout-button").classList.toggle("hidden", !state.session);
}

function showLogin() {
  $("#google-login-panel").classList.remove("hidden");
  $("#signup-form").classList.add("hidden");
  $("#login-form").classList.remove("hidden");
  $("#admin-hint").classList.remove("hidden");
  $("#signup-message").textContent = "";
  $("#login-message").textContent = "";
}

function showSignup() {
  $("#google-login-panel").classList.add("hidden");
  $("#login-form").classList.add("hidden");
  $("#signup-form").classList.remove("hidden");
  $("#admin-hint").classList.add("hidden");
  $("#signup-message").textContent = "";
  $("#login-message").textContent = "";
}

function openLogin(message = "") {
  showLogin();
  $("#cloud-auth-message").textContent = message;
  $("#cloud-auth-message").classList.remove("error", "success");
  $("#login-overlay").classList.remove("hidden");
  if (location.pathname !== "/login") history.pushState(null, "", "/login");
}

function closeLogin() {
  $("#login-overlay").classList.add("hidden");
  $("#login-message").textContent = "";
  $("#cloud-auth-message").textContent = "";
  if (location.pathname === "/login") history.replaceState(null, "", "/");
  showPage("home");
}

function openPersonalCabinet() {
  if (!state.session) return openLogin();
  if (state.session.isAdmin) return showPage("admin");
  showPage("cabinet");
}

function isValidName(value) {
  return /^\p{L}{2,}(?:[ -]\p{L}+)*$/u.test(value.trim());
}

function isCapitalizedName(value) {
  return isValidName(value) && value.trim().split(/[ -]+/).every((part) => /^\p{Lu}/u.test(part));
}

function normalizeName(value) {
  return value.trim().split(/\s+/).map((part) => part ? part[0].toLocaleUpperCase("ru") + part.slice(1).toLocaleLowerCase("ru") : "").join(" ");
}

function getPhoneDigits(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && (digits.startsWith("8") || digits.startsWith("7"))) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function formatPhone(value) {
  const digits = getPhoneDigits(value);
  if (!digits) return "";
  let result = "+7";
  if (digits.length) result += ` (${digits.slice(0, 3)}`;
  if (digits.length >= 3) result += ")";
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`;
  return result;
}

function isValidEmail(value) {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(value.trim());
}

function isValidBirthDate(value) {
  if (!value) return false;
  const birthDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  const youngest = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
  const oldest = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  return birthDate >= oldest && birthDate <= youngest;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

async function createPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return { passwordSalt: bytesToHex(salt), passwordHash: bytesToHex(hash) };
}

async function verifyPassword(account, password) {
  try {
    const result = await createPassword(password, account.passwordSalt);
    return result.passwordHash === account.passwordHash;
  } catch {
    return false;
  }
}

function getAuthErrorMessage(error) {
  const code = error?.code || "";
  if (code === "auth/email-already-in-use") return "Этот email уже зарегистрирован. Войдите или используйте другой email.";
  if (code === "auth/invalid-email") return "Введите корректный email.";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") return "Неверный email или пароль.";
  if (code === "auth/weak-password") return "Пароль должен содержать минимум 6 символов.";
  if (code === "auth/operation-not-allowed") return "Обычный вход еще не включен в Firebase. Включите Email/Password в Authentication.";
  return error?.message || "Не удалось выполнить вход.";
}

function clearSessionDraft() {
  $("#registration-form").reset();
  setRegistrationDefaults();
  clearPhoto();
  state.draftParticipant = null;
  state.bmi = null;
  $("#height").value = "";
  $("#weight").value = "";
  $("#current-runner").textContent = "Участник";
  resetBmiPreview();
  state.selectedParticipantId = null;
  showPage("home");
}

async function logout() {
  if (state.session?.authProvider && window.MarathonCloud?.signOut) {
    try {
      await window.MarathonCloud.signOut();
    } catch (error) {
      toast(`Не удалось выйти из Google: ${error.message}`, true);
    }
  }
  state.session = null;
  clearSessionDraft();
  $("#login").value = "";
  $("#password").value = "";
  $("#login-message").textContent = "";
  showLogin();
  $("#login-overlay").classList.add("hidden");
  updateAccountUi();
  toast("Вы вышли из аккаунта.");
}

async function handleLogin(event) {
  event.preventDefault();
  const login = $("#login").value.trim();
  const password = $("#password").value;
  const message = $("#login-message");
  message.className = "form-message";

  if (isValidEmail(login) && window.MarathonCloud?.emailSignIn) {
    try {
      message.textContent = "Выполняю вход...";
      await window.MarathonCloud.emailSignIn(login.toLowerCase(), password);
      message.textContent = "";
      $("#password").value = "";
      return;
    } catch (error) {
      message.textContent = getAuthErrorMessage(error);
      message.classList.add("error");
      return;
    }
  }

  if (login.toLowerCase() === "admin" && password === "admin") {
    state.session = { isAdmin: true, login: "admin", firstName: "Админ", lastName: "" };
  } else {
    const account = state.accounts.find((item) => item.login.toLowerCase() === login.toLowerCase());
    if (!account || !(await verifyPassword(account, password))) {
      message.textContent = "Неверный логин или пароль. Если аккаунта еще нет, нажмите «Создать аккаунт».";
      return;
    }
    state.session = { isAdmin: false, login: account.login, firstName: account.firstName, lastName: account.lastName };
  }

  message.textContent = "";
  $("#password").value = "";
  $("#login-overlay").classList.add("hidden");
  updateAccountUi();
  showPage(state.session.isAdmin ? "admin" : "cabinet");
}

async function handleSignup(event) {
  event.preventDefault();
  const firstName = $("#signup-first-name").value.trim();
  const lastName = $("#signup-last-name").value.trim();
  const email = $("#signup-email").value.trim().toLowerCase();
  const login = $("#signup-login").value.trim();
  const password = $("#signup-password").value;
  const passwordRepeat = $("#signup-password-repeat").value;
  const message = $("#signup-message");
  message.className = "form-message";

  if (!isCapitalizedName(firstName) || !isCapitalizedName(lastName)) {
    message.textContent = "Имя и фамилия должны начинаться с заглавной буквы и содержать только буквы, пробел или дефис.";
    return;
  }
  if (!isValidEmail(email)) {
    message.textContent = "Введите корректный email.";
    return;
  }
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(login)) {
    message.textContent = "Логин: от 3 до 32 символов. Используйте латинские буквы, цифры, точку, дефис или нижнее подчеркивание.";
    return;
  }
  if (login.toLowerCase() === "admin" || state.accounts.some((item) => item.login.toLowerCase() === login.toLowerCase())) {
    message.textContent = "Такой логин уже занят.";
    return;
  }
  if (password.length < 6) {
    message.textContent = "Пароль должен содержать минимум 6 символов.";
    return;
  }
  if (password !== passwordRepeat) {
    message.textContent = "Пароли не совпадают.";
    return;
  }

  if (window.MarathonCloud?.emailSignUp) {
    try {
      message.textContent = "Создаю аккаунт...";
      await window.MarathonCloud.emailSignUp({ email, password, firstName, lastName });
      await trackSiteEvent("account_signup", {
        fullName: `${firstName} ${lastName}`,
        email,
        login
      });
      $("#signup-form").reset();
      message.textContent = "";
      return;
    } catch (error) {
      message.textContent = getAuthErrorMessage(error);
      message.classList.add("error");
      return;
    }
  }

  const passwordData = await createPassword(password);
  state.accounts.push({ firstName, lastName, login, email, ...passwordData });
  if (!saveJson(STORAGE.accounts, state.accounts)) {
    state.accounts.pop();
    return;
  }

  $("#login").value = login;
  $("#signup-form").reset();
  showLogin();
  $("#login-message").textContent = "Аккаунт создан. Введите пароль для входа.";
  $("#login-message").classList.add("success");
}

function validateRegistration() {
  const data = Object.fromEntries(new FormData($("#registration-form")).entries());
  if (!data.firstName.trim() || !data.lastName.trim() || !data.email.trim() || !data.phone.trim() || !data.country || !data.city.trim()) return "Заполните все поля регистрации.";
  if (!isCapitalizedName(data.firstName) || !isCapitalizedName(data.lastName)) return "Имя и фамилия должны начинаться с заглавной буквы и содержать только буквы, пробел или дефис.";
  if (!isValidName(data.city)) return "Город должен содержать только буквы, пробел или дефис.";
  if (!isValidEmail(data.email)) return "Введите корректный email.";
  if (getPhoneDigits(data.phone).length !== 10) return "Введите телефон в формате +7 (777) 123-45-67.";
  if (!isValidBirthDate(data.birthDate)) return "Укажите корректную дату рождения. Участнику должно быть от 14 до 100 лет.";
  if (!genders.includes(data.gender)) return "Выберите пол из списка.";
  if (!distances.includes(data.distance)) return "Выберите дистанцию из списка.";
  if (!countries.includes(data.country)) return "Выберите страну из списка.";
  return "";
}

function fillRegistrationForm(participant) {
  $("#first-name").value = participant.firstName;
  $("#last-name").value = participant.lastName;
  $("#email").value = participant.email;
  $("#phone").value = participant.phone;
  $("#gender").value = participant.gender;
  $("#birth-date").value = participant.birthDate;
  $("#distance").value = participant.distance;
  $("#country").value = participant.country;
  $("#city").value = participant.city;
}

function handleRegistration(event) {
  event.preventDefault();
  const error = validateRegistration();
  if (error) return toast(error, true);
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  state.draftParticipant = { id: crypto.randomUUID(), ...data, phone: formatPhone(data.phone), registrationDate: new Date().toISOString() };
  state.bmi = null;
  $("#height").value = "";
  $("#weight").value = "";
  $("#current-runner").textContent = `Участник: ${data.firstName.trim()} ${data.lastName.trim()}`;
  resetBmiPreview();
  showPage("bmi");
}

function readBmi() {
  const height = Number($("#height").value.replace(",", "."));
  const weight = Number($("#weight").value.replace(",", "."));
  if (!Number.isFinite(height) || !Number.isFinite(weight) || height < 80 || height > 240 || weight < 25 || weight > 250) return null;
  return weight / ((height / 100) ** 2);
}

function getBmiCategory(bmi) {
  if (bmi < 18.5) return "Недостаточный вес";
  if (bmi < 25) return "Норма";
  if (bmi < 30) return "Избыточный вес";
  return "Ожирение";
}

function getBmiVisual(bmi) {
  if (bmi < 18.5) return ["Недостаточный вес", "Стоит обратить внимание на питание и восстановление.", "#64b5f6"];
  if (bmi < 25) return ["Норма", "Соотношение роста и веса находится в здоровом диапазоне.", "#78d6a4"];
  if (bmi < 30) return ["Выше нормы", "Есть небольшой риск перегрузки, полезно следить за режимом.", "#f5b14b"];
  return ["Высокий риск", "Лучше снизить нагрузку и проконсультироваться со специалистом.", "#ef6f6c"];
}

function updateBmiPreview(showError = false) {
  const bmi = readBmi();
  if (bmi === null) {
    if (showError) toast("Введите реальные значения роста и веса. Например: рост 175, вес 70.", true);
    if (!$("#height").value && !$("#weight").value) resetBmiPreview();
    else $("#scale-value").textContent = "Введите реальные значения: рост 80-240 см, вес 25-250 кг.";
    return false;
  }
  state.bmi = bmi;
  const category = getBmiCategory(bmi);
  const [title, copy, color] = getBmiVisual(bmi);
  $("#bmi-result").textContent = `BMI: ${bmi.toFixed(1)}. Категория: ${category}.`;
  $("#body-head").style.background = color;
  $("#body-torso").style.background = color;
  $("#body-torso").style.width = `${Math.min(118, Math.max(58, 62 + (bmi - 18.5) * 3.6))}px`;
  $("#body-title").textContent = title;
  $("#body-title").style.color = color;
  $("#body-copy").textContent = copy;
  $("#bmi-marker").style.left = `calc(${Math.min(100, Math.max(0, (bmi - 14) / 24 * 100))}% - 17px)`;
  $("#scale-value").textContent = `BMI ${bmi.toFixed(1)}: ${title}`;
  return true;
}

function resetBmiPreview() {
  state.bmi = null;
  $("#bmi-result").textContent = "Введите рост и вес, затем нажмите «Рассчитать».";
  $("#body-head").style.background = "#78d6a4";
  $("#body-torso").style.background = "#78d6a4";
  $("#body-torso").style.width = "82px";
  $("#body-title").textContent = "Нет данных";
  $("#body-title").style.color = "#0b2545";
  $("#body-copy").textContent = "Введите рост и вес.";
  $("#bmi-marker").style.left = "0";
  $("#scale-value").textContent = "BMI появится после ввода данных.";
}

function saveParticipant() {
  if (!state.draftParticipant) {
    toast("Сначала заполните страницу регистрации.", true);
    return showPage("registration");
  }
  if (!updateBmiPreview(true)) return;
  const existingParticipant = state.session?.isAdmin ? null : getOwnParticipant();
  const participant = normalizeParticipant({
    ...existingParticipant,
    ...state.draftParticipant,
    id: existingParticipant?.id || state.draftParticipant.id,
    ownerLogin: state.session?.isAdmin ? "" : state.session?.login || "",
    registrationDate: existingParticipant?.registrationDate || state.draftParticipant.registrationDate,
    height: Number($("#height").value.replace(",", ".")),
    weight: Number($("#weight").value.replace(",", ".")),
    bmi: Number(state.bmi.toFixed(1)),
    bmiCategory: getBmiCategory(state.bmi),
    photo: state.crop.image ? canvas.toDataURL("image/jpeg", .82) : existingParticipant?.photo || "",
    status: existingParticipant?.status || "active",
    disqualificationReason: existingParticipant?.disqualificationReason || "",
    adminNote: existingParticipant?.adminNote || "",
    checkInStatus: existingParticipant?.checkInStatus || "pending",
    runnerChecklist: existingParticipant?.runnerChecklist || []
  });
  const nextParticipants = existingParticipant
    ? state.participants.map((item) => item.id === existingParticipant.id ? participant : item)
    : [...state.participants, participant];
  if (!persistParticipants(nextParticipants)) return;
  trackSiteEvent(existingParticipant ? "race_update" : "race_registration", participantEventMeta(participant));
  clearSessionDraft();
  renderParticipants();
  showPage(state.session?.isAdmin ? "participants" : "cabinet");
  toast(existingParticipant ? "Ваша заявка обновлена." : "Участник сохранен.");
}

function calculateBmi(height, weight) {
  const numericHeight = Number(String(height).replace(",", "."));
  const numericWeight = Number(String(weight).replace(",", "."));
  if (!Number.isFinite(numericHeight) || !Number.isFinite(numericWeight) ||
      numericHeight < 80 || numericHeight > 240 || numericWeight < 25 || numericWeight > 250) return null;
  return numericWeight / ((numericHeight / 100) ** 2);
}

function renderRunnerCabinet() {
  const account = getCurrentRunnerAccount();
  if (!account) return;
  const participant = getOwnParticipant();
  $("#cabinet-title").textContent = participant ? `${account.firstName}, ваш старт готовится` : `${account.firstName}, добро пожаловать`;
  $("#runner-cabinet-summary").innerHTML = participant ? `
    ${participant.status === "disqualified" ? `<div class="runner-alert"><strong>Заявка временно не допущена к старту.</strong><br>${escapeHtml(participant.disqualificationReason || "Обратитесь к организатору для уточнения деталей.")}</div>` : ""}
    <div class="runner-summary">
      <article class="runner-welcome">
        ${participant.photo ? `<img src="${participant.photo}" alt="">` : `<span class="runner-photo-placeholder"></span>`}
        <div><span>Участник Marathon Skills</span><strong>${escapeHtml(participant.firstName)} ${escapeHtml(participant.lastName)}</strong>${renderStatusBadge(participant.status)}</div>
      </article>
      <article><span>Стартовый номер</span><strong>${escapeHtml(participant.bibNumber)}</strong><p>Покажите его на стойке выдачи.</p></article>
      <article><span>Дистанция</span><strong>${escapeHtml(participant.distance)}</strong><p>Стартовый коридор уточнят на площадке.</p></article>
      <article><span>Ваш BMI</span><strong>${Number(participant.bmi).toFixed(1)}</strong><p>${escapeHtml(participant.bmiCategory)}</p></article>
      <article><span>Стартовый пакет</span><strong>${participant.checkInStatus === "checked-in" ? "Выдан" : "Ожидает"}</strong><p>${participant.checkInStatus === "checked-in" ? "Вы готовы к старту." : "Получите номер до 08:40."}</p></article>
    </div>` : `
    <div class="runner-empty-state">
      <h2>У вас пока нет заявки на забег</h2>
      <p>Заполните анкету, выберите дистанцию и рассчитайте BMI. После сохранения здесь появится стартовый номер и личная памятка.</p>
      <button type="button" class="button primary" data-runner-action="registration">Заполнить заявку</button>
    </div>`;
  $("#runner-profile-editor").innerHTML = renderRunnerProfileEditor(account, participant);
  $("#runner-day-plan").innerHTML = renderRunnerDayPlan(participant);
  $("#runner-checklist").innerHTML = renderRunnerChecklist(participant);
}

function renderRunnerProfileEditor(account, participant) {
  const accountForm = `
    <form class="account-profile-form" id="runner-account-form">
      <p class="section-kicker">Аккаунт</p>
      <h2>Данные для входа</h2>
      <p class="subtitle">Логин остается неизменным, имя можно обновить.</p>
      <div class="runner-profile-form">
        <label>Имя<input name="firstName" maxlength="32" value="${escapeHtml(account.firstName)}"></label>
        <label>Фамилия<input name="lastName" maxlength="32" value="${escapeHtml(account.lastName)}"></label>
        <label class="profile-wide">Логин<input value="${escapeHtml(account.login)}" disabled></label>
        <div class="button-row"><button type="submit" class="button secondary">Сохранить аккаунт</button></div>
      </div>
    </form>`;
  if (!participant) return `${accountForm}<div class="runner-empty-state"><h2>Анкета участника появится после регистрации</h2><p>Когда вы сохраните заявку, здесь можно будет обновлять контакты, дистанцию, рост и вес.</p></div>`;
  return `${accountForm}
    <form class="runner-profile-form" id="runner-profile-form">
      <p class="section-kicker">Анкета участника</p>
      <h2>Изменить данные заявки</h2>
      <p class="subtitle">Контакты, маршрут и BMI обновятся в общем списке сразу после сохранения.</p>
      <label>Email<input name="email" maxlength="80" value="${escapeHtml(participant.email)}"></label>
      <label>Телефон<input name="phone" maxlength="18" value="${escapeHtml(participant.phone)}"></label>
      <label>Пол<select name="gender">${renderOptions(genders, participant.gender)}</select></label>
      <label>Дата рождения<input name="birthDate" type="date" value="${escapeHtml(participant.birthDate)}"></label>
      <label>Дистанция<select name="distance">${renderOptions(distances, participant.distance)}</select></label>
      <label>Страна<select name="country">${renderOptions(countries, participant.country)}</select></label>
      <label class="profile-wide">Город<input name="city" maxlength="48" value="${escapeHtml(participant.city)}"></label>
      <label>Рост, см<input name="height" inputmode="decimal" value="${participant.height || ""}" placeholder="Например, 175"></label>
      <label>Вес, кг<input name="weight" inputmode="decimal" value="${participant.weight || ""}" placeholder="Например, 70"></label>
      <div class="button-row"><button type="submit" class="button primary">Сохранить анкету</button><button type="button" class="button secondary" data-runner-action="registration">Изменить фото</button></div>
    </form>`;
}

function renderRunnerDayPlan(participant) {
  return `
    <p class="section-kicker">День забега</p>
    <h2>Памятка участника</h2>
    <ul class="day-plan">
      <li><strong>08:00</strong><span>Приезд на площадку, навигация и гардероб.</span></li>
      <li><strong>08:15</strong><span>Получение стартового пакета${participant ? ` для номера ${escapeHtml(participant.bibNumber)}` : ""}.</span></li>
      <li><strong>08:40</strong><span>Разминка и переход в стартовый коридор.</span></li>
      <li><strong>09:00</strong><span>Общий старт Marathon Skills.</span></li>
    </ul>`;
}

function renderRunnerChecklist(participant) {
  if (!participant) return `<p class="section-kicker">Подготовка</p><h2>Чек-лист бегуна</h2><p>Персональный список появится после сохранения заявки.</p>`;
  const completed = participant.runnerChecklist.length;
  return `
    <p class="section-kicker">Подготовка</p>
    <h2>Чек-лист бегуна</h2>
    <p class="checklist-progress">Выполнено: ${completed} из ${runnerChecklistItems.length}</p>
    <div class="runner-checklist">${runnerChecklistItems.map(([id, label]) => `
      <label><input type="checkbox" data-runner-check="${id}"${participant.runnerChecklist.includes(id) ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`).join("")}
    </div>`;
}

function saveRunnerAccount(event) {
  event.preventDefault();
  const account = getCurrentRunnerAccount();
  if (!account) return;
  const data = Object.fromEntries(new FormData(event.target.closest("form")).entries());
  if (!isCapitalizedName(data.firstName) || !isCapitalizedName(data.lastName)) {
    return toast("Имя и фамилия должны начинаться с заглавной буквы.", true);
  }
  const previousAccounts = state.accounts;
  const previousParticipants = state.participants;
  state.accounts = state.accounts.map((item) => item.login === account.login ? { ...item, firstName: data.firstName.trim(), lastName: data.lastName.trim() } : item);
  state.participants = state.participants.map((participant) => participant.ownerLogin.toLowerCase() === account.login.toLowerCase()
    ? { ...participant, firstName: data.firstName.trim(), lastName: data.lastName.trim() } : participant);
  if (!saveJson(STORAGE.accounts, state.accounts) || !saveJson(STORAGE.participants, state.participants)) {
    state.accounts = previousAccounts;
    state.participants = previousParticipants;
    saveJson(STORAGE.accounts, previousAccounts);
    saveJson(STORAGE.participants, previousParticipants);
    return;
  }
  state.session.firstName = data.firstName.trim();
  state.session.lastName = data.lastName.trim();
  syncCloudParticipants();
  updateAccountUi();
  renderRunnerCabinet();
  toast("Данные аккаунта обновлены.");
}

function saveRunnerProfile(event) {
  event.preventDefault();
  const participant = getOwnParticipant();
  if (!participant) return;
  const data = Object.fromEntries(new FormData(event.target.closest("form")).entries());
  if (!isValidEmail(data.email)) return toast("Введите корректный email.", true);
  if (getPhoneDigits(data.phone).length !== 10) return toast("Введите корректный телефон.", true);
  if (!isValidName(data.city)) return toast("Введите корректное название города.", true);
  if (!countries.includes(data.country)) return toast("Выберите страну из списка.", true);
  if (!isValidBirthDate(data.birthDate)) return toast("Проверьте дату рождения: возраст участника должен быть от 14 до 100 лет.", true);
  if (!genders.includes(data.gender)) return toast("Выберите пол из списка.", true);
  if (!distances.includes(data.distance)) return toast("Выберите дистанцию из списка.", true);
  const bmi = calculateBmi(data.height, data.weight);
  if (bmi === null) return toast("Проверьте рост и вес: рост 80-240 см, вес 25-250 кг.", true);
  const updated = updateParticipant(participant.id, {
    ...data,
    email: data.email.trim().toLowerCase(),
    phone: formatPhone(data.phone),
    city: normalizeName(data.city),
    height: Number(String(data.height).replace(",", ".")),
    weight: Number(String(data.weight).replace(",", ".")),
    bmi: Number(bmi.toFixed(1)),
    bmiCategory: getBmiCategory(bmi)
  });
  if (!updated) return;
  renderParticipants();
  renderRunnerCabinet();
  toast("Анкета участника обновлена.");
}

function toggleRunnerChecklist(id, checked) {
  const participant = getOwnParticipant();
  if (!participant) return;
  const nextChecklist = checked
    ? [...new Set([...participant.runnerChecklist, id])]
    : participant.runnerChecklist.filter((item) => item !== id);
  if (!updateParticipant(participant.id, { runnerChecklist: nextChecklist })) return;
  renderRunnerCabinet();
}

function renderParticipants() {
  const participants = getVisibleParticipants();
  const isFiltered = Boolean(state.participantFilters.query.trim());
  $("#participants-count").textContent = isFiltered
    ? `Найдено: ${participants.length} из ${state.participants.length}`
    : `Зарегистрировано: ${state.participants.length}`;
  $("#participants-body").innerHTML = participants.length ? participants.map((participant) => `
    <tr data-id="${participant.id}" class="${participant.id === state.selectedParticipantId ? "selected" : ""}">
      <td>${participant.photo ? `<img class="runner-photo" src="${participant.photo}" alt="">` : `<span class="runner-photo-placeholder"></span>`}</td>
      <td>${escapeHtml(participant.firstName)}</td><td>${escapeHtml(participant.lastName)}</td><td>${escapeHtml(participant.gender)}</td>
      <td>${formatDateRu(participant.birthDate)}</td><td>${escapeHtml(participant.distance)}</td><td>${escapeHtml(participant.country)}</td>
      <td>${escapeHtml(participant.city)}</td><td>${Number(participant.bmi).toFixed(1)}</td><td>${escapeHtml(participant.bmiCategory)}</td>
      <td>${renderStatusBadge(participant.status)}</td>
    </tr>`).join("") : `<tr class="empty-row"><td colspan="11">${isFiltered ? "По вашему запросу участники не найдены." : "Список участников пока пуст."}</td></tr>`;
  $$(".sort-column").forEach((button) => {
    const isActive = button.dataset.sort === state.participantFilters.sortBy;
    button.classList.toggle("active", isActive);
    button.dataset.direction = isActive ? state.participantFilters.direction : "";
  });
}

function getVisibleParticipants() {
  const query = state.participantFilters.query.trim().toLocaleLowerCase("ru");
  const participants = query
    ? state.participants.filter((participant) => getParticipantSearchText(participant).includes(query))
    : [...state.participants];
  return participants.sort((left, right) => {
    const result = compareParticipants(left, right, state.participantFilters.sortBy);
    return state.participantFilters.direction === "asc" ? result : -result;
  });
}

function getParticipantSearchText(participant) {
  return [
    participant.firstName,
    participant.lastName,
    participant.gender,
    formatDateRu(participant.birthDate),
    participant.distance,
    participant.country,
    participant.city,
    Number(participant.bmi).toFixed(1),
    participant.bmiCategory,
    getStatusLabel(participant.status)
  ].join(" ").toLocaleLowerCase("ru");
}

function compareParticipants(left, right, sortBy) {
  if (sortBy === "bmi") return Number(left.bmi) - Number(right.bmi);
  if (sortBy === "distance") return parseInt(left.distance, 10) - parseInt(right.distance, 10);
  if (sortBy === "birthDate" || sortBy === "registrationDate") {
    return new Date(left[sortBy] || 0) - new Date(right[sortBy] || 0);
  }
  return String(left[sortBy] ?? "").localeCompare(String(right[sortBy] ?? ""), "ru", { sensitivity: "base" });
}

function resetParticipantFilters() {
  state.participantFilters = { query: "", sortBy: "registrationDate", direction: "desc" };
  $("#participants-search").value = "";
  $("#participants-sort").value = state.participantFilters.sortBy;
  $("#participants-sort-direction").value = state.participantFilters.direction;
  renderParticipants();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function getStatusLabel(status) {
  return status === "disqualified" ? "Дисквалифицирован" : "Допущен";
}

function renderStatusBadge(status) {
  return `<span class="status-badge ${status === "disqualified" ? "disqualified" : "active"}">${getStatusLabel(status)}</span>`;
}

function renderCheckInBadge(checkInStatus) {
  return checkInStatus === "checked-in"
    ? `<span class="check-in-badge">Пакет выдан</span>`
    : `<span class="check-in-badge pending">Пакет ожидает</span>`;
}

function getParticipantAge(birthDate) {
  if (!birthDate) return "";
  const birthday = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  if (today < new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())) age -= 1;
  return age;
}

function getAdminVisibleParticipants() {
  const query = state.adminFilters.query.trim().toLocaleLowerCase("ru");
  return [...state.participants]
    .filter((participant) => state.adminFilters.status === "all" || participant.status === state.adminFilters.status)
    .filter((participant) => state.adminFilters.distance === "all" || participant.distance === state.adminFilters.distance)
    .filter((participant) => !query || [
      participant.firstName,
      participant.lastName,
      participant.email,
      participant.phone,
      participant.gender,
      participant.distance,
      participant.country,
      participant.city,
      participant.bmiCategory,
      participant.bibNumber,
      participant.checkInStatus,
      participant.disqualificationReason,
      participant.adminNote
    ].join(" ").toLocaleLowerCase("ru").includes(query))
    .sort((left, right) => new Date(right.registrationDate || 0) - new Date(left.registrationDate || 0));
}

function renderAdminDashboard() {
  if (!state.session?.isAdmin) return;
  const participants = getAdminVisibleParticipants();
  const active = state.participants.filter((participant) => participant.status !== "disqualified").length;
  const disqualified = state.participants.length - active;
  const attention = state.participants.filter((participant) => Number(participant.bmi) > 0 && (Number(participant.bmi) < 18.5 || Number(participant.bmi) >= 30)).length;
  const checkedIn = state.participants.filter((participant) => participant.checkInStatus === "checked-in").length;
  $("#admin-total").textContent = state.participants.length;
  $("#admin-active").textContent = active;
  $("#admin-disqualified").textContent = disqualified;
  $("#admin-attention").textContent = attention;
  $("#admin-checked-in").textContent = checkedIn;
  renderAdminDistanceSummary();
  renderAdminOpsChecklist();
  renderAdminEvents();
  $("#admin-participants-body").innerHTML = participants.length ? participants.map((participant) => `
    <tr data-id="${participant.id}" class="${participant.id === state.selectedParticipantId ? "selected" : ""}">
      <td><div class="admin-runner">${participant.photo ? `<img class="runner-photo" src="${participant.photo}" alt="">` : `<span class="runner-photo-placeholder"></span>`}<span><strong>${escapeHtml(participant.firstName)} ${escapeHtml(participant.lastName)}</strong><small>${escapeHtml(participant.country)}, ${escapeHtml(participant.city)}</small></span></div></td>
      <td><strong>${escapeHtml(participant.email)}</strong><small>${escapeHtml(participant.phone)}</small></td>
      <td><strong>${escapeHtml(participant.distance)}</strong><small>BMI ${Number(participant.bmi).toFixed(1)} | ${escapeHtml(participant.bibNumber)}</small></td>
      <td>${renderStatusBadge(participant.status)}${renderCheckInBadge(participant.checkInStatus)}</td>
      <td><button type="button" class="table-action" data-admin-select="${participant.id}">Открыть</button></td>
    </tr>`).join("") : `<tr class="empty-row"><td colspan="5">По выбранным фильтрам участники не найдены.</td></tr>`;
  renderAdminDetail();
}

function renderAdminEvents() {
  const feed = $("#admin-event-feed");
  if (!feed) return;
  feed.innerHTML = state.siteEvents.length ? state.siteEvents.map((event) => {
    const metadata = event.metadata || {};
    const details = [
      metadata.fullName,
      metadata.distance,
      metadata.bibNumber,
      metadata.status
    ].filter(Boolean).join(" | ");
    return `
      <article>
        <strong>${escapeHtml(event.event_title || event.event_type)}</strong>
        <span>${escapeHtml(event.user_email || event.user_name || "Пользователь")}</span>
        ${details ? `<small>${escapeHtml(details)}</small>` : ""}
        <time>${escapeHtml(new Date(event.created_at).toLocaleString("ru-RU"))}</time>
      </article>`;
  }).join("") : `<article class="empty-event"><strong>Событий пока нет</strong><span>После входов, регистраций и действий админа здесь появится журнал.</span></article>`;
}

function renderAdminDistanceSummary() {
  $("#admin-distance-summary").innerHTML = distances.map((distance) => {
    const participants = state.participants.filter((participant) => participant.distance === distance);
    const checkedIn = participants.filter((participant) => participant.checkInStatus === "checked-in").length;
    return `<article><strong>${participants.length}</strong><span>${distance} | пакеты ${checkedIn}/${participants.length}</span></article>`;
  }).join("");
}

function renderAdminOpsChecklist() {
  $("#admin-ops-checklist").innerHTML = adminChecklistItems.map(([id, label]) => `
    <label><input type="checkbox" data-admin-task="${id}"${state.adminTasks.includes(id) ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`).join("");
}

function toggleAdminTask(id, checked) {
  if (!adminChecklistItems.some(([itemId]) => itemId === id)) return;
  const previousTasks = state.adminTasks;
  state.adminTasks = checked ? [...new Set([...state.adminTasks, id])] : state.adminTasks.filter((item) => item !== id);
  if (!saveJson(STORAGE.adminTasks, state.adminTasks)) state.adminTasks = previousTasks;
  syncCloudAdminTasks();
  trackSiteEvent("admin_tasks_update", { taskId: id, completed: checked });
  renderAdminOpsChecklist();
}

function getParticipantById(id = state.selectedParticipantId) {
  return state.participants.find((participant) => participant.id === id);
}

function renderOptions(values, selected) {
  return values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function renderAdminDetail() {
  const participant = getParticipantById();
  if (!participant) {
    $("#admin-detail").innerHTML = `<div class="admin-detail-empty"><strong>Выберите участника</strong><p>Справа появятся полные данные, статус допуска и инструменты редактирования.</p></div>`;
    return;
  }
  const reasonVisible = participant.status === "disqualified";
  $("#admin-detail").innerHTML = `
    <form id="admin-edit-form" class="admin-edit-form">
      <header><div><p class="section-kicker">Карточка участника</p><h2>${escapeHtml(participant.firstName)} ${escapeHtml(participant.lastName)}</h2></div>${renderStatusBadge(participant.status)}</header>
      <div class="admin-profile">
        ${participant.photo ? `<img src="${participant.photo}" alt="">` : `<span class="runner-photo-placeholder"></span>`}
        <p>Номер ${escapeHtml(participant.bibNumber)}<br>Заявка от ${escapeHtml(formatDateRu(participant.registrationDate))}<br>${getParticipantAge(participant.birthDate)} лет, BMI ${Number(participant.bmi).toFixed(1)}<br>${renderCheckInBadge(participant.checkInStatus)}</p>
      </div>
      <div class="admin-form-grid">
        <label>Имя<input name="firstName" value="${escapeHtml(participant.firstName)}"></label>
        <label>Фамилия<input name="lastName" value="${escapeHtml(participant.lastName)}"></label>
        <label>Email<input name="email" value="${escapeHtml(participant.email)}"></label>
        <label>Телефон<input name="phone" value="${escapeHtml(participant.phone)}"></label>
        <label>Пол<select name="gender">${renderOptions(genders, participant.gender)}</select></label>
        <label>Дата рождения<input name="birthDate" type="date" value="${escapeHtml(participant.birthDate)}"></label>
        <label>Дистанция<select name="distance">${renderOptions(distances, participant.distance)}</select></label>
        <label>Страна<select name="country">${renderOptions(countries, participant.country)}</select></label>
        <label class="admin-wide">Город<input name="city" value="${escapeHtml(participant.city)}"></label>
        <label class="admin-wide">Статус допуска<select name="status" id="admin-edit-status"><option value="active"${participant.status !== "disqualified" ? " selected" : ""}>Допущен</option><option value="disqualified"${participant.status === "disqualified" ? " selected" : ""}>Дисквалифицирован</option></select></label>
        <label class="admin-wide ${reasonVisible ? "" : "hidden"}" id="admin-reason-field">Причина дисквалификации<textarea name="disqualificationReason" rows="2">${escapeHtml(participant.disqualificationReason)}</textarea></label>
        <label class="admin-wide">Заметка организатора<textarea name="adminNote" rows="3" placeholder="Например: проверить справку перед выдачей номера">${escapeHtml(participant.adminNote)}</textarea></label>
      </div>
      <div class="button-row admin-detail-actions">
        <button class="button primary" type="submit">Сохранить</button>
        <button class="button secondary" id="toggle-check-in" type="button">${participant.checkInStatus === "checked-in" ? "Отменить выдачу пакета" : "Выдать стартовый пакет"}</button>
        <button class="button ${participant.status === "disqualified" ? "secondary" : "warning"}" id="toggle-disqualification" type="button">${participant.status === "disqualified" ? "Вернуть допуск" : "Дисквалифицировать"}</button>
        <button class="button danger" id="admin-delete-participant" type="button">Удалить</button>
      </div>
    </form>`;
}

function saveAdminParticipant(event) {
  event.preventDefault();
  const participant = getParticipantById();
  if (!participant) return;
  const data = Object.fromEntries(new FormData(event.target.closest("form")).entries());
  if (!isCapitalizedName(data.firstName) || !isCapitalizedName(data.lastName)) return toast("Имя и фамилия должны начинаться с заглавной буквы.", true);
  if (!isValidEmail(data.email)) return toast("Введите корректный email.", true);
  if (getPhoneDigits(data.phone).length !== 10) return toast("Введите корректный телефон участника.", true);
  if (!isValidName(data.city)) return toast("Введите корректное название города.", true);
  if (!isValidBirthDate(data.birthDate)) return toast("Проверьте дату рождения участника.", true);
  if (!countries.includes(data.country)) return toast("Выберите страну из списка.", true);
  if (!genders.includes(data.gender)) return toast("Выберите пол из списка.", true);
  if (!distances.includes(data.distance)) return toast("Выберите дистанцию из списка.", true);
  if (data.status === "disqualified" && !data.disqualificationReason.trim()) return toast("Укажите причину дисквалификации.", true);
  if (!updateParticipantAndOwnerAccount(participant.id, {
    ...data,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: formatPhone(data.phone),
    city: normalizeName(data.city),
    disqualificationReason: data.status === "disqualified" ? data.disqualificationReason.trim() : "",
    adminNote: data.adminNote.trim(),
    checkInStatus: data.status === "disqualified" ? "pending" : participant.checkInStatus
  })) return;
  trackSiteEvent("participant_update", participantEventMeta(getParticipantById(participant.id)));
  renderParticipants();
  renderAdminDashboard();
  toast("Карточка участника обновлена.");
}

function toggleParticipantDisqualification() {
  const participant = getParticipantById();
  if (!participant) return;
  const isRestoring = participant.status === "disqualified";
  if (!updateParticipant(participant.id, {
    status: isRestoring ? "active" : "disqualified",
    disqualificationReason: isRestoring ? "" : participant.disqualificationReason || "Решение организатора",
    checkInStatus: isRestoring ? participant.checkInStatus : "pending"
  })) return;
  trackSiteEvent(isRestoring ? "restore_access" : "disqualification", participantEventMeta(getParticipantById(participant.id)));
  renderParticipants();
  renderAdminDashboard();
  toast(isRestoring ? "Участник снова допущен к старту." : "Участник дисквалифицирован.");
}

function toggleParticipantCheckIn() {
  const participant = getParticipantById();
  if (!participant) return;
  if (participant.status === "disqualified") return toast("Сначала верните участнику допуск.", true);
  const checkedIn = participant.checkInStatus === "checked-in";
  if (!updateParticipant(participant.id, { checkInStatus: checkedIn ? "pending" : "checked-in" })) return;
  trackSiteEvent(checkedIn ? "check_in_cancel" : "check_in", participantEventMeta(getParticipantById(participant.id)));
  renderAdminDashboard();
  toast(checkedIn ? "Выдача пакета отменена." : "Стартовый пакет отмечен как выданный.");
}

function resetAdminFilters() {
  state.adminFilters = { query: "", status: "all", distance: "all" };
  $("#admin-search").value = "";
  $("#admin-status-filter").value = "all";
  $("#admin-distance-filter").value = "all";
  renderAdminDashboard();
}

function exportParticipantsCsv() {
  if (!state.session?.isAdmin) return toast("Экспорт доступен только администратору.", true);
  const rows = [["Стартовый номер", "Имя", "Фамилия", "Email", "Телефон", "Пол", "Дата рождения", "Дистанция", "Страна", "Город", "BMI", "Категория BMI", "Статус", "Стартовый пакет", "Причина дисквалификации", "Заметка организатора"]];
  state.participants.forEach((participant) => rows.push([
    participant.bibNumber, participant.firstName, participant.lastName, participant.email, participant.phone, participant.gender,
    formatDateRu(participant.birthDate), participant.distance, participant.country, participant.city,
    Number(participant.bmi).toFixed(1), participant.bmiCategory, getStatusLabel(participant.status),
    participant.checkInStatus === "checked-in" ? "Выдан" : "Ожидает", participant.disqualificationReason, participant.adminNote
  ]));
  const csv = "\uFEFF" + rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `marathon-skills-participants-${formatDateForInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  trackSiteEvent("export_csv", { count: state.participants.length });
  toast("CSV-файл со списком участников подготовлен.");
}

function deleteSelectedParticipant() {
  if (!state.session?.isAdmin) return toast("Удалять участников может только администратор.", true);
  if (!state.selectedParticipantId) return toast("Выберите участника в таблице.", true);
  const participant = state.participants.find((item) => item.id === state.selectedParticipantId);
  if (!participant || !confirm(`Удалить участника ${participant.firstName} ${participant.lastName}?`)) return;
  const nextParticipants = state.participants.filter((item) => item.id !== state.selectedParticipantId);
  if (!persistParticipants(nextParticipants)) return;
  trackSiteEvent("participant_delete", participantEventMeta(participant));
  deleteCloudParticipant(state.selectedParticipantId);
  state.selectedParticipantId = null;
  renderParticipants();
  renderAdminDashboard();
}

function clearParticipants() {
  if (!state.session?.isAdmin) return toast("Очищать список может только администратор.", true);
  if (!state.participants.length || !confirm("Удалить всех участников из списка?")) return;
  const count = state.participants.length;
  if (!persistParticipants([])) return;
  trackSiteEvent("participant_clear", { count });
  clearCloudParticipants();
  state.selectedParticipantId = null;
  renderParticipants();
  renderAdminDashboard();
}

function drawPhoto() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.crop.image) return;
  ctx.drawImage(state.crop.image, state.crop.x, state.crop.y, state.crop.width, state.crop.height);
}

function resetPhotoPosition() {
  const image = state.crop.image;
  if (!image) return;
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  state.crop.width = image.naturalWidth * scale;
  state.crop.height = image.naturalHeight * scale;
  state.crop.x = (canvas.width - state.crop.width) / 2;
  state.crop.y = (canvas.height - state.crop.height) / 2;
  drawPhoto();
}

function applyPhotoOffset(x, y) {
  state.crop.x = Math.min(0, Math.max(canvas.width - state.crop.width, x));
  state.crop.y = Math.min(0, Math.max(canvas.height - state.crop.height, y));
  drawPhoto();
}

function clearPhoto() {
  state.crop.image = null;
  state.crop.dragging = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("#photo-input").value = "";
  $("#photo-placeholder").classList.remove("hidden");
  $("#photo-hint").classList.remove("visible");
  $("#photo-viewport").classList.remove("dragging");
}

function handlePhoto(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png"].includes(file.type)) return toast("Допустимы только JPG и PNG-файлы.", true);
  if (file.size > 10 * 1024 * 1024) return toast("Выберите фото размером не больше 10 МБ.", true);
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    state.crop.image = image;
    $("#photo-placeholder").classList.add("hidden");
    $("#photo-hint").classList.add("visible");
    resetPhotoPosition();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    toast("Не удалось открыть изображение. Выберите корректный JPG или PNG-файл.", true);
  };
  image.src = url;
}

function setRegistrationDefaults() {
  const today = new Date();
  const birth = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  $("#birth-date").value = formatDateForInput(birth);
  $("#birth-date").max = formatDateForInput(new Date(today.getFullYear() - 14, today.getMonth(), today.getDate()));
  $("#birth-date").min = formatDateForInput(new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()));
  $("#country").value = "Казахстан";
}

function setupEvents() {
  $$("[data-page]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
  $("#login-button").addEventListener("click", () => openLogin());
  $("#hero-login").addEventListener("click", openPersonalCabinet);
  $("#close-login").addEventListener("click", closeLogin);
  $("#logout-button").addEventListener("click", logout);
  $("#login-form").addEventListener("submit", handleLogin);
  $("#signup-form").addEventListener("submit", handleSignup);
  $("#show-signup").addEventListener("click", showSignup);
  $("#show-login").addEventListener("click", showLogin);
  $("#registration-form").addEventListener("submit", handleRegistration);
  $("#phone").addEventListener("focus", (event) => event.target.value = getPhoneDigits(event.target.value));
  $("#phone").addEventListener("blur", (event) => event.target.value = formatPhone(event.target.value));
  ["#first-name", "#last-name", "#signup-first-name", "#signup-last-name"].forEach((selector) => {
    $(selector).addEventListener("blur", (event) => {
      if (event.target.value && !isCapitalizedName(event.target.value)) toast("Имя и фамилия должны начинаться с заглавной буквы.", true);
    });
  });
  $("#city").addEventListener("blur", (event) => event.target.value = normalizeName(event.target.value));
  $("#email").addEventListener("blur", (event) => event.target.value = event.target.value.trim().toLowerCase());
  $("#signup-email").addEventListener("blur", (event) => event.target.value = event.target.value.trim().toLowerCase());
  ["#height", "#weight"].forEach((selector) => {
    $(selector).addEventListener("input", () => updateBmiPreview(false));
    $(selector).addEventListener("input", (event) => event.target.value = event.target.value.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1"));
  });
  $("#calculate-bmi").addEventListener("click", () => updateBmiPreview(true));
  $("#save-participant").addEventListener("click", saveParticipant);
  $("#delete-participant").addEventListener("click", deleteSelectedParticipant);
  $("#clear-participants").addEventListener("click", clearParticipants);
  $("#participants-search").addEventListener("input", (event) => {
    state.participantFilters.query = event.target.value;
    renderParticipants();
  });
  $("#participants-sort").addEventListener("change", (event) => {
    state.participantFilters.sortBy = event.target.value;
    renderParticipants();
  });
  $("#participants-sort-direction").addEventListener("change", (event) => {
    state.participantFilters.direction = event.target.value;
    renderParticipants();
  });
  $("#reset-participants-filters").addEventListener("click", resetParticipantFilters);
  $("#admin-search").addEventListener("input", (event) => {
    state.adminFilters.query = event.target.value;
    renderAdminDashboard();
  });
  $("#admin-status-filter").addEventListener("change", (event) => {
    state.adminFilters.status = event.target.value;
    renderAdminDashboard();
  });
  $("#admin-distance-filter").addEventListener("change", (event) => {
    state.adminFilters.distance = event.target.value;
    renderAdminDashboard();
  });
  $("#reset-admin-filters").addEventListener("click", resetAdminFilters);
  $("#export-participants").addEventListener("click", exportParticipantsCsv);
  $("#admin-participants-body").addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row?.dataset.id) return;
    state.selectedParticipantId = row.dataset.id;
    renderAdminDashboard();
  });
  $("#admin-detail").addEventListener("submit", saveAdminParticipant);
  $("#admin-detail").addEventListener("change", (event) => {
    if (event.target.id === "admin-edit-status") {
      $("#admin-reason-field").classList.toggle("hidden", event.target.value !== "disqualified");
    }
  });
  $("#admin-detail").addEventListener("click", (event) => {
    if (event.target.id === "toggle-check-in") toggleParticipantCheckIn();
    if (event.target.id === "toggle-disqualification") toggleParticipantDisqualification();
    if (event.target.id === "admin-delete-participant") deleteSelectedParticipant();
  });
  $("#admin-ops-checklist").addEventListener("change", (event) => {
    if (event.target.matches("[data-admin-task]")) toggleAdminTask(event.target.dataset.adminTask, event.target.checked);
  });
  $("#page-cabinet").addEventListener("submit", (event) => {
    if (event.target.id === "runner-account-form") saveRunnerAccount(event);
    if (event.target.id === "runner-profile-form") saveRunnerProfile(event);
  });
  $("#page-cabinet").addEventListener("change", (event) => {
    if (event.target.matches("[data-runner-check]")) toggleRunnerChecklist(event.target.dataset.runnerCheck, event.target.checked);
  });
  $("#page-cabinet").addEventListener("click", (event) => {
    if (event.target.dataset.runnerAction === "registration") showPage("registration");
  });
  $$(".sort-column").forEach((button) => button.addEventListener("click", () => {
    const sortBy = button.dataset.sort;
    state.participantFilters.direction = state.participantFilters.sortBy === sortBy && state.participantFilters.direction === "asc" ? "desc" : "asc";
    state.participantFilters.sortBy = sortBy;
    $("#participants-sort").value = sortBy;
    $("#participants-sort-direction").value = state.participantFilters.direction;
    renderParticipants();
  }));
  $("#participants-body").addEventListener("click", (event) => {
    const row = event.target.closest("tr");
    if (!row?.dataset.id) return;
    state.selectedParticipantId = row.dataset.id;
    renderParticipants();
  });
  $("#choose-photo").addEventListener("click", () => $("#photo-input").click());
  $("#photo-input").addEventListener("change", (event) => handlePhoto(event.target.files[0]));
  $("#center-photo").addEventListener("click", resetPhotoPosition);
  $("#clear-photo").addEventListener("click", clearPhoto);
  $("#photo-viewport").addEventListener("pointerdown", (event) => {
    if (!state.crop.image) return;
    state.crop.dragging = true;
    state.crop.startX = event.clientX;
    state.crop.startY = event.clientY;
    state.crop.originX = state.crop.x;
    state.crop.originY = state.crop.y;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("dragging");
  });
  $("#photo-viewport").addEventListener("pointermove", (event) => {
    if (!state.crop.dragging) return;
    const factor = canvas.width / event.currentTarget.clientWidth;
    applyPhotoOffset(state.crop.originX + (event.clientX - state.crop.startX) * factor, state.crop.originY + (event.clientY - state.crop.startY) * factor);
  });
  const endDrag = (event) => {
    state.crop.dragging = false;
    event.currentTarget.classList.remove("dragging");
  };
  $("#photo-viewport").addEventListener("pointerup", endDrag);
  $("#photo-viewport").addEventListener("pointercancel", endDrag);
}

function init() {
  $("#country").innerHTML = countries.map((country) => `<option>${escapeHtml(country)}</option>`).join("");
  state.adminTasks = state.adminTasks.filter((id) => adminChecklistItems.some(([itemId]) => itemId === id));
  linkLegacyParticipants();
  setRegistrationDefaults();
  setupEvents();
  resetBmiPreview();
  updateAccountUi();
  updateCountdown();
  $$("[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === "home"));
  setInterval(updateCountdown, 1000);
  renderParticipants();
  if (location.pathname === "/login") openLogin("Войдите через Google, чтобы открыть защищенный раздел.");
}

init();
