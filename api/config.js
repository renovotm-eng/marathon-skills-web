const { isSupabaseConfigured } = require("./_lib/supabase");
const { getAdminEmails, isFirebaseTokenVerifierConfigured, sendJson } = require("./_lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const firebase = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };

  sendJson(res, 200, {
    ok: true,
    firebase,
    configured: Boolean(firebase.apiKey && firebase.authDomain && firebase.projectId && firebase.appId),
    firebaseAdminConfigured: isFirebaseTokenVerifierConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    adminEmailsConfigured: getAdminEmails().length > 0,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramAdminSecretConfigured: Boolean(process.env.TELEGRAM_ADMIN_SECRET)
  });
};
