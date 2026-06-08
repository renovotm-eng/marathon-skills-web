function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isFirebaseTokenVerifierConfigured() {
  return Boolean(process.env.FIREBASE_API_KEY);
}

async function verifyFirebaseIdToken(idToken) {
  if (!isFirebaseTokenVerifierConfigured()) {
    const error = new Error("Firebase Auth is not configured");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(process.env.FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.users?.length) {
    const error = new Error("Invalid Firebase ID token");
    error.statusCode = 401;
    throw error;
  }

  const user = payload.users[0];
  return {
    uid: user.localId,
    email: String(user.email || "").toLowerCase(),
    name: user.displayName || user.email || "Google user",
    picture: user.photoUrl || ""
  };
}

async function requireUser(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error("Authorization Bearer token is required");
    error.statusCode = 401;
    throw error;
  }

  const decoded = await verifyFirebaseIdToken(match[1]);
  const email = decoded.email;

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
  getAdminEmails,
  isFirebaseTokenVerifierConfigured
};
