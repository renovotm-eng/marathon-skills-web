const { getFirebaseAdmin, isFirebaseAdminConfigured } = require("./firebase-admin");

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function requireUser(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error("Authorization Bearer token is required");
    error.statusCode = 401;
    throw error;
  }

  if (!isFirebaseAdminConfigured()) {
    const error = new Error("Firebase Admin is not configured");
    error.statusCode = 500;
    throw error;
  }

  const decoded = await getFirebaseAdmin().auth().verifyIdToken(match[1]);
  const email = String(decoded.email || "").toLowerCase();

  return {
    uid: decoded.uid,
    email,
    name: decoded.name || decoded.email || "Google user",
    picture: decoded.picture || "",
    isAdmin: getAdminEmails().includes(email)
  };
}

function requireAdmin(user) {
  if (!user.isAdmin) {
    const error = new Error("Admin access is required");
    error.statusCode = 403;
    throw error;
  }
}

function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  const status = error.statusCode || 500;
  sendJson(res, status, {
    ok: false,
    error: status >= 500 ? "Server configuration or database error" : error.message,
    detail: process.env.NODE_ENV === "production" ? undefined : error.message
  });
}

module.exports = {
  requireUser,
  requireAdmin,
  sendJson,
  sendError,
  getAdminEmails
};
