import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

let auth = null;
let currentUser = null;
let currentToken = "";
let currentServerUser = null;
let config = null;

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

function byId(id) {
  return document.getElementById(id);
}

function setAuthMessage(message, isError = false) {
  const element = byId("cloud-auth-message");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.classList.toggle("success", Boolean(message) && !isError);
}

function splitName(displayName, email) {
  const parts = String(displayName || email || "Google User").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Google",
    lastName: parts.slice(1).join(" ") || "User"
  };
}

function makePublicUser(firebaseUser, serverUser = null) {
  if (!firebaseUser) return null;
  const names = splitName(firebaseUser.displayName, firebaseUser.email);
  return {
    uid: firebaseUser.uid,
    login: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName || firebaseUser.email || "Google user",
    firstName: names.firstName,
    lastName: names.lastName,
    photoURL: firebaseUser.photoURL || "",
    isAdmin: Boolean(serverUser?.isAdmin),
    provider: firebaseUser.providerData?.[0]?.providerId || "password"
  };
}

async function apiFetch(path, options = {}) {
  if (!currentUser) throw new Error("Google authorization is required");
  currentToken = await currentUser.getIdToken();

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${currentToken}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  return fetch(path, {
    ...options,
    headers
  });
}

async function fetchServerState(firebaseUser) {
  if (!firebaseUser) return { user: null, participants: [] };

  try {
    const response = await apiFetch("/api/participants");
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "API request failed");
    currentServerUser = payload.user;
    return {
      user: makePublicUser(firebaseUser, currentServerUser),
      participants: payload.participants || []
    };
  } catch (error) {
    currentServerUser = null;
    setAuthMessage("Google-вход выполнен, но облачная БД/API пока не настроены на Vercel.", true);
    return {
      user: makePublicUser(firebaseUser, null),
      participants: []
    };
  }
}

function dispatchAuthState(detail) {
  window.dispatchEvent(new CustomEvent("marathon-cloud-auth", { detail }));
}

async function handleGoogleSignIn() {
  if (!auth) {
    setAuthMessage("Firebase Auth пока не настроен. Добавьте переменные окружения на Vercel.", true);
    return;
  }

  try {
    setAuthMessage("Открываю Google-вход...");
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      try {
        setAuthMessage("Открываю Google-вход через переход...");
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        setAuthMessage(`Не удалось войти через Google: ${redirectError.message}`, true);
        return;
      }
    }
    setAuthMessage(`Не удалось войти через Google: ${error.message}`, true);
  }
}

async function handleGoogleSignOut() {
  if (!auth) return;
  await signOut(auth);
}

async function handleEmailSignIn(email, password) {
  if (!auth) {
    throw new Error("Firebase Auth пока не настроен.");
  }
  await signInWithEmailAndPassword(auth, email, password);
}

async function handleEmailSignUp({ email, password, firstName, lastName }) {
  if (!auth) {
    throw new Error("Firebase Auth пока не настроен.");
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, {
    displayName: `${firstName} ${lastName}`.trim()
  });
  await credential.user.reload();
  currentUser = auth.currentUser;
  const serverState = await fetchServerState(currentUser);
  dispatchAuthState({
    configured: Boolean(config?.configured),
    user: serverState.user,
    participants: serverState.participants,
    databaseReady: Boolean(config?.supabaseConfigured),
    telegramReady: Boolean(config?.telegramConfigured)
  });
}

async function initCloudAuth() {
  try {
    const response = await fetch("/api/config");
    config = await response.json();

    if (!config.configured) {
      setAuthMessage("На Vercel еще не заполнены Firebase-переменные. Google-вход будет доступен после настройки.", true);
      dispatchAuthState({ configured: false, user: null, participants: [] });
      return;
    }

    auth = getAuth(initializeApp(config.firebase));
    getRedirectResult(auth).catch((error) => {
      setAuthMessage(`Не удалось завершить Google-вход: ${error.message}`, true);
    });

    onAuthStateChanged(auth, async (firebaseUser) => {
      currentUser = firebaseUser;
      currentToken = "";
      const serverState = await fetchServerState(firebaseUser);
      dispatchAuthState({
        configured: true,
        user: serverState.user,
        participants: serverState.participants,
        databaseReady: Boolean(config.supabaseConfigured),
        telegramReady: Boolean(config.telegramConfigured)
      });
      if (firebaseUser) setAuthMessage("Вход через Google выполнен.");
    });
  } catch (error) {
    setAuthMessage(`Не удалось загрузить настройки авторизации: ${error.message}`, true);
    dispatchAuthState({ configured: false, user: null, participants: [] });
  }
}

window.MarathonCloud = {
  signIn: handleGoogleSignIn,
  emailSignIn: handleEmailSignIn,
  emailSignUp: handleEmailSignUp,
  signOut: handleGoogleSignOut,
  apiFetch,
  refresh: async () => {
    const serverState = await fetchServerState(currentUser);
    dispatchAuthState({
      configured: Boolean(config?.configured),
      user: serverState.user,
      participants: serverState.participants
    });
    return serverState;
  },
  get user() {
    return makePublicUser(currentUser, currentServerUser);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  byId("google-login-button")?.addEventListener("click", handleGoogleSignIn);
  initCloudAuth();
});
