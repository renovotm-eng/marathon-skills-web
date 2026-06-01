"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE = {
  accounts: "marathonSkills.accounts.v1",
  participants: "marathonSkills.participants.v1"
};
const countries = `Казахстан|Австралия|Австрия|Азербайджан|Албания|Алжир|Ангола|Андорра|Антигуа и Барбуда|Аргентина|Армения|Афганистан|Багамы|Бангладеш|Барбадос|Бахрейн|Беларусь|Белиз|Бельгия|Бенин|Болгария|Боливия|Босния и Герцеговина|Ботсвана|Бразилия|Бруней|Буркина-Фасо|Бурунди|Бутан|Вануату|Великобритания|Венгрия|Венесуэла|Восточный Тимор|Вьетнам|Габон|Гаити|Гайана|Гамбия|Гана|Гватемала|Гвинея|Гвинея-Бисау|Германия|Гренада|Греция|Грузия|Дания|Джибути|Доминика|Доминиканская Республика|Египет|Замбия|Зимбабве|Израиль|Индия|Индонезия|Иордания|Ирак|Иран|Ирландия|Исландия|Испания|Италия|Йемен|Кабо-Верде|Камбоджа|Камерун|Канада|Катар|Кения|Кипр|Кирибати|Китай|Колумбия|Коморы|Конго|Корейская Народно-Демократическая Республика|Коста-Рика|Кот-д'Ивуар|Куба|Кувейт|Кыргызстан|Лаос|Латвия|Лесото|Либерия|Ливан|Ливия|Литва|Лихтенштейн|Люксембург|Маврикий|Мавритания|Мадагаскар|Малави|Малайзия|Мали|Мальдивы|Мальта|Марокко|Маршалловы Острова|Мексика|Мозамбик|Молдова|Монако|Монголия|Мьянма|Намибия|Науру|Непал|Нигер|Нигерия|Нидерланды|Никарагуа|Новая Зеландия|Норвегия|Объединенные Арабские Эмираты|Оман|Пакистан|Палау|Панама|Папуа - Новая Гвинея|Парагвай|Перу|Польша|Португалия|Россия|Руанда|Румыния|Сальвадор|Самоа|Сан-Марино|Сан-Томе и Принсипи|Саудовская Аравия|Северная Македония|Сейшелы|Сербия|Сингапур|Сирия|Словакия|Словения|Соединенные Штаты Америки|Соломоновы Острова|Сомали|Судан|Суринам|Сьерра-Леоне|Таджикистан|Таиланд|Танзания|Того|Тонга|Тринидад и Тобаго|Тувалу|Тунис|Туркменистан|Турция|Уганда|Узбекистан|Украина|Уругвай|Федеративные Штаты Микронезии|Фиджи|Филиппины|Финляндия|Франция|Хорватия|Центральноафриканская Республика|Чад|Черногория|Чехия|Чили|Швейцария|Швеция|Шри-Ланка|Эквадор|Экваториальная Гвинея|Эритрея|Эсватини|Эстония|Эфиопия|Южная Корея|Южно-Африканская Республика|Южный Судан|Ямайка|Япония`.split("|");

const state = {
  accounts: loadJson(STORAGE.accounts, []),
  participants: loadJson(STORAGE.participants, []),
  session: null,
  draftParticipant: null,
  selectedParticipantId: null,
  bmi: null,
  participantFilters: { query: "", sortBy: "registrationDate", direction: "desc" },
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
  $$(".page").forEach((page) => page.classList.remove("active"));
  $(`#page-${name}`).classList.add("active");
  if (name === "registration" && state.session && !state.session.isAdmin) {
    if (!$("#first-name").value && !$("#last-name").value) {
      $("#first-name").value = state.session.firstName;
      $("#last-name").value = state.session.lastName;
    }
  }
  if (name === "participants") renderParticipants();
}

function updateAccountUi() {
  $("#current-account").textContent = !state.session
    ? "Вход не выполнен"
    : state.session.isAdmin ? "Админ: полный доступ" : `Бегун: ${state.session.firstName} ${state.session.lastName}`;
  $("#admin-actions").classList.toggle("visible", Boolean(state.session?.isAdmin));
}

