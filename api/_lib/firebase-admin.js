const admin = require("firebase-admin");

function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function getFirebaseAdmin() {
  if (!isFirebaseAdminConfigured()) {
    const error = new Error("Firebase Admin credentials are not configured");
    error.statusCode = 500;
    throw error;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      })
    });
  }

  return admin;
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminConfigured
};
