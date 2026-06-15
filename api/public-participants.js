const { getSupabase } = require("./_lib/supabase");
const { sendError, sendJson } = require("./_lib/auth");

function normalizeString(value) {
  return String(value || "").trim();
}

function fromPublicParticipant(row) {
  return {
    id: row.id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    gender: row.gender || "",
    birthDate: row.birth_date || "",
    distance: row.distance || "",
    country: row.country || "",
    city: row.city || "",
    photo: row.photo || "",
    registrationDate: row.registration_date || row.created_at || "",
    bmi: Number(row.bmi) || 0,
    bmiCategory: row.bmi_category || "",
    status: row.status === "disqualified" ? "disqualified" : "active",
    bibNumber: normalizeString(row.bib_number)
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    const { data, error } = await getSupabase()
      .from("participants")
      .select("id, first_name, last_name, gender, birth_date, distance, country, city, photo, registration_date, created_at, bmi, bmi_category, status, bib_number")
      .order("registration_date", { ascending: false });

    if (error) throw error;

    return sendJson(res, 200, {
      ok: true,
      participants: (data || []).map(fromPublicParticipant)
    });
  } catch (error) {
    return sendError(res, error);
  }
};
