const { randomUUID } = require("crypto");

function makeId(prefix, id = randomUUID()) {
  return `${prefix}_${String(id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function toDoc(row, prefix) {
  const data = safeJsonParse(row.updated_by);
  return {
    id: row.id,
    publicId: String(row.id || "").replace(`${prefix}_`, ""),
    completed: Boolean(row.completed),
    updatedAt: row.updated_at,
    data
  };
}

async function saveFallbackDoc(supabase, prefix, data, options = {}) {
  const id = options.id ? makeId(prefix, options.id) : makeId(prefix);
  const payload = {
    id,
    completed: Boolean(options.completed),
    updated_by: JSON.stringify(data || {}),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("admin_tasks")
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
  return { ...payload, data };
}

async function listFallbackDocs(supabase, prefix, options = {}) {
  let query = supabase
    .from("admin_tasks")
    .select("id, completed, updated_by, updated_at")
    .like("id", `${prefix}_%`)
    .order("updated_at", { ascending: false });

  if (typeof options.completed === "boolean") query = query.eq("completed", options.completed);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => toDoc(row, prefix));
}

async function completeFallbackDocs(supabase, ids) {
  const cleanIds = (ids || []).filter(Boolean);
  if (!cleanIds.length) return 0;

  const { error } = await supabase
    .from("admin_tasks")
    .update({ completed: true, updated_at: new Date().toISOString() })
    .in("id", cleanIds);

  if (error) throw error;
  return cleanIds.length;
}

module.exports = {
  completeFallbackDocs,
  listFallbackDocs,
  saveFallbackDoc
};
