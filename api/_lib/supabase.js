const { createClient } = require("@supabase/supabase-js");

let supabaseClient;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Missing ${name}`);
    error.statusCode = 500;
    throw error;
  }
  return value;
}

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }
  return supabaseClient;
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = {
  getSupabase,
  isSupabaseConfigured
};
