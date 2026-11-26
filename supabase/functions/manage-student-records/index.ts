import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Server authentication configuration is incomplete." }, 500);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply({ error: "Sign in as an administrator." }, 401);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return reply({ error: "Your session is invalid. Sign in again." }, 401);
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role").eq("id", authData.user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") return reply({ error: "Administrator access is required." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const studentId = typeof body.student_id === "string" ? body.student_id : null;
    if (!["deactivate", "reactivate", "delete_student", "delete_all"].includes(action)) {
      return reply({ error: "Choose a valid student management action." }, 400);
    }
    if (action !== "delete_all" && !studentId) return reply({ error: "A student record ID is required." }, 400);

    if (action === "delete_student" || action === "delete_all") {
      const { data, error } = await admin.rpc("admin_delete_student_records", {
        p_student_id: action === "delete_all" ? null : studentId,
      });
      if (error) return reply({ error: error.message || "Unable to delete student records." }, 409);
      const deletedCount = Number(data || 0);
      return reply({
        success: true, action, deleted_count: deletedCount,
        message: action === "delete_all"
          ? deletedCount + " student record(s) permanently deleted."
          : "Student record permanently deleted.",
      });
    }

    const { data: student, error: studentError } = await admin.from("students")
      .select("id, student_name, status, profile_id").eq("id", studentId).maybeSingle();
    if (studentError || !student) return reply({ error: "Student record not found." }, 404);
    const deactivate = action === "deactivate";
    if (student.profile_id) {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(student.profile_id, {
        ban_duration: deactivate ? "876000h" : "none",
      });
      if (authUpdateError) throw authUpdateError;
      if (deactivate) {
        const { error: signOutError } = await admin.auth.admin.signOut(student.profile_id, "global");
        if (signOutError) throw signOutError;
      }
    }
    const { error: updateError } = await admin.from("students")
      .update({ status: deactivate ? "inactive" : "active" }).eq("id", studentId);
    if (updateError) {
      if (student.profile_id) await admin.auth.admin.updateUserById(student.profile_id, {
        ban_duration: deactivate ? "none" : "876000h",
      });
      throw updateError;
    }
    return reply({
      success: true, action,
      message: deactivate
        ? "Student marked inactive. Academic and financial records are preserved."
        : "Student reactivated successfully.",
    });
  } catch (error) {
    console.error("manage-student-records:", error);
    return reply({ error: error instanceof Error ? error.message : "Unable to complete the student management action." }, 500);
  }
});
