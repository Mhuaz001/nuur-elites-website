import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function ageOnToday(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() &&
      now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server authentication configuration is incomplete." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in as an administrator." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);

    const { data: adminProfile, error: profileCheckError } = await admin
      .from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    if (profileCheckError || adminProfile?.role !== "admin") {
      return json({ error: "Administrator access is required." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const studentId = typeof body.student_id === "string" ? body.student_id : "";
    if (!studentId) return json({ error: "A student record ID is required." }, 400);

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, student_name, date_of_birth, student_email, guardian_name, guardian_email, guardian_phone, relationship, status")
      .eq("id", studentId).maybeSingle();

    if (studentError || !student) return json({ error: "Student record not found." }, 404);
    if (student.status !== "active") return json({ error: "Only active students can receive portal access." }, 409);

    const age = student.date_of_birth ? ageOnToday(student.date_of_birth) : null;
    if (age !== null && age < 0) return json({ error: "The student's date of birth is invalid." }, 400);
    const isMinor = age === null || age < 18;
    const accountRole = isMinor ? "parent" : "student";
    const email = String(isMinor ? student.guardian_email || "" : student.student_email || "").trim().toLowerCase();

    if (!email) {
      return json({
        error: isMinor
          ? "This learner is under 18 or has no date of birth. Add the parent/guardian email to the student record before sending the invitation."
          : "This learner is 18 or older. Add the student's own email address before sending the invitation.",
        needs_email: true,
        account_role: accountRole,
      }, 422);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "The login email address is not valid." }, 422);
    }

    const { data: userPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    let authUser = userPage.users.find((u) => (u.email || "").toLowerCase() === email);
    let invitedNow = false;

    if (!authUser) {
      const siteUrl = Deno.env.get("NUUR_SITE_URL") || "https://nuurelites.netlify.app";
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: isMinor ? student.guardian_name : student.student_name, role: accountRole },
        redirectTo: `${siteUrl}/reset-password.html`,
      });
      if (inviteError) {
        if (inviteData?.user?.id) await admin.auth.admin.deleteUser(inviteData.user.id);
        throw new Error(`Invitation email could not be sent: ${inviteError.message}`);
      }
      authUser = inviteData.user;
      invitedNow = true;
    }

    if (!authUser) throw new Error("The authentication account could not be created or found.");

    const { data: existingProfile, error: existingProfileError } = await admin
      .from("profiles").select("id, role").eq("id", authUser.id).maybeSingle();
    if (existingProfileError) throw existingProfileError;
    if (existingProfile && existingProfile.role !== accountRole) {
      if (invitedNow) await admin.auth.admin.deleteUser(authUser.id);
      return json({
        error: `This email already belongs to a ${existingProfile.role} account. Use a different email or ask administration to review the existing account.`,
      }, 409);
    }

    const fullName = isMinor ? (student.guardian_name || "Parent or Guardian") : student.student_name;
    const { error: upsertProfileError } = await admin.from("profiles").upsert({
      id: authUser.id,
      full_name: fullName,
      phone: isMinor ? student.guardian_phone : null,
      role: accountRole,
    }, { onConflict: "id" });
    if (upsertProfileError) {
      if (invitedNow) await admin.auth.admin.deleteUser(authUser.id);
      throw upsertProfileError;
    }

    if (isMinor) {
      const { data: parent, error: parentError } = await admin.from("parents").upsert({
        profile_id: authUser.id,
        full_name: fullName,
        email,
        phone: student.guardian_phone,
        relationship: student.relationship,
      }, { onConflict: "profile_id" }).select("id").single();
      if (parentError) {
        if (invitedNow) await admin.auth.admin.deleteUser(authUser.id);
        throw parentError;
      }

      const { error: linkError } = await admin.from("student_guardians").upsert({
        student_id: student.id,
        parent_id: parent.id,
        relationship: student.relationship,
        is_primary: true,
      }, { onConflict: "student_id,parent_id", ignoreDuplicates: true });
      if (linkError) {
        if (invitedNow) await admin.auth.admin.deleteUser(authUser.id);
        throw linkError;
      }
    } else {
      const { error: linkError } = await admin.from("students")
        .update({ profile_id: authUser.id }).eq("id", student.id);
      if (linkError) {
        if (invitedNow) await admin.auth.admin.deleteUser(authUser.id);
        throw linkError;
      }
    }

    return json({
      success: true,
      student_id: student.id,
      account_role: accountRole,
      recipient_email: email,
      recipient_name: fullName,
      invited_now: invitedNow,
      existing_account: !invitedNow,
      message: invitedNow
        ? "Secure invitation sent. The recipient must open the email and set a password."
        : "This email already has a matching portal account. The account has been linked; the recipient should use their existing password.",
    });
  } catch (error) {
    console.error("provision-student-login:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to create the portal account." }, 500);
  }
});