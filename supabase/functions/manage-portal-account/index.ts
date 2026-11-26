import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Server authentication configuration is incomplete." }, 500);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply({ error: "Sign in as an administrator." }, 401);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return reply({ error: "Your session is invalid. Sign in again." }, 401);
    const { data: adminProfile, error: adminProfileError } = await admin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    if (adminProfileError || adminProfile?.role !== "admin") return reply({ error: "Administrator access is required." }, 403);

    const body = await req.json().catch(() => ({}));
    const entityType = body.entity_type === "student" || body.entity_type === "teacher" ? body.entity_type : "";
    const recordId = typeof body.record_id === "string" ? body.record_id : "";
    const action = ["deactivate", "reactivate", "delete_login"].includes(body.action) ? body.action : "";
    if (!entityType || !recordId || !action) return reply({ error: "A valid account type, record ID and action are required." }, 400);

    let record: any;
    let userId: string | null = null;
    let email: string | null = null;
    let linkedChildren = 0;
    let parentId: string | null = null;

    if (entityType === "student") {
      const { data, error } = await admin.from("students").select("id, student_name, status, profile_id").eq("id", recordId).maybeSingle();
      if (error || !data) return reply({ error: "Student record not found." }, 404);
      record = data;
      userId = data.profile_id || null;
      if (!userId) {
        const { data: links, error: linksError } = await admin.from("student_guardians")
          .select("parent_id, is_primary").eq("student_id", recordId).order("is_primary", { ascending: false });
        if (linksError) throw linksError;
        const parentIds = (links || []).map((item: any) => item.parent_id).filter(Boolean);
        if (parentIds.length) {
          const { data: parents, error: parentsError } = await admin.from("parents").select("id, profile_id, email").in("id", parentIds);
          if (parentsError) throw parentsError;
          const primary = (links || []).find((item: any) => item.is_primary) || links?.[0];
          const parent = (parents || []).find((item: any) => item.id === primary?.parent_id);
          if (parent) {
            parentId = parent.id; userId = parent.profile_id || null; email = parent.email || null;
            const { count, error: countError } = await admin.from("student_guardians").select("student_id", { count: "exact", head: true }).eq("parent_id", parent.id);
            if (countError) throw countError;
            linkedChildren = count || 0;
          }
        }
      }
    } else {
      const { data, error } = await admin.from("teachers")
        .select("id, full_name, status, employment_status, profile_id, email").eq("id", recordId).maybeSingle();
      if (error || !data) return reply({ error: "Teacher record not found." }, 404);
      record = data; userId = data.profile_id || null; email = data.email || null;
    }

    if (!userId) return reply({ error: "No portal login is currently linked to this record. There is no linked account to change or delete." }, 409);
    const { data: linkedProfile, error: linkedProfileError } = await admin.from("profiles").select("id, role").eq("id", userId).maybeSingle();
    if (linkedProfileError) throw linkedProfileError;
    const expectedRole = entityType === "teacher" ? "teacher" : (record.profile_id ? "student" : "parent");
    if (!linkedProfile || linkedProfile.role !== expectedRole) return reply({ error: "The linked login role does not match this record. No changes were made; ask the administrator to review the account link." }, 409);
    if (userId === authData.user.id) return reply({ error: "You cannot deactivate or delete your own administrator login." }, 409);

    if (action === "deactivate" || action === "reactivate") {
      const deactivate = action === "deactivate";
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, { ban_duration: deactivate ? "876000h" : "none" });
      if (authUpdateError) throw authUpdateError;
      const update = entityType === "student"
        ? { status: deactivate ? "inactive" : "active" }
        : { status: deactivate ? "inactive" : "active", employment_status: deactivate ? "inactive" : "active" };
      const { error: recordUpdateError } = await admin.from(entityType === "student" ? "students" : "teachers").update(update).eq("id", recordId);
      if (recordUpdateError) {
        await admin.auth.admin.updateUserById(userId, { ban_duration: deactivate ? "none" : "876000h" });
        throw recordUpdateError;
      }
      if (deactivate) await admin.auth.admin.signOut(userId, "global");
      return reply({ success: true, action, entity_type: entityType, email, linked_children: linkedChildren,
        message: deactivate
          ? "Portal access deactivated. The login and all learning/history records are retained."
          : "Portal access reactivated. The existing account and password remain in place." });
    }

    // Remove the login/profile link only. Keep the student/teacher and all academic/financial history.
    const { error: signOutError } = await admin.auth.admin.signOut(userId, "global");
    if (signOutError) throw signOutError;
    try {
      const { error: studentsError } = await admin.from("students").update({ profile_id: null }).eq("profile_id", userId);
      if (studentsError) throw studentsError;
      const { error: teachersError } = await admin.from("teachers").update({ profile_id: null }).eq("profile_id", userId);
      if (teachersError) throw teachersError;
      const { error: parentsError } = await admin.from("parents").update({ profile_id: null }).eq("profile_id", userId);
      if (parentsError) throw parentsError;
      const { error: attendanceError } = await admin.from("attendance").update({ marked_by: null }).eq("marked_by", userId);
      if (attendanceError) throw attendanceError;
      const { error: paymentsError } = await admin.from("payments").update({ recorded_by: null, reviewed_by: null })
        .or(`recorded_by.eq.${userId},reviewed_by.eq.${userId}`);
      if (paymentsError) throw paymentsError;
      const { error: instructionsError } = await admin.from("payment_instructions").update({ updated_by: null }).eq("updated_by", userId);
      if (instructionsError) throw instructionsError;
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
    } catch (error) {
      if (entityType === "student" && record.profile_id) await admin.from("students").update({ profile_id: userId }).eq("id", recordId);
      else if (entityType === "teacher") await admin.from("teachers").update({ profile_id: userId }).eq("id", recordId);
      else if (parentId) await admin.from("parents").update({ profile_id: userId }).eq("id", parentId);
      await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      throw error;
    }

    return reply({ success: true, action, entity_type: entityType, email, linked_children: linkedChildren,
      message: "Portal login and profile association deleted. The student/teacher record and academic, attendance, assessment, enrolment and payment history are preserved. The record remains available to administration." });
  } catch (error) {
    console.error("manage-portal-account:", error);
    return reply({ error: error instanceof Error ? error.message : "Unable to manage this portal account." }, 500);
  }
});