function showLogin() {
  $("#signup-form").classList.add("hidden");
  $("#login-form").classList.remove("hidden");
  $("#admin-hint").classList.remove("hidden");
  $("#signup-message").textContent = "";
}

function showSignup() {
  $("#login-form").classList.add("hidden");
  $("#signup-form").classList.remove("hidden");
  $("#admin-hint").classList.add("hidden");
  $("#login-message").textContent = "";
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

function logout() {
  state.session = null;
  clearSessionDraft();
  $("#login").value = "";
  $("#password").value = "";
  $("#login-message").textContent = "";
  showLogin();
  $("#login-overlay").classList.remove("hidden");
  updateAccountUi();
}

async function handleLogin(event) {
  event.preventDefault();
  const login = $("#login").value.trim();
  const password = $("#password").value;
  const message = $("#login-message");
  message.className = "form-message";

  if (login.toLowerCase() === "admin" && password === "admin123") {
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
  showPage("home");
}

async function handleSignup(event) {
  event.preventDefault();
  const firstName = $("#signup-first-name").value.trim();
  const lastName = $("#signup-last-name").value.trim();
  const login = $("#signup-login").value.trim();
  const password = $("#signup-password").value;
  const passwordRepeat = $("#signup-password-repeat").value;
  const message = $("#signup-message");

  if (!isCapitalizedName(firstName) || !isCapitalizedName(lastName)) {
    message.textContent = "Имя и фамилия должны начинаться с заглавной буквы и содержать только буквы, пробел или дефис.";
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
  if (password.length < 4) {
    message.textContent = "Пароль должен содержать минимум 4 символа.";
    return;
  }
  if (password !== passwordRepeat) {
    message.textContent = "Пароли не совпадают.";
    return;
  }

  const passwordData = await createPassword(password);
  state.accounts.push({ firstName, lastName, login, ...passwordData });
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
  const birthDate = new Date(`${data.birthDate}T00:00:00`);
  const today = new Date();
  const youngest = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
  const oldest = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  if (!data.birthDate || birthDate > youngest || birthDate < oldest) return "Укажите корректную дату рождения. Участнику должно быть от 14 до 100 лет.";
  return "";
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
  const participant = {
    ...state.draftParticipant,
    bmi: Number(state.bmi.toFixed(1)),
    bmiCategory: getBmiCategory(state.bmi),
    photo: state.crop.image ? canvas.toDataURL("image/jpeg", .82) : ""
  };
  state.participants.push(participant);
  if (!saveJson(STORAGE.participants, state.participants)) {
    state.participants.pop();
    return;
  }
  clearSessionDraft();
  renderParticipants();
  showPage("participants");
  toast("Участник сохранен.");
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
    </tr>`).join("") : `<tr class="empty-row"><td colspan="10">${isFiltered ? "По вашему запросу участники не найдены." : "Список участников пока пуст."}</td></tr>`;
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
    participant.bmiCategory
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

function deleteSelectedParticipant() {
  if (!state.session?.isAdmin) return toast("Удалять участников может только администратор.", true);
  if (!state.selectedParticipantId) return toast("Выберите участника в таблице.", true);
  const participant = state.participants.find((item) => item.id === state.selectedParticipantId);
  if (!participant || !confirm(`Удалить участника ${participant.firstName} ${participant.lastName}?`)) return;
  state.participants = state.participants.filter((item) => item.id !== state.selectedParticipantId);
  state.selectedParticipantId = null;
  saveJson(STORAGE.participants, state.participants);
  renderParticipants();
}

function clearParticipants() {
  if (!state.session?.isAdmin) return toast("Очищать список может только администратор.", true);
  if (!state.participants.length || !confirm("Удалить всех участников из списка?")) return;
  state.participants = [];
  state.selectedParticipantId = null;
  saveJson(STORAGE.participants, state.participants);
  renderParticipants();
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
  setRegistrationDefaults();
  setupEvents();
  resetBmiPreview();
  updateAccountUi();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  renderParticipants();
}

init();
