const { getSupabase } = require("./_lib/supabase");
const { requireAdmin, requireUser, sendError, sendJson } = require("./_lib/auth");

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const supabase = getSupabase();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("admin_tasks")
        .select("id, completed")
        .order("id", { ascending: true });

      if (error) throw error;

      return sendJson(res, 200, {
        ok: true,
        tasks: (data || []).filter((task) => task.completed).map((task) => task.id)
      });
    }

    if (req.method === "PUT") {
      const body = await readJson(req);
      const tasks = Array.isArray(body.tasks) ? body.tasks.map((item) => String(item)) : [];
      const knownTasks = ["route", "medical", "volunteers", "water"];
      const rows = knownTasks.map((id) => ({
        id,
        completed: tasks.includes(id),
        updated_by: user.uid,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("admin_tasks")
        .upsert(rows, { onConflict: "id" });

      if (error) throw error;

      return sendJson(res, 200, { ok: true, tasks: rows.filter((task) => task.completed).map((task) => task.id) });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendError(res, error);
  }
};
