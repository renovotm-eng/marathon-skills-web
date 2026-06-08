const { randomUUID } = require("crypto");
const { getSupabase } = require("./_lib/supabase");
const { requireUser, sendError, sendJson } = require("./_lib/auth");

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

function normalizeString(value) {
  return String(value || "").trim();
}

function toDbParticipant(participant, user) {
  const id = normalizeString(participant.id) || randomUUID();
  const owner = user.isAdmin
    ? normalizeString(participant.userId || participant.user_id || participant.ownerLogin || user.uid)
    : user.uid;

  return {
    id,
    user_id: owner,
    first_name: normalizeString(participant.firstName),
    last_name: normalizeString(participant.lastName),
    email: normalizeString(participant.email || user.email).toLowerCase(),
    phone: normalizeString(participant.phone),
    gender: normalizeString(participant.gender),
    birth_date: normalizeString(participant.birthDate) || null,
    distance: normalizeString(participant.distance),
    country: normalizeString(participant.country),
    city: normalizeString(participant.city),
    photo: participant.photo || "",
    registration_date: normalizeString(participant.registrationDate) || new Date().toISOString(),
    bmi: Number(participant.bmi) || 0,
    bmi_category: normalizeString(participant.bmiCategory),
    height: Number(participant.height) || 0,
    weight: Number(participant.weight) || 0,
    status: participant.status === "disqualified" ? "disqualified" : "active",
    disqualification_reason: normalizeString(participant.disqualificationReason),
    admin_note: normalizeString(participant.adminNote),
    bib_number: normalizeString(participant.bibNumber) || `MS-${id.replace(/-/g, "").slice(-5).toUpperCase()}`,
    check_in_status: participant.checkInStatus === "checked-in" ? "checked-in" : "pending",
    runner_checklist: Array.isArray(participant.runnerChecklist) ? participant.runnerChecklist : [],
    updated_at: new Date().toISOString()
  };
}

function fromDbParticipant(row) {
  return {
    id: row.id,
    userId: row.user_id,
    ownerLogin: row.user_id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    email: row.email || "",
    phone: row.phone || "",
    gender: row.gender || "",
    birthDate: row.birth_date || "",
    distance: row.distance || "",
    country: row.country || "",
    city: row.city || "",
    photo: row.photo || "",
    registrationDate: row.registration_date || row.created_at || "",
    bmi: Number(row.bmi) || 0,
    bmiCategory: row.bmi_category || "",
    height: Number(row.height) || 0,
    weight: Number(row.weight) || 0,
    status: row.status === "disqualified" ? "disqualified" : "active",
    disqualificationReason: row.disqualification_reason || "",
    adminNote: row.admin_note || "",
    bibNumber: row.bib_number || "",
    checkInStatus: row.check_in_status === "checked-in" ? "checked-in" : "pending",
    runnerChecklist: Array.isArray(row.runner_checklist) ? row.runner_checklist : []
  };
}

module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabase();

    if (req.method === "GET") {
      let query = supabase
        .from("participants")
        .select("*")
        .order("registration_date", { ascending: false });

      if (!user.isAdmin) query = query.eq("user_id", user.uid);

      const { data, error } = await query;
      if (error) throw error;

      return sendJson(res, 200, {
        ok: true,
        user,
        participants: (data || []).map(fromDbParticipant)
      });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = await readJson(req);
      const source = Array.isArray(body.participants)
        ? body.participants
        : [body.participant || body].filter(Boolean);
      const rows = source
        .filter((participant) => participant && typeof participant === "object")
        .map((participant) => toDbParticipant(participant, user));

      if (!rows.length) {
        return sendJson(res, 400, { ok: false, error: "Participant payload is empty" });
      }

      const { data, error } = await supabase
        .from("participants")
        .upsert(rows, { onConflict: "id" })
        .select("*");

      if (error) throw error;

      return sendJson(res, 200, {
        ok: true,
        participants: (data || []).map(fromDbParticipant)
      });
    }

    if (req.method === "DELETE") {
      const id = normalizeString(req.query.id);
      let query = supabase.from("participants").delete();

      if (id) query = query.eq("id", id);
      if (!user.isAdmin) query = query.eq("user_id", user.uid);
      if (user.isAdmin && !id) query = query.not("id", "is", null);

      const { error } = await query;
      if (error) throw error;

      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports.fromDbParticipant = fromDbParticipant;
